import pandas as pd
import numpy as np

def add_technical_indicators(df):
    """
    Advanced feature engineering for research-grade causal trading engine.
    Adds 30+ features across Price, Trend, Momentum, Volatility, and Regime.
    """
    df = df.copy()
    
    # 1. PRICE DERIVATIVES
    df['log_ret'] = np.log(df['Close'] / df['Close'].shift(1))
    df['range'] = (df['High'] - df['Low']) / df['Close']
    df['body'] = (df['Close'] - df['Open']) / df['Close']
    
    # 2. TREND
    df['EMA_9']  = df['Close'].ewm(span=9,  adjust=False).mean()   # intraday scalping overlay
    df['EMA_21'] = df['Close'].ewm(span=21, adjust=False).mean()
    df['EMA_slope'] = df['EMA_21'].diff() / df['EMA_21'].shift(1)
    df['SMA_50'] = df['Close'].rolling(window=50).mean()
    
    # ADX Implementation
    plus_dm = df['High'].diff()
    minus_dm = df['Low'].diff().apply(lambda x: -x)
    plus_dm[plus_dm < 0] = 0
    minus_dm[minus_dm < 0] = 0
    
    tr = np.maximum(df['High'] - df['Low'], 
                    np.maximum(abs(df['High'] - df['Close'].shift(1)), 
                               abs(df['Low'] - df['Close'].shift(1))))
    atr_14 = tr.rolling(14).mean() + 1e-9
    plus_di = 100 * (plus_dm.rolling(14).mean() / atr_14)
    minus_di = 100 * (minus_dm.rolling(14).mean() / atr_14)
    dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di + 1e-9)
    df['ADX'] = dx.rolling(14).mean()
    
    # 3. MOMENTUM
    # RSI
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).ewm(alpha=1/14, adjust=False).mean()
    loss = (-delta.where(delta < 0, 0)).ewm(alpha=1/14, adjust=False).mean()
    rs = gain / (loss + 1e-9)
    df['RSI'] = 100 - (100 / (1 + rs + 1e-9))
    
    # MACD
    ema12 = df['Close'].ewm(span=12, adjust=False).mean()
    ema26 = df['Close'].ewm(span=26, adjust=False).mean()
    df['MACD'] = ema12 - ema26
    df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
    
    # 4. VOLATILITY
    df['ATR'] = atr_14
    df['BB_Mid'] = df['Close'].rolling(window=20).mean()
    df['BB_Std'] = df['Close'].rolling(window=20).std()
    df['BB_Width'] = (df['BB_Std'] * 4) / (df['BB_Mid'] + 1e-9)
    
    # 5. VOLUME
    vol_sum = df['Volume'].cumsum() + 1e-9
    df['VWAP'] = (df['Volume'] * (df['High'] + df['Low'] + df['Close']) / 3).cumsum() / vol_sum
    df['Vol_Zscore'] = (df['Volume'] - df['Volume'].rolling(20).mean()) / (df['Volume'].rolling(20).std() + 1e-9)
    
    # 6. REGIME & STATS
    df['Skew'] = df['log_ret'].rolling(20).skew()
    df['Kurtosis'] = df['log_ret'].rolling(20).kurt()
    
    # Fast Hurst Approximation
    def calculate_hurst(ts):
        if len(ts) < 20: return 0.5
        try:
            ts = np.asarray(ts)
            lags = range(2, 20)
            tau = [np.std(np.subtract(ts[lag:], ts[:-lag])) for lag in lags]
            reg = np.polyfit(np.log(lags), np.log(tau), 1)
            return reg[0]
        except:
            return 0.5
    
    df['Hurst'] = df['log_ret'].rolling(100).apply(calculate_hurst, raw=True)
    
    # 7. CROSS-ASSET
    # data_pipeline produces: VIX, SP500, NSEI  (exact names)
    # Legacy columns: Macro_Close, VIX_Close  (kept for backwards compat)
    MACRO_PRIORITY = ['SP500', 'NSEI', 'Macro_Close']   # prefer broad index
    macro_col = next(
        (c for c in MACRO_PRIORITY if c in df.columns), None
    )
    if macro_col is None:
        # fall back to any column whose name contains a known macro keyword
        macro_col = next(
            (c for c in df.columns if any(m in c.upper() for m in ['SP500', 'NSEI', 'MACRO'])),
            None
        )
    if macro_col:
        df['macro_ret']  = np.log(df[macro_col] / df[macro_col].shift(1))
        df['alpha_ret']  = df['log_ret'] - df['macro_ret']
        df['macro_corr'] = df['log_ret'].rolling(20).corr(df['macro_ret'])

    # VIX fear-index return (data_pipeline column = 'VIX'; legacy = 'VIX_Close')
    vix_col = 'VIX' if 'VIX' in df.columns else ('VIX_Close' if 'VIX_Close' in df.columns else None)
    if vix_col:
        df['VIX_ret'] = np.log(df[vix_col] / df[vix_col].shift(1))
    
    # 8. LAGGED FEATURES (Momentum Shifts)
    for lag in [1, 3, 5]:
        df[f'RSI_lag_{lag}'] = df['RSI'].shift(lag)
        df[f'MACD_lag_{lag}'] = df['MACD'].shift(lag)
    
    return df
