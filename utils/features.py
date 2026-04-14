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
from utils.yf_utils import download_yf
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
    """Add 15 technical indicators. Uses 'ta' library if available, otherwise manual fallbacks."""
    df = df.copy()

    # Ensure we have Series, not DataFrames (in case of duplicate columns)
    def _to_series(s):
        return s.iloc[:, 0] if isinstance(s, pd.DataFrame) else s

    c   = _to_series(df["Close"])
    h   = _to_series(df["High"])
    lo  = _to_series(df["Low"])
    vol = _to_series(df["Volume"])

    if _HAS_TA:
        # ── RSI (14) -> RSI_14 ────────────────────────────────────────────────
        df["RSI_14"] = _ta.momentum.RSIIndicator(close=c, window=14).rsi()
        _register("RSI_14", "unknown")

        # ── MACD (12,26,9) -> MACD_12_26_9 / MACDh / MACDs ───────────────────
        _macd = _ta.trend.MACD(close=c, window_fast=12, window_slow=26, window_sign=9)
        df["MACD_12_26_9"]  = _macd.macd()
        df["MACDh_12_26_9"] = _macd.macd_diff()
        df["MACDs_12_26_9"] = _macd.macd_signal()
        for col in ["MACD_12_26_9", "MACDh_12_26_9", "MACDs_12_26_9"]:
            _register(col, "unknown")

        # ── Bollinger Bands (20,2) -> BBL/BBM/BBU/BBB ─────────────────────────
        _bb = _ta.volatility.BollingerBands(close=c, window=20, window_dev=2)
        df["BBL_20_2"] = _bb.bollinger_lband()
        df["BBM_20_2"] = _bb.bollinger_mavg()
        df["BBU_20_2"] = _bb.bollinger_hband()
        df["BBB_20_2"] = _bb.bollinger_wband()
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
            
    else:
        logger.warning("Using MANUAL indicator fallbacks (ta library missing).")
        # ── RSI Manual Fallback ───────────────────────────────────────────
        delta = c.diff()
        up = delta.clip(lower=0)
        down = -1 * delta.clip(upper=0)
        ema_up = up.ewm(com=13, adjust=False).mean()
        ema_down = down.ewm(com=13, adjust=False).mean()
        rs = ema_up / (ema_down + 1e-9)
        df["RSI_14"] = 100 - (100 / (1 + rs))
        _register("RSI_14", "unknown")

        # ── MACD Manual Fallback ──────────────────────────────────────────
        ema12 = c.ewm(span=12, adjust=False).mean()
        ema26 = c.ewm(span=26, adjust=False).mean()
        df["MACD_12_26_9"] = ema12 - ema26
        df["MACDs_12_26_9"] = df["MACD_12_26_9"].ewm(span=9, adjust=False).mean()
        df["MACDh_12_26_9"] = df["MACD_12_26_9"] - df["MACDs_12_26_9"]
        for col in ["MACD_12_26_9", "MACDh_12_26_9", "MACDs_12_26_9"]:
            _register(col, "unknown")

        # ── Bollinger Bands Manual Fallback ───────────────────────────────
        df["BBM_20_2"] = c.rolling(window=20).mean()
        std = c.rolling(window=20).std()
        df["BBU_20_2"] = df["BBM_20_2"] + (std * 2)
        df["BBL_20_2"] = df["BBM_20_2"] - (std * 2)
        df["BBB_20_2"] = (df["BBU_20_2"] - df["BBL_20_2"]) / (df["BBM_20_2"] + 1e-9)
        for col in ["BBL_20_2", "BBM_20_2", "BBU_20_2", "BBB_20_2"]:
            _register(col, "unknown")

        # ── ATR Manual Fallback ──────────────────────────────────────────
        tr = np.maximum(h - lo, np.maximum(abs(h - c.shift(1)), abs(lo - c.shift(1))))
        df["ATR_14"] = tr.rolling(window=14).mean()
        _register("ATR_14", "unknown")

        # ── OBV Manual Fallback ──────────────────────────────────────────
        df["OBV"] = (np.sign(c.diff()) * vol).fillna(0).cumsum()
        _register("OBV", "unknown")

        # ── Stochastic Manual Fallback ────────────────────────────────────
        low_min  = lo.rolling(window=14).min()
        high_max = h.rolling(window=14).max()
        df["STOCHk_14_3_3"] = 100 * (c - low_min) / (high_max - low_min + 1e-9)
        df["STOCHd_14_3_3"] = df["STOCHk_14_3_3"].rolling(window=3).mean()
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
    """Add lagged and rolling features for key indicators."""
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
    """Add calendar-based time features."""
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
    """Add ``time_idx`` and ``ticker`` columns required by pytorch-forecasting."""
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
    """Run the full TFT feature-engineering pipeline in the correct order."""
    # ── Dedup columns immediately ────────────────────────────────────────
    df = df.loc[:, ~df.columns.duplicated()].copy()

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

    # ── 1. Safe Fill for Static/Macro columns before dropna ─────────────────
    # If a ticker is missing beta or sector, we shouldn't drop the whole history.
    static_macro_defaults = {
        "beta": 1.0,
        "log_market_cap": df["log_market_cap"].median() if "log_market_cap" in df.columns else 25.0,
        "sector": "Unknown",
        "industry": "Unknown",
        "VIX": 15.0,     # Typical calm VIX
        "SP500": df["SP500"].median() if "SP500" in df.columns else 4000.0,
        "NSEI": df["NSEI"].median() if "NSEI" in df.columns else 20000.0,
    }
    for col, default in static_macro_defaults.items():
        if col in df.columns:
            df[col] = df[col].fillna(default)

    # ── 2. Add features in order ───────────────────────────────────────────
    df = add_technical_indicators(df)
    df = add_lagged_features(df)
    df = add_time_features(df)
    df = add_integer_time_index(df, ticker)

    # ── 3. Selective dropna ───────────────────────────────────────────────
    # We only drop rows that have NaNs in core price/technical columns.
    # We allow some columns to have NaNs if they are non-critical.
    critical_cols = ["Close", "RSI_14", "MACD_12_26_9", "ATR_14"]
    df = df.dropna(subset=[c for c in critical_cols if c in df.columns])

    rows_after = len(df)
    n_features = len(df.columns)

    # ── Summary print ────────────────────────────────────────────────────
    n_unknown  = sum(1 for v in FEATURE_TYPES.values() if v == "unknown")
    n_known    = sum(1 for v in FEATURE_TYPES.values() if v == "known_future")
    n_static   = sum(1 for v in FEATURE_TYPES.values() if v == "static")

    print(f"\n  {'-'*54}")
    print(f"  Apex AI - Feature Matrix Summary  [{ticker}]")
    print(f"  {'-'*54}")
    print(f"  Total columns     : {n_features}")
    print(f"  Rows (after dropna): {rows_after}  ({rows_before - rows_after} warm-up rows dropped)")
    print(f"  {'-'*54}")
    print(f"  UNKNOWN        (time-varying, not known in advance): {n_unknown}")
    print(f"  KNOWN_FUTURE   (time-varying, known at inference)  : {n_known}")
    print(f"  STATIC         (constant per entity)               : {n_static}")
    print(f"  {'-'*54}\n")

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
        from utils.yf_utils import download_yf
        print("  Fetching AAPL from yfinance...")
        raw = download_yf("AAPL", period="3y", interval="1d",
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
    """
    result_df = build_all_features(df, ticker)

    # 1. Deduplicate columns (redundant but safe)
    result_df = result_df.loc[:, ~result_df.columns.duplicated()]

    # 2. Reindex to EXACTLY the 36 columns expected by Keras, filling missing with 0.0
    # This prevents the "X has 33 features, but RobustScaler is expecting 36" crash.
    final_df = result_df.reindex(columns=_KERAS_FEATURE_COLS, fill_value=0.0)

    # 3. Ensure all columns are numeric, handle inf, and fill remaining NaNs
    final_df = final_df.apply(pd.to_numeric, errors="coerce")
    final_df = final_df.replace([np.inf, -np.inf], np.nan).fillna(0.0)

    return final_df.values.astype("float32"), list(final_df.columns)
