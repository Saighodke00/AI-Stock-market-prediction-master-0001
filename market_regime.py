import yfinance as yf
import pandas as pd
import numpy as np
import logging
import os
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
from hmmlearn.hmm import GaussianHMM
from sklearn.preprocessing import StandardScaler
from typing import Dict, Any, Tuple, Optional

# ── LOGGING ──────────────────────────────────────────────────────────────────
logger = logging.getLogger("apex_ai.regime")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(name)s — %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

# ── CONFIG ───────────────────────────────────────────────────────────────────
MODEL_DIR = "models"
MODEL_PATH = os.path.join(MODEL_DIR, "regime_hmm.pkl")
os.makedirs(MODEL_DIR, exist_ok=True)

# ── FUNCTIONS ────────────────────────────────────────────────────────────────

def build_regime_features() -> pd.DataFrame:
    """
    Fetch last 3 years of daily data for: ^VIX, ^GSPC, ^TNX (10Y yield), ^IRX (13W Treasury Bill)
    Engineers macro features for the HMM.
    """
    logger.info("Fetching macro data for regime features...")
    end_date = datetime.now()
    start_date = end_date - timedelta(days=3*365)
    
    tickers = {
        "^VIX": "vix",
        "^GSPC": "sp500",
        "^TNX": "ten_year",
        "^IRX": "thirteen_week"
    }
    
    data = pd.DataFrame()
    
    for symbol, name in tickers.items():
        logger.info(f"Downloading {symbol}...")
        try:
            df = yf.download(symbol, start=start_date, end=end_date, interval="1d", progress=False)
            if df.empty:
                logger.error(f"Failed to download {symbol}")
                continue
                
            # Flatten MultiIndex if present
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
                
            if 'Close' not in df.columns:
                logger.error(f"'Close' not in {symbol} data: {df.columns}")
                continue
                
            data[symbol] = df['Close']
        except Exception as e:
            logger.error(f"Error downloading {symbol}: {e}")
            continue
            
    if data.empty:
        raise RuntimeError("No data could be downloaded for any ticker.")
        
    # Ensure data is chronological
    data = data.sort_index()
    
    # Forward fill to handle any gaps (weekends, holidays)
    data = data.ffill().dropna()
    
    # Verify we have all required columns
    required = ["^VIX", "^GSPC", "^TNX", "^IRX"]
    missing = [c for c in required if c not in data.columns]
    if missing:
        raise KeyError(f"Missing required tickers after cleaning: {missing}. Data columns: {data.columns}")
    
    features = pd.DataFrame(index=data.index)
    
    # 1. VIX Level (raw)
    features['vix_raw'] = data['^VIX']
    
    # 2. VIX 20-day z-score (standardized)
    features['vix_zscore'] = (data['^VIX'] - data['^VIX'].rolling(20).mean()) / data['^VIX'].rolling(20).std()
    
    # 3. SP500 50-day return (momentum)
    features['sp500_50d_ret'] = data['^GSPC'].pct_change(50)
    
    # 4. SP500 200-day return (trend)
    features['sp500_200d_ret'] = data['^GSPC'].pct_change(200)
    
    # 5. SP500 50-day realized volatility (annualized)
    features['sp500_50d_vol'] = data['^GSPC'].pct_change().rolling(50).std() * np.sqrt(252)
    
    # 6. Yield curve slope (10Y - 13W as yield curve slope proxy)
    features['yield_curve_slope'] = data['^TNX'] - data['^IRX']
    
    # Drop rows with NaNs from rolling windows
    features = features.dropna()
    
    logger.info(f"Feature engineering complete. Shape: {features.shape}")
    return features

def fit_hmm(features_df: pd.DataFrame, n_states: int = 4) -> Tuple[GaussianHMM, StandardScaler, Dict[int, str]]:
    """
    Fits a GaussianHMM on standardized features.
    Labels states based on average VIX level.
    """
    logger.info(f"Fitting HMM with {n_states} states...")
    
    scaler = StandardScaler()
    X = scaler.fit_transform(features_df)
    
    # Initialize HMM: GaussianHMM with 4 components
    model = GaussianHMM(n_components=n_states, covariance_type="full", n_iter=1000, random_state=42)
    model.fit(X)
    
    # Predict states
    states = model.predict(X)
    
    # Label states by average VIX level
    vix_vals = features_df['vix_raw'].values
    state_vix_means = {}
    for i in range(n_states):
        state_vix_means[i] = vix_vals[states == i].mean()
    
    # Sort states by VIX mean
    sorted_states = sorted(state_vix_means.items(), key=lambda x: x[1])
    
    # Map based on sorted VIX levels: lowest = BULL, highest = CRISIS
    # 0: BULL, 1: SIDEWAYS, 2: BEAR, 3: CRISIS (re-ordered by VIX ranking)
    state_labels = {}
    label_names = ["BULL", "SIDEWAYS", "BEAR", "CRISIS"]
    
    # Map internal HMM state ID to human label
    internal_to_label = {}
    for i, (state_id, _) in enumerate(sorted_states):
        internal_to_label[state_id] = label_names[i]
        
    # Re-normalize state IDs to match 0-3 prompt requirement in the final summary
    # But HMM uses its internal IDs. We store the mapping.
    
    # Save model, scaler, and internal state mapping
    save_data = {
        'model': model,
        'scaler': scaler,
        'state_mapping': internal_to_label, # internal_id -> "BULL" etc
        'trained_at': datetime.now().isoformat()
    }
    joblib.dump(save_data, MODEL_PATH)
    logger.info(f"Model saved to {MODEL_PATH}")
    
    return model, scaler, internal_to_label

def get_current_regime() -> Dict[str, Any]:
    """
    Load saved HMM model, fetch latest data, and predict current regime.
    """
    if not os.path.exists(MODEL_PATH):
        logger.error("Model not found. Run fit_hmm first.")
        # Fallback or trigger fit
        features = build_regime_features()
        fit_hmm(features)
        
    data = joblib.load(MODEL_PATH)
    model = data['model']
    scaler = data['scaler']
    state_mapping = data['state_mapping']
    
    # Fetch latest 60 days of features
    # Note: build_regime_features handles the full 3 years, we just take the tail
    features_df = build_regime_features()
    latest_features = features_df.tail(60)
    
    X = scaler.transform(latest_features)
    states = model.predict(X)
    last_state_id = states[-1]
    regime_name = state_mapping[last_state_id]
    
    # Confidence (using posterior probability of the last state)
    probs = model.predict_proba(X)
    confidence = float(probs[-1, last_state_id])
    
    descriptions = {
        "BULL": "Low volatility bull market — signals are reliable",
        "SIDEWAYS": "Choppy or range-bound market — use caution with trend signals",
        "BEAR": "Elevated volatility bear market — defensive positioning recommended",
        "CRISIS": "Extreme panic/volatility — capital preservation is priority"
    }
    
    # Map label to prompt's regime_id
    id_map = {"BULL": 0, "BEAR": 1, "SIDEWAYS": 2, "CRISIS": 3}
    
    return {
        'regime': regime_name,
        'regime_id': id_map.get(regime_name, 2),
        'confidence': round(confidence, 4),
        'description': descriptions.get(regime_name, "Neutral market conditions")
    }

def get_regime_thresholds(regime_name: str) -> Dict[str, float]:
    """
    Return adjusted signal gate thresholds for each regime.
    """
    regime_name = regime_name.upper()
    if regime_name == "BULL":
        return {"min_confidence": 0.60, "max_cone_width": 0.18}
    elif regime_name == "SIDEWAYS":
        return {"min_confidence": 0.65, "max_cone_width": 0.15}
    elif regime_name == "BEAR":
        return {"min_confidence": 0.72, "max_cone_width": 0.12}
    elif regime_name == "CRISIS":
        return {"min_confidence": 0.80, "max_cone_width": 0.08}
    else:
        return {"min_confidence": 0.65, "max_cone_width": 0.15}

def plot_regime_history(features_df: pd.DataFrame, model: GaussianHMM, scaler: StandardScaler, state_mapping: Dict[int, str]):
    """
    Plot regime history over last 3 years with colored background bands.
    """
    X = scaler.transform(features_df)
    states = model.predict(X)
    
    # Convert internal states to human-readable names
    regimes = [state_mapping[s] for s in states]
    
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(15, 10), sharex=True, gridspec_kw={'height_ratios': [3, 1]})
    
    # Plot S&P 500
    # Since we don't have the original OHLC here easily without re-fetching, 
    # we'll fetch it just for the plot or use a feature as proxy. 
    # Better to fetch to show the price relationship.
    sp500 = yf.download("^GSPC", start=features_df.index[0], end=features_df.index[-1], progress=False)['Close']
    sp500 = sp500.reindex(features_df.index)
    
    ax1.plot(sp500.index, sp500.values, color='black', lw=1.5, label='S&P 500 Index')
    
    # Color mapping for plot
    colors = {
        "BULL": "green",
        "SIDEWAYS": "yellow",
        "BEAR": "orange",
        "CRISIS": "red"
    }
    
    # Background bands
    for i in range(len(states)):
        ax1.axvspan(features_df.index[i], 
                    features_df.index[i] + timedelta(days=1), 
                    color=colors.get(regimes[i], "gray"), 
                    alpha=0.3)
        
    ax1.set_title("Market Regimes Classification (HMM)", fontsize=16)
    ax1.set_ylabel("S&P 500 Level")
    ax1.legend()
    
    # Plot VIX
    ax2.plot(features_df.index, features_df['vix_raw'], color='purple', label='VIX Index')
    ax2.set_ylabel("VIX")
    ax2.set_xlabel("Date")
    ax2.grid(alpha=0.3)
    
    plt.tight_layout()
    plot_path = "plots/regime_history.png"
    os.makedirs("plots", exist_ok=True)
    plt.savefig(plot_path)
    logger.info(f"Regime history plot saved to {plot_path}")
    plt.close()

def plot_transition_matrix(model: GaussianHMM, state_mapping: Dict[int, str]):
    """
    Visualize regime transition probability matrix.
    """
    trans_mat = model.transmat_
    
    # Labels for the matrix
    n_states = len(state_mapping)
    labels = [state_mapping[i] for i in range(n_states)]
    
    plt.figure(figsize=(10, 8))
    sns.heatmap(trans_mat, annot=True, fmt=".2f", cmap="Blues",
                xticklabels=labels, yticklabels=labels)
    
    plt.title("Regime Transition Probability Matrix", fontsize=16)
    plt.xlabel("To Regime")
    plt.ylabel("From Regime")
    
    plot_path = "plots/regime_transitions.png"
    plt.savefig(plot_path)
    logger.info(f"Transition matrix plot saved to {plot_path}")
    plt.close()

if __name__ == "__main__":
    # Fit model
    features = build_regime_features()
    model, scaler, mapping = fit_hmm(features)
    
    # Plots
    plot_regime_history(features, model, scaler, mapping)
    plot_transition_matrix(model, mapping)
    
    # Current Regime
    current = get_current_regime()
    print("\n" + "="*50)
    print("APEX AI — CURRENT MARKET REGIME")
    print("="*50)
    print(f"Regime      : {current['regime']} (ID: {current['regime_id']})")
    print(f"Confidence  : {current['confidence']:.2%}")
    print(f"Description : {current['description']}")
    
    thresholds = get_regime_thresholds(current['regime'])
    print("\nADJUSTED THRESHOLDS:")
    print(f"Min Confidence : {thresholds['min_confidence']}")
    print(f"Max Cone Width : {thresholds['max_cone_width']}")
    print("="*50 + "\n")
