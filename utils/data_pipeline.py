"""
data_pipeline.py
================
Apex AI - Phase 2 (TFT) Data Pipeline
--------------------------------------
Provides three core functions for building a rich, multi-modal feature set
suitable for Temporal Fusion Transformer training:

    1. fetch_multi_modal  - OHLCV + macro indices (VIX, S&P 500, NIFTY 50)
    2. add_static_metadata - sector / industry / marketCap / beta covariates
    3. validate_data       - data-quality gate with a structured report

Author : Apex AI Team
Requires: yfinance>=0.2, pandas, numpy
"""

from __future__ import annotations

import logging
import math
import warnings
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf
from utils.yf_utils import download_yf, get_ticker


# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
from rich.logging import RichHandler

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(rich_tracebacks=True, show_path=False)]
)
logger = logging.getLogger("apex_ai.data_pipeline")

# Suppress noisy yfinance / pandas FutureWarnings in production pipelines
warnings.filterwarnings("ignore", category=FutureWarning)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MACRO_TICKERS: dict[str, str] = {
    "^VIX": "VIX",
    "^GSPC": "SP500",
    "^NSEI": "NSEI",
}

STATIC_INFO_FIELDS: dict[str, Any] = {
    "sector": "Unknown",
    "industry": "Unknown",
    "marketCap": np.nan,
    "beta": np.nan,
}

# ── Global Cache (Phase 2 Speedup) ──────────────────────────────────────────
_MACRO_CACHE: Dict[str, Tuple[float, pd.Series]] = {}
_INFO_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
MACRO_CACHE_TTL = 600  # 10 minutes
INFO_CACHE_TTL = 3600  # 1 hour


# ---------------------------------------------------------------------------
# 1. fetch_multi_modal
# ---------------------------------------------------------------------------
def fetch_multi_modal(ticker: str, period: str = "1y") -> pd.DataFrame:
    """Fetch and merge OHLCV data with macro-economic indices.

    Downloads daily OHLCV bars for *ticker* via yfinance, then left-joins
    three macro indices - VIX (^VIX), S&P 500 (^GSPC), and NIFTY 50 (^NSEI)
    - on the shared date index.  Weekend / holiday gaps are forward-filled so
    every trading day has a valid macro value.

    Parameters
    ----------
    ticker : str
        Yahoo Finance ticker symbol, e.g. ``"AAPL"`` or ``"RELIANCE.NS"``.
    period : str, optional
        Lookback window accepted by ``yfinance`` (e.g. ``"1y"``, ``"2y"``).
        Defaults to ``"2y"``.

    Returns
    -------
    pd.DataFrame
        Merged DataFrame with columns:
        ``Open, High, Low, Close, Volume`` (from ticker) plus
        ``VIX, SP500, NSEI`` (macro close prices).
        Index is a ``DatetimeIndex`` in ascending order.

    Raises
    ------
    ValueError
        If yfinance returns an empty DataFrame for the primary ticker.
    """
    # ------------------------------------------------------------------
    # Step 1 - Primary OHLCV download
    # ------------------------------------------------------------------
    logger.info("Fetching OHLCV data for %s (period=%s)...", ticker, period)
    try:
        raw = download_yf(
            ticker,
            use_session=True,
            period=period,
            interval="1d",
            progress=False,
            auto_adjust=True,
            group_by="column",
        )
    except Exception as exc:
        raise RuntimeError(
            f"yfinance download failed for '{ticker}': {exc}"
        ) from exc

    if raw is None or raw.empty:
        raise ValueError(
            f"No data returned by yfinance for ticker='{ticker}' "
            f"with period='{period}'.  Check the symbol and your connection."
        )

    # Flatten MultiIndex columns that yfinance sometimes produces
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)

    # Dedup columns (yfinance sometimes returns duplicate 'Close' if auto_adjust=True)
    raw = raw.loc[:, ~raw.columns.duplicated()]

    # Keep only standard OHLCV columns that are present
    ohlcv_cols = [c for c in ["Open", "High", "Low", "Close", "Volume"] if c in raw.columns]
    df: pd.DataFrame = raw[ohlcv_cols].copy()
    df.index = pd.to_datetime(df.index)
    df.sort_index(inplace=True)
    logger.info("Primary data: %d rows, columns=%s", len(df), list(df.columns))

    # ------------------------------------------------------------------
    # Step 2 - Macro index downloads & left-join
    # ------------------------------------------------------------------
    from concurrent.futures import ThreadPoolExecutor

    def _fetch_macro(args: tuple[str, str]) -> tuple[str, pd.Series | None]:
        yticker, col = args
        logger.info("Fetching macro index %s -> '%s'...", yticker, col)
        try:
            macro_raw = download_yf(yticker, use_session=True, period=period, interval="1d", progress=False, auto_adjust=True, group_by="column")
            if macro_raw is None or macro_raw.empty:
                logger.warning("Empty data for macro index %s - column '%s' will be NaN.", yticker, col)
                return col, None

            if isinstance(macro_raw.columns, pd.MultiIndex):
                macro_raw.columns = macro_raw.columns.get_level_values(0)

            # Dedup macro columns
            macro_raw = macro_raw.loc[:, ~macro_raw.columns.duplicated()]

            if "Close" not in macro_raw.columns:
                logger.warning("No 'Close' column for macro %s", yticker)
                return col, None

            close_series = macro_raw["Close"]
            if isinstance(close_series, pd.DataFrame):
                close_series = close_series.iloc[:, 0]

            close_series.index = pd.to_datetime(close_series.index)
            close_series.name = col
            return col, close_series.astype(float)

        except Exception as exc:
            logger.warning("Could not fetch macro index %s (%s) - column '%s' will be NaN.", yticker, exc, col)
            return col, None

    import time
    now = time.time()
    args_to_fetch = []
    
    # Check what macro data needs a fresh download
    macro_hits = {}
    macro_misses = []
    
    for yticker, col in MACRO_TICKERS.items():
        if yticker in _MACRO_CACHE:
            ts, series = _MACRO_CACHE[yticker]
            if now - ts < MACRO_CACHE_TTL:
                macro_hits[col] = series
                continue
        macro_misses.append(yticker)

    if macro_misses:
        logger.info("Fetching macro indices %s in parallel...", macro_misses)
        try:
            # Multi-download allows yfinance to handle concurrency natively
            bulk_data = download_yf(macro_misses, period=period, interval="1d", progress=False, group_by='ticker')
            
            for yticker in macro_misses:
                col_name = MACRO_TICKERS[yticker]
                try:
                    # Handle single/bulk yfinance return shapes
                    if len(macro_misses) == 1:
                        series = bulk_data["Close"] if "Close" in bulk_data.columns else None
                    else:
                        series = bulk_data[yticker]["Close"] if yticker in bulk_data.columns else None
                    
                    if series is not None:
                        series.name = col_name  # Ensure it doesn't stay as 'Close'
                        _MACRO_CACHE[yticker] = (now, series)
                        macro_hits[col_name] = series
                    else:
                        df[col_name] = np.nan
                except:
                    df[col_name] = np.nan
        except Exception as e:
            logger.warning("Bulk macro fetch failed: %s", e)
            for yticker in macro_misses:
                df[MACRO_TICKERS[yticker]] = np.nan

    # Join all macro columns
    for col_name, series in macro_hits.items():
        df = df.join(series, how="left")

    # ------------------------------------------------------------------
    # Step 3 - Forward-fill weekends / holidays in macro columns
    # ------------------------------------------------------------------
    macro_cols = list(MACRO_TICKERS.values())
    present_macro_cols = [c for c in macro_cols if c in df.columns]
    df[present_macro_cols] = df[present_macro_cols].ffill()

    logger.info(
        "fetch_multi_modal complete - shape=%s, columns=%s",
        df.shape, list(df.columns),
    )
    return df


def fetch_multi_modal_batch(tickers: list[str], period: str = "1y") -> dict[str, pd.DataFrame]:
    """
    Fetch OHLCV + Macro for multiple tickers in parallel batches.
    Returns a dict {ticker: DataFrame}.
    """
    logger.info("Batch Fetch: Requesting %d tickers for %s...", len(tickers), period)
    
    # 1. Bulk download OHLCV
    try:
        bulk_raw = download_yf(
            tickers,
            use_session=True,
            period=period,
            interval="1d",
            progress=False,
            auto_adjust=True,
            group_by="ticker",
        )
    except Exception as exc:
        logger.error("Batch download failed: %s", exc)
        return {}

    # 2. Fetch Macro (will use cache if available)
    # We call fetch_multi_modal for one ticker to ensure macro cache is warm
    # or we can manually warm it here.
    # Actually, fetch_multi_modal already warms it.
    
    results: dict[str, pd.DataFrame] = {}
    for tkr in tickers:
        try:
            if len(tickers) == 1:
                tkr_raw = bulk_raw
            else:
                tkr_raw = bulk_raw[tkr]
                
            if tkr_raw.empty or "Close" not in tkr_raw.columns:
                continue
                
            # Basic cleanup (similar to fetch_multi_modal)
            df = tkr_raw[["Open", "High", "Low", "Close", "Volume"]].copy()
            df.dropna(subset=["Close"], inplace=True)
            if df.empty: continue
            
            # Add macro columns (using the cache)
            # Re-use the logic from fetch_multi_modal by calling it?
            # No, that's redundant. We'll manually join from cache here.
            from utils.data_pipeline import fetch_multi_modal
            # To avoid duplicating logic, we'll implement a light version here 
            # or just call fetch_multi_modal if cache is missing.
            # For speed, let's just use the cached macro indices.
            
            import time
            now = time.time()
            for m_ytkr, m_col in MACRO_TICKERS.items():
                if m_ytkr in _MACRO_CACHE:
                    ts, series = _MACRO_CACHE[m_ytkr]
                    if now - ts < MACRO_CACHE_TTL:
                        df = df.join(series, how="left")
                        continue
                # If miss, we'll just skip for now to keep it fast, 
                # or fetch one if really needed.
                # In practice, the first ticker fetch will warm the cache.
            
            df.ffill(inplace=True)
            results[tkr] = df
        except Exception as e:
            logger.warning("Batch process error for %s: %s", tkr, e)
            
    return results


# ---------------------------------------------------------------------------
# 2. add_static_metadata
# ---------------------------------------------------------------------------
def add_static_metadata(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    """Enrich a price DataFrame with static (time-invariant) company metadata.

    Queries ``yfinance.Ticker.info`` for sector, industry, market capitalisation,
    and beta.  Each field is broadcast as a constant column across every row
    (suitable for TFT static covariates).  ``marketCap`` is log-transformed to
    reduce its order-of-magnitude variance.

    Parameters
    ----------
    df : pd.DataFrame
        The merged OHLCV + macro DataFrame produced by :func:`fetch_multi_modal`.
    ticker : str
        Yahoo Finance ticker symbol used to look up ``.info``.

    Returns
    -------
    pd.DataFrame
        Input DataFrame extended with columns:
        ``sector``, ``industry``, ``log_market_cap``, ``beta``.

    Notes
    -----
    * Falls back to sensible defaults when ``.info`` is unavailable or a field
      is missing, so the pipeline never hard-fails on metadata issues.
    * ``log_market_cap`` is ``log(marketCap)`` (natural log).  If ``marketCap``
      is 0, negative, or NaN, the column is set to ``np.nan``.
    """
    df = df.copy()

    import time
    now = time.time()
    info: dict[str, Any] = {}
    
    if ticker in _INFO_CACHE:
        ts, cached_info = _INFO_CACHE[ticker]
        if now - ts < INFO_CACHE_TTL:
            info = cached_info
            logger.info("Using cached info for %s", ticker)
    
    if not info:
        try:
            ticker_obj = get_ticker(ticker, use_session=True)
            info = ticker_obj.info or {}
            if info:
                _INFO_CACHE[ticker] = (now, info)
        except Exception as exc:
            logger.warning(
                "Could not retrieve yfinance info for '%s' (%s). "
                "Using defaults for all metadata fields.",
                ticker, exc,
            )

    # ------------------------------------------------------------------
    # Sector & Industry (categorical static covariates)
    # ------------------------------------------------------------------
    df["sector"] = info.get("sector", STATIC_INFO_FIELDS["sector"])
    df["industry"] = info.get("industry", STATIC_INFO_FIELDS["industry"])

    # ------------------------------------------------------------------
    # Market Cap - log-transform to reduce scale
    # ------------------------------------------------------------------
    market_cap: float | None = info.get("marketCap", None)
    if market_cap is not None and np.isfinite(market_cap) and market_cap > 0:
        df["log_market_cap"] = math.log(market_cap)
        logger.info(
            "marketCap=%s -> log_market_cap=%.4f", f"{market_cap:,.0f}", math.log(market_cap)
        )
    else:
        df["log_market_cap"] = np.nan
        logger.warning(
            "marketCap unavailable or invalid for '%s' - log_market_cap set to NaN.", ticker
        )

    # ------------------------------------------------------------------
    # Beta (market sensitivity, real-valued static covariate)
    # ------------------------------------------------------------------
    beta = info.get("beta", STATIC_INFO_FIELDS["beta"])
    df["beta"] = float(beta) if beta is not None else np.nan

    logger.info(
        "add_static_metadata complete - sector='%s', industry='%s', "
        "log_market_cap=%s, beta=%s",
        df["sector"].iloc[0],
        df["industry"].iloc[0],
        f"{df['log_market_cap'].iloc[0]:.4f}" if pd.notna(df["log_market_cap"].iloc[0]) else "NaN",
        f"{df['beta'].iloc[0]:.4f}" if pd.notna(df["beta"].iloc[0]) else "NaN",
    )

    # ── STATIC COLUMN NaN FILL ────────────────────────────────────────────
    # Static columns are the same value in every row.
    # If any are NaN, dropna() will delete the entire DataFrame.
    # Fill with safe defaults before dropna().

    static_defaults = {
        "beta":           1.0,      # market-neutral beta
        "log_market_cap": df["log_market_cap"].median()
                          if "log_market_cap" in df.columns
                          and not df["log_market_cap"].isna().all()
                          else 25.0,
        "sector_encoded": 0,
        "industry_encoded": 0,
    }
    for col, default in static_defaults.items():
        if col in df.columns:
            df[col] = df[col].fillna(default)

    # Drop NaN only from CRITICAL OHLCV columns
    critical_cols = ["Open", "High", "Low", "Close"]
    df = df.dropna(subset=[c for c in critical_cols if c in df.columns])

    logger.info(f"After NaN fill + dropna: {len(df)} rows remain for {ticker}")

    return df

# ---------------------------------------------------------------------------
# 3. validate_data
# ---------------------------------------------------------------------------
def validate_data(df: pd.DataFrame) -> dict[str, Any]:
    """Run a data-quality audit on the merged pipeline DataFrame.

    Checks performed
    ----------------
    * **NaN percentage** per column - warns if any column exceeds 5 % missing.
    * **Sufficient history** - warns if the DataFrame has fewer than 365 rows.
    * **Price anomalies** - flags rows where the absolute single-day Close
      return exceeds 50 % (potential data errors / corporate events).

    Parameters
    ----------
    df : pd.DataFrame
        The DataFrame to validate (typically after :func:`add_static_metadata`).

    Returns
    -------
    dict[str, Any]
        Validation report with the following keys:

        ``total_rows`` : int
            Number of rows in *df*.
        ``total_columns`` : int
            Number of columns in *df*.
        ``nan_pct_per_column`` : dict[str, float]
            Mapping of column name -> NaN percentage (0–100).
        ``columns_above_nan_threshold`` : list[str]
            Columns whose NaN % exceeds 5 %.
        ``sufficient_history`` : bool
            True if ``total_rows >= 365``.
        ``price_anomaly_dates`` : list[str]
            ISO-formatted dates where Close moved > 50 % in a single session.
        ``passed`` : bool
            True only when *all* checks pass with no warnings.
    """
    report: dict[str, Any] = {
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "nan_pct_per_column": {},
        "columns_above_nan_threshold": [],
        "sufficient_history": False,
        "price_anomaly_dates": [],
        "passed": True,
    }

    NAN_WARN_THRESHOLD = 5.0      # percent
    MIN_HISTORY_ROWS = 365
    ANOMALY_RETURN_THRESHOLD = 0.50   # 50 % single-day move

    # ------------------------------------------------------------------
    # Check 1 - NaN percentage per column
    # ------------------------------------------------------------------
    nan_pct: dict[str, float] = {}
    problem_cols: list[str] = []

    for col in df.columns:
        pct = df[col].isna().mean() * 100.0
        nan_pct[col] = round(pct, 2)
        if pct > NAN_WARN_THRESHOLD:
            problem_cols.append(col)
            logger.warning(
                "Column '%s' has %.2f%% NaN values (threshold: %.0f%%).",
                col, pct, NAN_WARN_THRESHOLD,
            )

    report["nan_pct_per_column"] = nan_pct
    report["columns_above_nan_threshold"] = problem_cols
    if problem_cols:
        report["passed"] = False

    # ------------------------------------------------------------------
    # Check 2 - Sufficient history
    # ------------------------------------------------------------------
    has_enough = len(df) >= MIN_HISTORY_ROWS
    report["sufficient_history"] = has_enough
    if not has_enough:
        logger.warning(
            "Insufficient history: %d rows (minimum recommended: %d).",
            len(df), MIN_HISTORY_ROWS,
        )
        report["passed"] = False
    else:
        logger.info("History check passed: %d rows ≥ %d.", len(df), MIN_HISTORY_ROWS)

    # ------------------------------------------------------------------
    # Check 3 - Price anomalies (>50% single-day Close move)
    # ------------------------------------------------------------------
    anomaly_dates: list[str] = []
    if "Close" in df.columns:
        close_numeric = pd.to_numeric(df["Close"], errors="coerce")
        daily_returns = close_numeric.pct_change().abs()
        anomaly_mask = daily_returns > ANOMALY_RETURN_THRESHOLD
        anomaly_idx = df.index[anomaly_mask]

        if not anomaly_idx.empty:
            anomaly_dates = [str(d)[:10] for d in anomaly_idx.tolist()]
            logger.warning(
                "Price anomalies detected on %d date(s): %s",
                len(anomaly_dates),
                anomaly_dates[:5],   # show first 5 to avoid log spam
            )
            report["passed"] = False
        else:
            logger.info("No price anomalies detected (threshold: >%.0f%% single-day move).",
                        ANOMALY_RETURN_THRESHOLD * 100)
    else:
        logger.warning("'Close' column not found - skipping price anomaly check.")

    report["price_anomaly_dates"] = anomaly_dates

    status = "✅ PASSED" if report["passed"] else "⚠️  WARNINGS RAISED"
    logger.info("Validation complete - %s | rows=%d", status, report["total_rows"])
    return report


# ---------------------------------------------------------------------------
# __main__ - quick smoke-test with AAPL
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import pprint

    TEST_TICKER = "AAPL"
    print(f"\n{'='*60}")
    print(f"  Apex AI - data_pipeline.py smoke test  [{TEST_TICKER}]")
    print(f"{'='*60}\n")

    # 1. Fetch multi-modal data
    print("▶ fetch_multi_modal ...")
    df_raw = fetch_multi_modal(TEST_TICKER, period="2y")
    print(f"  Shape after fetch  : {df_raw.shape}")
    print(f"  Columns            : {list(df_raw.columns)}")
    print(f"\n  Head (5 rows):\n{df_raw.head()}\n")

    # 2. Add static metadata
    print("▶ add_static_metadata ...")
    df_enriched = add_static_metadata(df_raw, TEST_TICKER)
    print(f"  Shape after enrich : {df_enriched.shape}")
    print(f"  Columns            : {list(df_enriched.columns)}")
    meta_preview = df_enriched[["sector", "industry", "log_market_cap", "beta"]].iloc[0]
    print(f"\n  Static metadata (row 0):\n{meta_preview}\n")

    # 3. Validate
    print("▶ validate_data ...")
    report = validate_data(df_enriched)
    print("\n  Validation Report:")
    pprint.pprint(report, indent=4, width=80)

    print(f"\n{'='*60}")
    print("  Smoke test complete.")
    print(f"{'='*60}\n")
