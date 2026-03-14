"""
features.py
===========
Apex AI - Phase 2: TFT Feature Engineering Pipeline
----------------------------------------------------
Builds the complete feature matrix required by a Temporal Fusion Transformer,
assembled from cleaned OHLCV + macro data (output of data_pipeline.py and
denoising.py).

FEATURE TYPE ANNOTATIONS (used directly in pytorch-forecasting TFT config)
---------------------------------------------------------------------------
  KNOWN_FUTURE   - values known at inference time (calendar, earnings dates)
  UNKNOWN        - values not known in advance (price-derived, volume, macro)
  STATIC         - constant per entity (sector, log_market_cap, beta, ticker)

API
---
    add_technical_indicators(df)           -> df + 15 indicator columns
    add_lagged_features(df, lags)          -> df + lag/rolling columns
    add_time_features(df)                  -> df + calendar KNOWN_FUTURE cols
    add_integer_time_index(df, ticker)     -> df + time_idx + ticker cols
    build_all_features(df, ticker)         -> final ready-to-train df

Packages required: ta, pandas, numpy
Author : Apex AI Team
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import pandas as pd

try:
    import ta as _ta                         # pip install ta  (Python 3.10 compatible)
    _HAS_TA = True
except ImportError:
    _HAS_TA = False
    logging.getLogger("apex_ai.features").warning(
        "'ta' library not installed - technical indicators will be skipped. "
        "Run: pip install ta"
    )

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("apex_ai.features")

# ---------------------------------------------------------------------------
# Feature-type registry
# Each entry: column_name -> "known_future" | "unknown" | "static"
# Build this incrementally so the TFT config can read it at runtime.
# ---------------------------------------------------------------------------
FEATURE_TYPES: dict[str, str] = {}


def _register(col: str, ftype: str) -> None:
    """Register a column in the global FEATURE_TYPES dict."""
    FEATURE_TYPES[col] = ftype


# ---------------------------------------------------------------------------
# 1. add_technical_indicators
# ---------------------------------------------------------------------------
def add_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add 15 technical indicators using the pandas-ta library.

    All indicators are tagged as ``unknown`` - they are derived from past
    price/volume and are not known in advance.

    Indicators added
    ----------------
    +----------------------------+----------------------+------------------------+
    | Indicator                  | Output columns       | Source columns         |
    +============================+======================+========================+
    | RSI (14)                   | RSI_14               | Close                  |
    | MACD (12,26,9)             | MACD_12_26_9,        | Close                  |
    |                            | MACDh_12_26_9,       |                        |
    |                            | MACDs_12_26_9        |                        |
    | Bollinger Bands (20,2)     | BBL_20_2, BBM_20_2,  | Close                  |
    |                            | BBU_20_2, BBB_20_2   |                        |
    | ATR (14)                   | ATR_14               | High, Low, Close       |
    | OBV                        | OBV                  | Close, Volume          |
    | Stochastic (14,3)          | STOCHk_14_3_3,       | High, Low, Close       |
    |                            | STOCHd_14_3_3        |                        |
    +----------------------------+----------------------+------------------------+

    Parameters
    ----------
    df : pd.DataFrame
        Must contain at minimum: ``Open``, ``High``, ``Low``, ``Close``,
        ``Volume`` with a ``DatetimeIndex``.

    Returns
    -------
    pd.DataFrame
        Input df extended with indicator columns.
    """
    df = df.copy()

    if not _HAS_TA:
        logger.warning("'ta' library unavailable - skipping technical indicators.")
        return df

    c   = df["Close"]
    h   = df["High"]
    lo  = df["Low"]
    vol = df["Volume"]

    # ── RSI (14) -> RSI_14 ────────────────────────────────────────────────
    df["RSI_14"] = _ta.momentum.RSIIndicator(close=c, window=14).rsi()
    _register("RSI_14", "unknown")

    # ── MACD (12,26,9) -> MACD_12_26_9 / MACDh / MACDs ───────────────────
    _macd = _ta.trend.MACD(close=c, window_fast=12, window_slow=26, window_sign=9)
    df["MACD_12_26_9"]  = _macd.macd()
    df["MACDh_12_26_9"] = _macd.macd_diff()    # histogram
    df["MACDs_12_26_9"] = _macd.macd_signal()
    for col in ["MACD_12_26_9", "MACDh_12_26_9", "MACDs_12_26_9"]:
        _register(col, "unknown")

    # ── Bollinger Bands (20,2) -> BBL/BBM/BBU/BBB ─────────────────────────
    _bb = _ta.volatility.BollingerBands(close=c, window=20, window_dev=2)
    df["BBL_20_2"] = _bb.bollinger_lband()
    df["BBM_20_2"] = _bb.bollinger_mavg()
    df["BBU_20_2"] = _bb.bollinger_hband()
    # Bandwidth = (upper - lower) / middle  (same as pandas-ta BBB)
    df["BBB_20_2"] = _bb.bollinger_wband()      # already as % width
    for col in ["BBL_20_2", "BBM_20_2", "BBU_20_2", "BBB_20_2"]:
        _register(col, "unknown")

    # ── ATR (14) -> ATR_14 ────────────────────────────────────────────────
    df["ATR_14"] = _ta.volatility.AverageTrueRange(
        high=h, low=lo, close=c, window=14
    ).average_true_range()
    _register("ATR_14", "unknown")

    # ── OBV -> OBV ────────────────────────────────────────────────────────
    df["OBV"] = _ta.volume.OnBalanceVolumeIndicator(
        close=c, volume=vol
    ).on_balance_volume()
    _register("OBV", "unknown")

    # ── Stochastic (14,3) -> STOCHk_14_3_3 / STOCHd_14_3_3 ───────────────
    _stoch = _ta.momentum.StochasticOscillator(
        high=h, low=lo, close=c, window=14, smooth_window=3
    )
    df["STOCHk_14_3_3"] = _stoch.stoch()
    df["STOCHd_14_3_3"] = _stoch.stoch_signal()
    for col in ["STOCHk_14_3_3", "STOCHd_14_3_3"]:
        _register(col, "unknown")

    added = [c for c in df.columns if c in FEATURE_TYPES]
    logger.info("add_technical_indicators: added %d indicator columns.", len(added))
    return df


# ---------------------------------------------------------------------------
# 2. add_lagged_features
# ---------------------------------------------------------------------------
def add_lagged_features(
    df: pd.DataFrame,
    lags: list[int] = [1, 3, 5],
) -> pd.DataFrame:
    """Add lagged and rolling features for key indicators.

    All lag/rolling features are tagged as ``unknown``.

    Columns added
    -------------
    Lagged (shifted copies):
        ``RSI_14_lag{n}``, ``MACD_12_26_9_lag{n}``, ``ATR_14_lag{n}``
        for each n in *lags*.

    Rolling:
        ``RSI_14_rolling_mean_5`` - 5-day rolling mean of RSI_14.
        ``Volume_ratio``          - today's Volume / 20-day mean Volume.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain ``RSI_14``, ``MACD_12_26_9``, ``ATR_14``, ``Volume``
        where available.
    lags : list[int], optional
        Lag periods.  Defaults to ``[1, 3, 5]``.

    Returns
    -------
    pd.DataFrame
        Input df extended with lag and rolling columns.
    """
    df = df.copy()

    LAG_SOURCES = ["RSI_14", "MACD_12_26_9", "ATR_14"]

    for src in LAG_SOURCES:
        if src not in df.columns:
            logger.debug("add_lagged_features: '%s' not in df - skipping.", src)
            continue
        for lag in lags:
            col = f"{src}_lag{lag}"
            df[col] = df[src].shift(lag)
            _register(col, "unknown")

    # ── RSI 5-day rolling mean ────────────────────────────────────────────
    if "RSI_14" in df.columns:
        df["RSI_14_rolling_mean_5"] = df["RSI_14"].rolling(5).mean()
        _register("RSI_14_rolling_mean_5", "unknown")

    # ── Volume ratio: today / 20-day MA ──────────────────────────────────
    if "Volume" in df.columns:
        vol_ma20 = df["Volume"].rolling(20).mean()
        df["Volume_ratio"] = df["Volume"] / (vol_ma20 + 1e-9)
        _register("Volume_ratio", "unknown")

    n_added = sum(1 for c in FEATURE_TYPES if "lag" in c or c in
                  ["RSI_14_rolling_mean_5", "Volume_ratio"])
    logger.info("add_lagged_features: added lagged/rolling columns (lags=%s).", lags)
    return df


# ---------------------------------------------------------------------------
# 3. add_time_features
# ---------------------------------------------------------------------------
def add_time_features(
    df: pd.DataFrame,
    earnings_dates: Optional[list] = None,
) -> pd.DataFrame:
    """Add calendar-based time features.

    These are **KNOWN_FUTURE** features - they are deterministic and known
    at inference time, which is a key advantage in TFT's architecture
    (known-future covariates get a special encoder treatment).

    Columns added
    -------------
    ``day_of_week``       - integer 0 (Mon) ... 4 (Fri).
    ``month``             - integer 1 ... 12.
    ``quarter``           - integer 1 ... 4.
    ``is_month_end``      - 1 on the last trading day of a month, else 0.
    ``is_quarter_end``    - 1 on the last trading day of a quarter, else 0.
    ``days_to_earnings``  - calendar days to the next earnings date; 0 if
                           *earnings_dates* is not provided.

    Parameters
    ----------
    df : pd.DataFrame
        Must have a ``DatetimeIndex``.
    earnings_dates : list, optional
        List of ``datetime``-like earnings dates for the ticker.
        If None, ``days_to_earnings`` is set to 0 (a safe default).

    Returns
    -------
    pd.DataFrame
        Input df extended with calendar columns.
    """
    df = df.copy()
    idx = pd.DatetimeIndex(df.index)

    df["day_of_week"]    = idx.dayofweek.astype(np.int8)
    df["month"]          = idx.month.astype(np.int8)
    df["quarter"]        = idx.quarter.astype(np.int8)
    df["is_month_end"]   = idx.is_month_end.astype(np.int8)
    df["is_quarter_end"] = idx.is_quarter_end.astype(np.int8)

    # ── Days to next earnings ─────────────────────────────────────────────
    if earnings_dates:
        earnings_ts = pd.to_datetime(earnings_dates)
        def _days_to_next(date: pd.Timestamp) -> int:
            future = earnings_ts[earnings_ts >= date]
            return int((future.min() - date).days) if len(future) else 0
        df["days_to_earnings"] = [_days_to_next(d) for d in idx]
    else:
        df["days_to_earnings"] = 0

    for col in ["day_of_week", "month", "quarter",
                "is_month_end", "is_quarter_end", "days_to_earnings"]:
        _register(col, "known_future")

    logger.info("add_time_features: added 6 known-future calendar columns.")
    return df


# ---------------------------------------------------------------------------
# 4. add_integer_time_index
# ---------------------------------------------------------------------------
def add_integer_time_index(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    """Add ``time_idx`` and ``ticker`` columns required by pytorch-forecasting.

    ``pytorch-forecasting``'s ``TimeSeriesDataSet`` requires:
      * ``time_idx``  - a monotonically increasing integer (0, 1, 2, ...).
      * a group column (``ticker``) that acts as the entity identifier.

    Both are registered as ``static`` since they are invariant to time or
    are simply administrative identifiers.

    Parameters
    ----------
    df : pd.DataFrame
        Any feature-enriched DataFrame with a sorted DatetimeIndex.
    ticker : str
        Ticker symbol string, e.g. ``"AAPL"`` or ``"RELIANCE.NS"``.

    Returns
    -------
    pd.DataFrame
        Input df with ``time_idx`` (int64) and ``ticker`` (str) prepended.
    """
    df = df.copy()
    df.sort_index(inplace=True)   # ensure chronological order
    df.insert(0, "time_idx", np.arange(len(df), dtype=np.int64))
    df.insert(1, "ticker", ticker)
    _register("time_idx", "static")
    _register("ticker",   "static")
    logger.info("add_integer_time_index: time_idx 0...%d, ticker='%s'.", len(df)-1, ticker)
    return df


# ---------------------------------------------------------------------------
# 5. build_all_features
# ---------------------------------------------------------------------------
def build_all_features(df: pd.DataFrame, ticker: str) -> pd.DataFrame:
    """Run the full TFT feature-engineering pipeline in the correct order.

    Execution order
    ---------------
    1. :func:`add_technical_indicators`  - price/volume-derived indicators
    2. :func:`add_lagged_features`       - lag / rolling windows
    3. :func:`add_time_features`         - calendar known-future features
    4. :func:`add_integer_time_index`    - pytorch-forecasting essentials
    5. ``dropna()``                      - remove warm-up rows (indicator lag)

    Static columns already in *df* (from ``data_pipeline.add_static_metadata``)
    - ``sector``, ``industry``, ``log_market_cap``, ``beta`` - are registered
    as ``static`` if present.

    Parameters
    ----------
    df : pd.DataFrame
        Cleaned OHLCV + macro DataFrame (output of
        ``data_pipeline.fetch_multi_modal`` + ``add_static_metadata`` +
        ``denoising.apply_denoising_to_dataframe``).
    ticker : str
        Ticker symbol, forwarded to :func:`add_integer_time_index`.

    Returns
    -------
    pd.DataFrame
        Ready-to-train feature DataFrame with all NaN rows dropped.
        Also prints feature count and shape.
    """
    # Register any static metadata columns that arrived from data_pipeline
    for col, ftype in [
        ("sector",          "static"),
        ("industry",        "static"),
        ("log_market_cap",  "static"),
        ("beta",            "static"),
        ("Close_denoised",  "unknown"),
        ("Close_fracdiff",  "unknown"),
        ("VIX",             "unknown"),
        ("SP500",           "unknown"),
        ("NSEI",            "unknown"),
        ("VIX_ret",         "unknown"),
    ]:
        if col in df.columns:
            _register(col, ftype)

    rows_before = len(df)

    df = add_technical_indicators(df)
    df = add_lagged_features(df)
    df = add_time_features(df)
    df = add_integer_time_index(df, ticker)
    df = df.dropna()

    rows_after = len(df)
    n_features = len(df.columns)

    # ── Summary print ────────────────────────────────────────────────────
    n_unknown  = sum(1 for v in FEATURE_TYPES.values() if v == "unknown")
    n_known    = sum(1 for v in FEATURE_TYPES.values() if v == "known_future")
    n_static   = sum(1 for v in FEATURE_TYPES.values() if v == "static")

    print(f"\n  {'─'*54}")
    print(f"  Apex AI - Feature Matrix Summary  [{ticker}]")
    print(f"  {'─'*54}")
    print(f"  Total columns     : {n_features}")
    print(f"  Rows (after dropna): {rows_after}  ({rows_before - rows_after} warm-up rows dropped)")
    print(f"  {'─'*54}")
    print(f"  UNKNOWN        (time-varying, not known in advance): {n_unknown}")
    print(f"  KNOWN_FUTURE   (time-varying, known at inference)  : {n_known}")
    print(f"  STATIC         (constant per entity)               : {n_static}")
    print(f"  {'─'*54}\n")

    logger.info(
        "build_all_features: ticker=%s, shape=%s, unknown=%d, known=%d, static=%d",
        ticker, df.shape, n_unknown, n_known, n_static,
    )
    return df


# ---------------------------------------------------------------------------
# Helpers - expose FEATURE_TYPES dict split by type for TFT config
# ---------------------------------------------------------------------------
def get_unknown_features() -> list[str]:
    """Return list of UNKNOWN feature column names (time-varying unknowns)."""
    return [c for c, t in FEATURE_TYPES.items() if t == "unknown"]

def get_known_future_features() -> list[str]:
    """Return list of KNOWN_FUTURE feature column names."""
    return [c for c, t in FEATURE_TYPES.items() if t == "known_future"]

def get_static_features() -> list[str]:
    """Return list of STATIC feature column names."""
    return [c for c, t in FEATURE_TYPES.items() if t == "static"]


# ---------------------------------------------------------------------------
# __main__ - smoke-test with synthetic OHLCV data
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"\n{'='*60}")
    print("  Apex AI - features.py smoke test")
    print(f"{'='*60}\n")

    # ── Try real AAPL data; fall back to synthetic ─────────────────────
    try:
        import yfinance as yf
        print("  Fetching AAPL from yfinance...")
        raw = yf.download("AAPL", period="3y", interval="1d",
                          progress=False, auto_adjust=True)
        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = raw.columns.get_level_values(0)
        df_input = raw[["Open","High","Low","Close","Volume"]].dropna().copy()
        TICKER = "AAPL"
        print(f"  Loaded {len(df_input)} rows of AAPL data.\n")
    except Exception as exc:
        print(f"  yfinance unavailable ({exc}). Using synthetic data.\n")
        np.random.seed(42)
        n = 600
        close = np.cumsum(np.random.randn(n) * 0.5) + 150
        df_input = pd.DataFrame({
            "Open":   close * (1 + np.random.randn(n)*0.003),
            "High":   close * (1 + np.abs(np.random.randn(n))*0.005),
            "Low":    close * (1 - np.abs(np.random.randn(n))*0.005),
            "Close":  close,
            "Volume": np.random.randint(1_000_000, 10_000_000, n).astype(float),
        }, index=pd.date_range("2021-01-01", periods=n, freq="B"))
        TICKER = "SYNTHETIC"

    # ── Add static metadata placeholders ──────────────────────────────
    df_input["sector"]         = "Technology"
    df_input["industry"]       = "Software"
    df_input["log_market_cap"] = np.log(3e12)
    df_input["beta"]           = 1.2
    df_input["Close_denoised"] = df_input["Close"]   # pretend denoised

    # ── Build all features ────────────────────────────────────────────
    df_final = build_all_features(df_input, ticker=TICKER)

    # ── Print column groups ────────────────────────────────────────────
    print(f"  {'─'*54}")
    print(f"  UNKNOWN features ({len(get_unknown_features())}):")
    for c in sorted(get_unknown_features()):
        print(f"    • {c}")

    print(f"\n  KNOWN_FUTURE features ({len(get_known_future_features())}):")
    for c in sorted(get_known_future_features()):
        print(f"    • {c}")

    print(f"\n  STATIC features ({len(get_static_features())}):")
    for c in sorted(get_static_features()):
        print(f"    • {c}")

    print(f"\n  {'─'*54}")
    print(f"  Final DataFrame shape: {df_final.shape}")
    print(f"  Head (3 rows):")
    print(df_final[["time_idx","ticker","Close","RSI_14","day_of_week"]].head(3).to_string())
    print(f"\n{'='*60}")
    print("  Smoke test complete.")
    print(f"{'='*60}\n")


# -- Adapter for main.py v3.0 -------------------------------------------------

# Exact 36 features the Keras GRU/TCN/MAG models were trained on.
# Order must match training order. Do NOT use select_dtypes — that picks up
# extra columns (Open, PE_Ratio, EPS, Debt_to_Equity …) → shape mismatch.
# Model expects input shape (None, 60, 36).
_KERAS_FEATURE_COLS: list[str] = [
    # OHLCV + macro (7 cols — Open excluded, it was not in the training set)
    "High", "Low", "Close", "Volume", "VIX", "SP500", "NSEI",
    # Technical indicators (12 cols)
    "RSI_14",
    "MACD_12_26_9", "MACDh_12_26_9", "MACDs_12_26_9",
    "BBL_20_2", "BBM_20_2", "BBU_20_2", "BBB_20_2",
    "ATR_14",
    "OBV",
    "STOCHk_14_3_3", "STOCHd_14_3_3",
    # Lag features (9 cols = 3 sources × 3 lags)
    "RSI_14_lag1", "RSI_14_lag3", "RSI_14_lag5",
    "MACD_12_26_9_lag1", "MACD_12_26_9_lag3", "MACD_12_26_9_lag5",
    "ATR_14_lag1", "ATR_14_lag3", "ATR_14_lag5",
    # Rolling (2 cols)
    "RSI_14_rolling_mean_5",
    "Volume_ratio",
    # Calendar / known-future (6 cols)
    "day_of_week", "month", "quarter",
    "is_month_end", "is_quarter_end", "days_to_earnings",
]
# Sanity check at import time
assert len(_KERAS_FEATURE_COLS) == 36, (
    f"_KERAS_FEATURE_COLS has {len(_KERAS_FEATURE_COLS)} entries, expected 36"
)


def build_features(df, ticker: str = "UNKNOWN"):
    """
    Adapter expected by main.py v3.0.
      X_raw, feature_cols = build_features(df, ticker)

    Runs build_all_features(), then selects exactly the 36 columns the
    Keras models were trained on.  Returns:
      - X_raw:        numpy float32 array of shape (n_rows, 36)
      - feature_cols: list[str] of the 36 column names

    Parameters
    ----------
    df : pd.DataFrame
        Cleaned OHLCV + macro DataFrame (output of fetch_data).
    ticker : str
        Ticker symbol forwarded to build_all_features for logging.
    """
    result_df = build_all_features(df, ticker)

    # Select only the columns the Keras models know about
    available = [c for c in _KERAS_FEATURE_COLS if c in result_df.columns]
    missing   = [c for c in _KERAS_FEATURE_COLS if c not in result_df.columns]

    if missing:
        logger.warning(
            "build_features: %d expected columns missing from feature df: %s. "
            "Proceeding with %d available columns.",
            len(missing), missing, len(available),
        )

    if len(available) == 0:
        logger.error("build_features: no valid feature columns — returning empty array.")
        return None, []

    final_df = result_df[available].select_dtypes(include=["number"])
    return final_df.values.astype("float32"), list(final_df.columns)

