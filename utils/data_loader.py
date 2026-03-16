import yfinance as yf
import pandas as pd
from sklearn.preprocessing import RobustScaler
import numpy as np

# Phase-2 pipeline: multi-modal fetch + static metadata + validation
from utils.data_pipeline import fetch_multi_modal, add_static_metadata, validate_data
from utils.constants import NSE_SCREENER_TICKERS

def normalize_ticker(ticker: str) -> str:
    """Normalize ticker symbols for yfinance."""
    t = ticker.upper().strip()
    
    # 1. Handle common Indian stocks missing .NS suffix
    # Strip .NS if it exists to normalize search
    clean_t = t.replace(".NS", "").replace(".BO", "")
    
    # Check if the clean symbol is in our known NSE list
    nse_symbols = [s.split(".")[0] for s in NSE_SCREENER_TICKERS]
    if clean_t in nse_symbols:
        return f"{clean_t}.NS"
        
    return t

def fetch_data(ticker: str, period: str = "2y", interval: str = "1d") -> pd.DataFrame | None:
    """Fetch OHLCV data enriched with macro indices and static company metadata.

    For daily resolution (interval='1d'):
        - Uses :func:`~utils.data_pipeline.fetch_multi_modal` to download OHLCV
          plus VIX, SP500, and NSEI in one round-trip.
        - Calls :func:`~utils.data_pipeline.add_static_metadata` to attach sector,
          industry, log_market_cap, and beta as constant columns.
        - Retains PE_Ratio, EPS, and Debt_to_Equity from yfinance Ticker.info.

    For intraday intervals (e.g. '5m', '15m'):
        - Falls back to a direct yf.download (macro indices are not available
          at sub-daily resolution) and skips static metadata.

    Returns None on any unrecoverable error.
    """
    ticker = normalize_ticker(ticker)
    try:
        # ── Intraday fast-path (no macro / metadata available sub-daily) ──────
        if interval != "1d":
            data = yf.download(
                ticker, period=period, interval=interval,
                progress=False, group_by='column'
            )
            if data is None or data.empty:
                return None
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)
            data = data.ffill().bfill()
            return data

        # ── Daily path: full Phase-2 pipeline ────────────────────────────────
        # 1. Multi-modal fetch (OHLCV + VIX + SP500 + NSEI)
        data = fetch_multi_modal(ticker, period=period)

        # 2. Static metadata (sector, industry, log_market_cap, beta)
        data = add_static_metadata(data, ticker)

        # 3. Robust cleaning  (fundamental ratios removed — they hit the Yahoo
        #    crumb endpoint causing HTTP 401 errors and produce all-NaN columns
        #    that wipe out every row in dropna().  They are not used as features.)
        data = data.ffill().bfill()
        return data

    except Exception as e:
        print(f"Critical fetch error for {ticker}: {e}")
        return None

def clean_data(df):
    """Secondary cleaning pass for indicators."""
    return df.ffill().dropna()

def normalize_data(df, feature_columns, split_ratio=0.8):
    """
    Leakage-free normalization: Fit on training set only.
    Returns: scaler, scaled_data (float32)
    """
    data = df[feature_columns].values.astype(np.float32)
    train_size = int(len(data) * split_ratio)
    
    scaler = RobustScaler()
    scaler.fit(data[:train_size])
    
    scaled_data = scaler.transform(data).astype(np.float32)
    return scaler, scaled_data

def create_sequences(df, feature_columns, lookback=60):
    """
    Creates sequences for Causal Engine using pre-allocation and float32 for memory efficiency.
    Returns: X (float32), y_dir (int32), y_mag (float32), scaler, scaled_data
    """
    # 1. Generate Targets (Shifted log-returns)
    df = df.copy()
    df['target_log_ret'] = df['log_ret'].shift(-1)
    df['target_dir'] = np.where(df['target_log_ret'] > 0, 1, 0)
    
    # 2. Normalize (Leakage-free Robust Scaler)
    scaler, scaled_data = normalize_data(df, feature_columns)
    
    # 3. Prepare Tensors (Drop rows with NaN targets - usually just the last row)
    df_train = df.dropna(subset=['target_log_ret'])
    scaled_train = scaled_data[:len(df_train)]
    
    n_samples = len(scaled_train) - lookback
    if n_samples <= 0:
        return np.array([]), np.array([]), np.array([]), scaler, scaled_data

    # Pre-allocate memory
    X = np.empty((n_samples, lookback, len(feature_columns)), dtype=np.float32)
    Y_dir = np.empty(n_samples, dtype=np.int32)
    Y_mag = np.empty(n_samples, dtype=np.float32)
    
    y_dir_vals = df_train['target_dir'].values
    y_mag_vals = df_train['target_log_ret'].values
    
    for i in range(n_samples):
        X[i] = scaled_train[i : i + lookback]
        Y_dir[i] = y_dir_vals[i + lookback]
        Y_mag[i] = y_mag_vals[i + lookback]
        
    return X, Y_dir, Y_mag, scaler, scaled_data

def add_noise(data, noise_level=0.001):
    """Causal noise injection."""
    noise = np.random.normal(0, noise_level, data.shape)
    return data + noise
