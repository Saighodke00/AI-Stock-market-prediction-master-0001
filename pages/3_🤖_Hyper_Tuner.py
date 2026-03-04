import streamlit as st
import pandas as pd
import numpy as np
import optuna
import sys
import os
import plotly.graph_objects as go
import textwrap

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from utils.data_loader import fetch_data, clean_data, create_sequences
from utils.indicators import add_technical_indicators
from utils.model import create_model

st.set_page_config(page_title="Apex AI - HyperDrive Tuner", layout="wide")

# --- PREMIUM TUNER CSS ---
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');
    
    /* Aero Terminal CSS - Tuner */
    .stApp { background-color: #060810; color: #c8d0e0; font-family: 'Outfit', sans-serif; }
    
    .tuner-card, .stStatus {
        background: rgba(15, 18, 32, 0.6);
        border: 1px solid rgba(0, 210, 170, 0.3);
        border-radius: 12px;
        padding: 25px;
        backdrop-filter: blur(16px);
        box-shadow: 0 4px 20px rgba(0,210,170,0.1);
    }
    .best-param { color: #00ffcc; font-weight: 800; font-family: 'Share Tech Mono', monospace; }
</style>
""", unsafe_allow_html=True)

st.title("⚙️ HyperDrive Tuner")
st.caption("Optuna-Powered Neural Architecture Search // Auto-Tuning for Maximum Alpha")
st.markdown("---")

c1, c2 = st.columns([1, 2])

with c1:
    st.subheader("Tuning Controls")
    ticker = st.text_input("Target Ticker", "TSLA").upper()
    n_trials = st.slider("Optimization Trials", 5, 50, 20)
    timeout = st.number_input("Timeout (seconds)", 60, 600, 300)
    
    run_opt = st.button("🚀 Start HyperDrive Optimization", use_container_width=True)

if run_opt:
    with st.status("Fetching Market Context...") as status:
        df = fetch_data(ticker, period="2y")
        if df is None:
            st.error("Market data unavailable.")
            st.stop()
        
        df = clean_data(df)
        df = add_technical_indicators(df)
        
        features = [
            'Close', 'log_ret', 'range', 'body', 'EMA_21', 'RSI', 'MACD', 'ATR', 'BB_Width',
            'PE_Ratio', 'EPS', 'Debt_to_Equity', 'VIX'
        ]
        # Safety check: exclude features not present in df
        features = [f for f in features if f in df.columns]
        
        def objective(trial):
            # 1. Hyperparameters to tune
            lb = trial.suggest_int("lookback", 30, 120)
            eps = trial.suggest_int("epochs", 10, 50)
            
            # 2. Prepare Data
            X, Y_dir, Y_mag, scaler, _ = create_sequences(df, features, lb)
            
            # Split for validation
            split = int(len(X) * 0.8)
            X_train, X_val = X[:split], X[split:]
            Y_mag_train, Y_mag_val = Y_mag[:split], Y_mag[split:]
            
            # 3. Build & Train
            engine = create_model(input_shape=(X_train.shape[1], X_train.shape[2]))
            
            # Focused training on Magnitude for the tuner
            history = engine.mag_model.fit(
                X_train, Y_mag_train, 
                validation_data=(X_val, Y_mag_val),
                epochs=eps, 
                batch_size=64, 
                verbose=0
            )
            
            val_loss = history.history['val_loss'][-1]
            return val_loss

        status.update(label=f"Running {n_trials} Optimization Trials for {ticker}...", state="running")
        
        study = optuna.create_study(direction="minimize")
        study.optimize(objective, n_trials=n_trials, timeout=timeout)
        
        status.update(label="Optimization Complete!", state="complete")

    # --- RESULTS DISPLAY ---
    st.success(f"Best Neural Calibration Found for {ticker}!")
    
    r1, r2, r3 = st.columns(3)
    best = study.best_params
    
    with r1:
        st.markdown(textwrap.dedent(f"""
            <div class="tuner-card">
                <div style="font-size:12px; color:#888;">OPTIMAL LOOKBACK</div>
                <div class="best-param" style="font-size:32px;">{best['lookback']} Days</div>
            </div>
        """), unsafe_allow_html=True)
    with r2:
        st.markdown(textwrap.dedent(f"""
            <div class="tuner-card">
                <div style="font-size:12px; color:#888;">OPTIMAL EPOCHS</div>
                <div class="best-param" style="font-size:32px;">{best['epochs']}</div>
            </div>
        """), unsafe_allow_html=True)
    with r3:
        st.markdown(textwrap.dedent(f"""
            <div class="tuner-card">
                <div style="font-size:12px; color:#888;">MIN VAL LOSS</div>
                <div class="best-param" style="font-size:32px;">{study.best_value:.6f}</div>
            </div>
        """), unsafe_allow_html=True)

    # Study Visualization
    st.subheader("Optimization History")
    trials_df = study.trials_dataframe()
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=trials_df.index, y=trials_df.value, mode='lines+markers', line=dict(color='#00d2aa')))
    fig.update_layout(template="plotly_dark", paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)')
    st.plotly_chart(fig, use_container_width=True)

else:
    st.info("👈 Enter a ticker and click the button to find the mathematically optimal neural settings.")
    
    st.markdown("""
    ### 🧪 How it works?
    The **HyperDrive Tuner** uses Bayesian Optimization (via Optuna) to search through hundreds of possible model configurations. It tests different 'memory' lengths and training durations to find the exact point where the AI generalizes best without overfitting.
    
    **Why use this?**
    Different stocks have different "cycle lengths". A highly volatile stock like TSLA might require a shorter lookback (e.g., 45 days), while a stable stock like RELIANCE might benefit from 100+ days of memory.
    """)
