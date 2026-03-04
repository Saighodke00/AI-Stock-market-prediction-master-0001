import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import sys
import os
import yfinance as yf
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import gc

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from utils.data_loader import fetch_data, clean_data, normalize_data, create_sequences, add_noise
from utils.indicators import add_technical_indicators
from utils.model import create_model, train_model, predict_next_day, convert_to_tflite
from utils.sentiment import get_market_sentiment
from utils.data_pipeline import validate_data

st.set_page_config(page_title="Apex AI - Intraday Precision", layout="wide")

# --- HIGH-TECH TERMINAL CSS ---
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Outfit:wght@400;700&display=swap');
    
    .stApp { background-color: #050505; color: #00ffcc; font-family: 'Outfit', sans-serif; }
    
    /* Terminal Header */
    .terminal-header {
        border-left: 5px solid #00ffcc;
        padding-left: 20px;
        margin-bottom: 30px;
    }
    
    /* Metric Cards */
    .metric-card {
        background: rgba(0, 255, 204, 0.03);
        border: 1px solid rgba(0, 255, 204, 0.15);
        border-radius: 12px;
        padding: 20px;
        text-align: center;
        transition: 0.3s;
    }
    .metric-card:hover { border-color: #00ffcc; background: rgba(0, 255, 204, 0.08); }
    .metric-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #00ffcc; opacity: 0.6; text-transform: uppercase; }
    .metric-value { font-size: 26px; font-weight: 700; color: #00ffcc; margin-top: 5px; }
    
    /* Analysis Box */
    .terminal-analysis {
        background: rgba(0, 255, 204, 0.02);
        border: 1px solid rgba(0, 255, 204, 0.2);
        padding: 25px;
        border-radius: 10px;
        font-family: 'Outfit', sans-serif;
    }
    
    section[data-testid="stSidebar"] {
        background-color: #0a0a0a;
        border-right: 1px solid #1a1a1a;
    }
</style>
""", unsafe_allow_html=True)

# --- HEADER ---
st.markdown("""
<div class="terminal-header">
    <h1 style='font-weight:700; font-size: 38px; margin:0;'>⚡ INTRADAY PRECISION</h1>
    <p style='color: #00ffcc; opacity:0.6; font-family: "JetBrains Mono";'>V4.0 // NEURAL SCALPING TERMINAL</p>
</div>
""", unsafe_allow_html=True)

# --- SIDEBAR ---
with st.sidebar:
    st.header("Hardware Config")
    
    # Stock Presets
    market_cat = st.selectbox("Market Category", ["Indian Equities", "Crypto Assets", "US Equities", "Custom"])
    
    if market_cat == "Indian Equities":
        ticker_list = ["NIFTY-50", "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "TATAMOTORS.NS", "SBIN.NS"]
        ticker = st.selectbox("Select Security", ticker_list)
        # Handle NIFTY-50 specifically if needed, but ^NSEI is better
        if ticker == "NIFTY-50": ticker = "^NSEI"
    elif market_cat == "Crypto Assets":
        ticker_list = ["BTC-USD", "ETH-USD", "SOL-USD", "DOGE-USD", "BNB-USD"]
        ticker = st.selectbox("Select Security", ticker_list)
    elif market_cat == "US Equities":
        ticker_list = ["TSLA", "AAPL", "MSFT", "NVDA", "AMZN"]
        ticker = st.selectbox("Select Security", ticker_list)
    else:
        ticker = st.text_input("Enter Custom Ticker", "BTC-USD").upper()

    interval = st.selectbox("Resolution", ["1m", "5m", "15m", "1h"], index=2)
    lookback = st.slider("Memory Clusters", 30, 90, 60)
    st.markdown("---")
    show_ema = st.toggle("Overlay EMA 9/21", value=True)
    st.caption("Auto-optimizing for current volatility index...")

@st.cache_data
def get_intraday_data(ticker, interval):
    period = "7d" if interval == "1m" else "60d"
    data = fetch_data(ticker, period=period, interval=interval)
    if data is None: return None
    data = clean_data(data)
    data = add_technical_indicators(data)
    return data.dropna()

if ticker:
    df = get_intraday_data(ticker, interval)

    # ── Data Quality Gate (sidebar expander) ────────────────────────────────
    if df is not None and not df.empty:
        with st.sidebar.expander("📋 Data Quality Report", expanded=False):
            dq = validate_data(df)
            st.metric("Total Rows", dq['total_rows'])
            history_status = "✅ OK" if dq['sufficient_history'] else "⚠️ Short"
            st.metric("History", history_status)
            bad_cols = dq['columns_above_nan_threshold']
            if bad_cols:
                st.warning(f"High NaN: {', '.join(bad_cols)}")
            else:
                st.success("NaN%: All columns clean")
            anomalies = dq['price_anomaly_dates']
            if anomalies:
                st.warning(f"Price anomalies: {', '.join(anomalies[:3])}{'…' if len(anomalies)>3 else ''}")
            else:
                st.success("No price anomalies")
            overall = "✅ PASSED" if dq['passed'] else "⚠️ WARNINGS"
            st.info(f"Overall: {overall}")
        current_price = df['Close'].iloc[-1]
        
        # Prepare Advanced Feature Set (Intraday)
        df = add_technical_indicators(df)
        features = [
            'Close', 'log_ret', 'range', 'body', 'EMA_21', 'EMA_slope', 'SMA_50', 
            'ADX', 'RSI', 'MACD', 'MACD_Signal', 'ATR', 'BB_Width', 'VWAP', 
            'Vol_Zscore', 'Skew', 'Kurtosis', 'Hurst'
        ]
        if 'macro_ret' in df.columns:
            features += ['macro_ret', 'alpha_ret', 'macro_corr']
            
        X, Y_dir, Y_mag, scaler, scaled_data = create_sequences(df, features, lookback)
        
        # Free memory before training
        gc.collect()
        
        @st.cache_resource
        def train_intraday_model(t, lb, _X, _Y_dir, _Y_mag):
            # Apply causal noise
            X_noisy = add_noise(_X)
            engine = create_model(input_shape=(X_noisy.shape[1], X_noisy.shape[2]))
            history = engine.train_ensemble(X_noisy, _Y_dir, _Y_mag, epochs=30)
            return engine, history

        with st.spinner('Neural sync in progress...'):
            try:
                engine, history_data = train_intraday_model(ticker + interval, lookback, X, Y_dir, Y_mag)
                # Walk-Forward Validation
                from utils.backtest import walk_forward_validation, run_backtest, calculate_accuracy
                cagr, wf_sharpe, max_dd, win_rate, profit_factor = walk_forward_validation(engine, df, features)
            except Exception as e:
                st.error(f"Engine Synchronization Issue: {e}")
                st.stop()
            
        last_seq = scaled_data[-lookback:].reshape(1, lookback, len(features))
        q10_p, q50_p, q90_p = predict_next_day(engine, last_seq, scaler)
        predicted = q50_p # Use median for primary display
        
        # Signal Gatekeeper (returns: prob, q10, q50, q90)
        dir_prob, q10_raw, mean_ret_raw, q90_raw = engine.predict(last_seq)
        mean_ret = mean_ret_raw # Use median return
        adx_val = df['ADX'].iloc[-1]
        atr_val = df['ATR'].iloc[-1]
        rsi = df['RSI'].iloc[-1]
        
        signal, color = engine.get_signal(dir_prob[0][0], mean_ret[0], adx_val, wf_sharpe, atr_val)
        
        # Live Analysis Integration
        sentiment_val, top_news = get_market_sentiment(ticker)
        
        # Backtest Accuracy
        bt_results = run_backtest(engine, scaler, scaled_data, time_step=lookback)
        preds = bt_results['predictions']
        acts = bt_results['actuals']
        acc = bt_results['accuracy']

        # INTRADAY LOGIC
        reason = f"Neural Scalping Signal: {signal}. "
        if signal == "NEUTRAL":
            reason += "Gating criteria not met (Low confidence or insufficient volatility)."
        else:
            reason += f"Confidence: {dir_prob[0][0]*100:.1f}%. Expected Return: {mean_ret[0]*100:.2f}%."
        
        gauge_val = dir_prob[0][0] * 100

        # --- HERO METRICS (5 COLUMNS: 4 original + VIX) ---
        m1, m2, m3, m4, m5 = st.columns(5)
        with m1:
            st.markdown(f'<div class="metric-card"><div class="metric-label">Market Quote</div><div class="metric-value">${current_price:.2f}</div></div>', unsafe_allow_html=True)
        with m2:
            st.markdown(f'<div class="metric-card"><div class="metric-label">AI Target ({interval})</div><div class="metric-value" style="color:#00ffcc">${predicted:.2f}</div></div>', unsafe_allow_html=True)
        with m3:
            st.markdown(f'<div class="metric-card"><div class="metric-label">Signal Engine</div><div class="metric-value" style="color:{color}">{signal}</div></div>', unsafe_allow_html=True)
        with m4:
            st.markdown(f'<div class="metric-card"><div class="metric-label">Neural Reliability</div><div class="metric-value">{acc:.1f}%</div></div>', unsafe_allow_html=True)
        with m5:
            # VIX comes from the daily pipeline; intraday df won't have it – handle gracefully
            vix_col = 'VIX' if 'VIX' in df.columns else ('VIX_Close' if 'VIX_Close' in df.columns else None)
            if vix_col:
                vix_val = df[vix_col].iloc[-1]
                vix_color = '#ff4b4b' if vix_val > 30 else ('#ffcc00' if vix_val > 20 else '#00ffcc')
                st.markdown(f'<div class="metric-card"><div class="metric-label">Market Fear (VIX)</div><div class="metric-value" style="color:{vix_color}">{vix_val:.1f}</div></div>', unsafe_allow_html=True)
            else:
                st.markdown('<div class="metric-card"><div class="metric-label">Market Fear (VIX)</div><div class="metric-value" style="color:#555">N/A</div></div>', unsafe_allow_html=True)

        st.markdown("<br>", unsafe_allow_html=True)

        # --- GAUGE & REASONING ---
        c1, c2 = st.columns([1, 1.5])
        with c1:
            fig_gauge = go.Figure(go.Indicator(
                mode = "gauge+number",
                value = gauge_val,
                title = {'text': "Volatility Score", 'font': {'size': 18, 'color': '#00ffcc'}},
                gauge = {
                    'axis': {'range': [0, 100], 'tickcolor': "#00ffcc"},
                    'bar': {'color': color},
                    'bgcolor': "black",
                    'borderwidth': 1,
                    'bordercolor': "#00ffcc",
                    'steps': [
                        {'range': [0, 30], 'color': 'rgba(255,51,51,0.15)'},
                        {'range': [30, 70], 'color': 'rgba(255,255,0,0.15)'},
                        {'range': [70, 100], 'color': 'rgba(0,255,204,0.15)'}
                    ]
                }
            ))
            fig_gauge.update_layout(height=280, margin=dict(l=30, r=30, t=50, b=20), paper_bgcolor='rgba(0,0,0,0)', font={'color': "#00ffcc", 'family': "JetBrains Mono"})
            st.plotly_chart(fig_gauge, width='stretch')
            
        with c2:
            st.markdown(f"### 🤖 Scalp Analysis // {ticker}")
            st.markdown(f"""
            <div class="terminal-analysis">
                <span style="color:#888; font-size:12px;">SYSTEM OUTPUT:</span><br>
                {reason}
                <br><br>
                <span style="color:#888; font-size:12px;">SENTIMENT FLUX:</span> <span style="color:{color}">{sentiment_val:+.2f}</span> | 
                <span style="color:#888; font-size:12px;">RSI:</span> {rsi:.1f}
            </div>
            """, unsafe_allow_html=True)

        # --- TABS FOR CHARTS ---
        tab1, tab2 = st.tabs(["⚡ Precision Feed", "🧠 Convergence Log"])
        
        with tab1:
            df_plot = df.iloc[-80:]
            fig = go.Figure()
            # Candlestick
            fig.add_trace(go.Candlestick(x=df_plot.index, open=df_plot['Open'], high=df_plot['High'], low=df_plot['Low'], close=df_plot['Close'], name='Market'))
            # Indicators
            if show_ema:
                fig.add_trace(go.Scatter(x=df_plot.index, y=df_plot['EMA_9'], line=dict(color='cyan', width=1), name='EMA 9'))
                fig.add_trace(go.Scatter(x=df_plot.index, y=df_plot['EMA_21'], line=dict(color='magenta', width=1), name='EMA 21'))
            
            # Neural Extension
            last_idx = df_plot.index[-1]
            next_idx = last_idx + (df_plot.index[-1] - df_plot.index[-2]) 
            fig.add_trace(go.Scatter(
                x=[last_idx, next_idx],
                y=[current_price, predicted],
                mode='lines+markers',
                name='Neural Forecast',
                line=dict(color='#00ffcc', width=2, dash='dash')
            ))
            
            fig.update_layout(
                template="plotly_dark", 
                height=550, 
                paper_bgcolor='rgba(0,0,0,0)', 
                plot_bgcolor='rgba(0,0,0,0)',
                margin=dict(l=0, r=0, t=0, b=0),
                xaxis_rangeslider_visible=False
            )
            st.plotly_chart(fig, width='stretch')
        
        with tab2:
            fig_loss = go.Figure()
            fig_loss.add_trace(go.Scatter(y=history_data['loss'], name='Training Loss', line=dict(color='#00ffcc')))
            if 'val_loss' in history_data:
                fig_loss.add_trace(go.Scatter(y=history_data['val_loss'], name='Validation Loss', line=dict(color='#ff3333', dash='dash')))
            fig_loss.update_layout(
                template="plotly_dark", 
                height=500, 
                title="Neural Convergence: Training vs Validation Loss", 
                paper_bgcolor='rgba(0,0,0,0)', 
                plot_bgcolor='rgba(0,0,0,0)',
                legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
            )
            st.plotly_chart(fig_loss, width='stretch')
            
            # Diagnostic message
            if 'val_loss' in history_data:
                final_train = history_data['loss'][-1]
                final_val = history_data['val_loss'][-1]
                ratio = final_val / final_train if final_train > 0 else 1
                
                if ratio > 1.5:
                    st.warning("SYSTEM ALERT: Overfitting Risk Detected. Validation error is divergent.")
                else:
                    st.success("SYSTEM STATUS: Model Generalization Optimal. Neural weights stabilized.")

        # --- LIVE PULSE NEWS ---
        st.markdown("---")
        st.markdown("### 📡 Terminal Pulse: Live News Feed")
        if top_news:
            for n in top_news:
                st.markdown(f"""
                <div style="
                    padding: 15px;
                    border-left: 3px solid #00ffcc;
                    background: rgba(0, 255, 204, 0.05);
                    margin-bottom: 12px;
                    border-radius: 0 8px 8px 0;
                ">
                    <a href="{n['link']}" target="_blank" style="
                        color: #00ffcc;
                        text-decoration: none;
                        font-family: 'JetBrains Mono', monospace;
                        font-size: 15px;
                        font-weight: 600;
                        display: block;
                        margin-bottom: 8px;
                    ">{n['title']}</a>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <span style="
                            font-size: 10px;
                            color: #00ffcc;
                            opacity: 0.7;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                            border: 1px solid rgba(0, 255, 204, 0.3);
                            padding: 2px 6px;
                            border-radius: 3px;
                        ">{n['publisher']}</span>
                    </div>
                </div>
                """, unsafe_allow_html=True)
        else:
            st.info("No active news pulses detected in this sector.")
        
        st.sidebar.markdown("---")
        st.sidebar.success(f"WF Sharpe: {wf_sharpe:.2f}")
        st.sidebar.info(f"Profit Factor: {profit_factor:.2f} | Win Rate: {win_rate*100:.1f}%")
    elif df is not None:
        st.error("Invalid Ticker or No Data available for this interval.")
    else:
        st.error("Invalid Ticker or No Data available for this interval.")
