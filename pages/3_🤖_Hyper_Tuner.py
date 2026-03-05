import streamlit as st
import pandas as pd
import numpy as np
import optuna
import sys
import os
import plotly.graph_objects as go
import textwrap

from utils.data_loader import fetch_data, clean_data, create_sequences
from utils.indicators import add_technical_indicators
from utils.model import create_model
from utils.ui import metric_card, apply_chart_style

st.set_page_config(page_title="Apex AI - HyperDrive Tuner", layout="wide")

# The global CSS is now handled in app.py
# Pages can add specific overrides if needed.

# Header
st.markdown("""
<div style="margin-bottom: 25px;">
    <div style="font-family: 'Orbitron', sans-serif; font-size: 14px; color: #5a75a0; letter-spacing: 3px;">
        HYPERDRIVE V4 // BAYESIAN OPTIMIZATION ENGINE
    </div>
    <div style="display: flex; align-items: baseline; gap: 20px; margin-top: 5px;">
        <div style="font-family: 'Orbitron', sans-serif; font-size: 42px; font-weight: 700; color: #fff;">
            HYPER TUNER
        </div>
        <div style="flex-grow: 1;"></div>
        <div style="text-align: right;">
            <div class="glow-cyan" style="font-family: 'Orbitron', sans-serif; font-size: 18px; font-weight: 700;">
                CORE OPTIMIZER
            </div>
        </div>
    </div>
</div>
<div style="height: 1px; background: #0e2040; margin-bottom: 30px;"></div>
""", unsafe_allow_html=True)

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
        st.markdown(metric_card("OPTIMAL LOOKBACK", f"{best['lookback']} DAYS", "#00e5ff"), unsafe_allow_html=True)
    with r2:
        st.markdown(metric_card("OPTIMAL EPOCHS", f"{best['epochs']}", "#00e676"), unsafe_allow_html=True)
    with r3:
        st.markdown(metric_card("MIN VAL LOSS", f"{study.best_value:.6f}", "#ffc107"), unsafe_allow_html=True)

    # Study Visualization
    st.subheader("Optimization History")
    trials_df = study.trials_dataframe()
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=trials_df.index, y=trials_df.value, mode='lines+markers', line=dict(color='#00d2aa')))
    fig = apply_chart_style(fig)
    st.plotly_chart(fig, use_container_width=True)

else:
    st.info("👈 Enter a ticker and click the button to find the mathematically optimal neural settings.")
    
    st.markdown("""
    ### 🧪 How it works?
    The **HyperDrive Tuner** uses Bayesian Optimization (via Optuna) to search through hundreds of possible model configurations. It tests different 'memory' lengths and training durations to find the exact point where the AI generalizes best without overfitting.
    
    **Why use this?**
    Different stocks have different "cycle lengths". A highly volatile stock like TSLA might require a shorter lookback (e.g., 45 days), while a stable stock like RELIANCE might benefit from 100+ days of memory.
    """)
