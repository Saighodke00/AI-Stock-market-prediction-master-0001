import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import sys
import os
import yfinance as yf
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import gc
import textwrap

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from utils.data_loader import fetch_data, clean_data, normalize_data, create_sequences, add_noise
from utils.indicators import add_technical_indicators
from utils.model import create_model, train_model, predict_next_day, convert_to_tflite
from utils.sentiment import get_market_sentiment
from utils.data_pipeline import validate_data
from utils.india_market import IndiaMarketIntelligence
from utils.technical_analysis import detect_support_resistance, calculate_position_size, calculate_multi_timeframe_confluence

intel = IndiaMarketIntelligence()

st.set_page_config(page_title="Intraday Precision · Apex AI", page_icon="⚡", layout="wide")

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;700&display=swap');

*, *::before, *::after { box-sizing: border-box; }
:root {
    --bg: #03050c; --panel: rgba(12,17,35,0.9); --border: rgba(255,255,255,0.06);
    --amber: #f7b731; --teal: #00e5c9; --red: #ff5370; --green: #00e676; --blue: #4f8cff;
    --txt: #d0d8ef; --txt2: #5a6585;
}
.stApp { background: var(--bg); color: var(--txt); font-family: 'Space Grotesk', sans-serif; }
#MainMenu, header, footer { visibility: hidden; }
.block-container { padding: 1.5rem 2.5rem !important; max-width: 100% !important; }
section[data-testid="stSidebar"] { background: #04080f; border-right: 1px solid rgba(0,229,201,0.08); }
section[data-testid="stSidebar"] * { color: var(--txt) !important; }

/* ─ Metric Cards (Teal accent for intraday) ─ */
.m-card {
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 16px; padding: 20px 18px;
    transition: border-color 0.3s, transform 0.3s;
}
.m-card:hover { border-color: rgba(0,229,201,0.35); transform: translateY(-3px); }
.m-label { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--txt2); margin-bottom:10px; }
.m-val { font-size:26px; font-weight:700; color:#fff; font-family:'JetBrains Mono',monospace; }

/* ─ Analysis Panel (teal left border) ─ */
.analysis-panel {
    background: var(--panel); border: 1px solid var(--border);
    border-left: 3px solid var(--teal);
    border-radius: 0 14px 14px 0; padding: 24px;
}

/* ─ Tags ─ */
.tag-green { background:rgba(0,230,118,.08); border:1px solid rgba(0,230,118,.25); color:var(--green); padding:3px 10px; border-radius:50px; font-size:11px; font-family:'JetBrains Mono'; }
.tag-teal  { background:rgba(0,229,201,.08); border:1px solid rgba(0,229,201,.25); color:var(--teal);  padding:3px 10px; border-radius:50px; font-size:11px; font-family:'JetBrains Mono'; }
.tag-red   { background:rgba(255,83,112,.08); border:1px solid rgba(255,83,112,.25); color:var(--red);   padding:3px 10px; border-radius:50px; font-size:11px; font-family:'JetBrains Mono'; }
.tag-blue  { background:rgba(79,140,255,.08); border:1px solid rgba(79,140,255,.25); color:var(--blue);  padding:3px 10px; border-radius:50px; font-size:11px; font-family:'JetBrains Mono'; }

/* ─ India Sidebar Card ─ */
.ind-card { background:rgba(0,229,201,0.04); border:1px solid rgba(0,229,201,0.15); border-radius:12px; padding:14px; }

/* ─ Risk Box ─ */
.risk-box { background:rgba(0,229,201,0.06); border:1px solid rgba(0,229,201,0.2); border-radius:12px; padding:16px; }

/* ─ Tabs ─ */
.stTabs [data-baseweb="tab-list"] { background:var(--panel); border-radius:12px; padding:4px; }
.stTabs [data-baseweb="tab"] { border-radius:9px; color:var(--txt2); font-family:'Space Grotesk'; }
.stTabs [aria-selected="true"] { background:rgba(0,229,201,0.10); color:var(--teal) !important; }

div[data-testid="stMetric"] { background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:16px; }
div.stButton > button { background:linear-gradient(135deg,var(--teal),#00b8a6); color:#000; font-weight:700; border:none; border-radius:10px; padding:10px 24px; transition:0.3s; }
div.stButton > button:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,229,201,0.25); }

::-webkit-scrollbar { width:5px; } ::-webkit-scrollbar-track { background:var(--bg); }
::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:10px; }
::-webkit-scrollbar-thumb:hover { background: var(--teal); }
</style>
""", unsafe_allow_html=True)

# ── Page Header ──────────────────────────────────────────────────────────────
st.markdown("""
<div style='display:flex; align-items:center; justify-content:space-between; padding: 8px 0 24px;'>
    <div>
        <div style='font-family:JetBrains Mono; font-size:11px; letter-spacing:3px; color:#5a6585; text-transform:uppercase; margin-bottom:6px;'>Apex AI · Neural Scalp Engine</div>
        <h1 style='font-size:38px; font-weight:700; color:#fff; margin:0;'>Intraday Precision <span style='color:#00e5c9;'>◆</span></h1>
    </div>
    <div style='display:flex; gap:10px; align-items:center;'>
        <span class='tag-teal'>Scalping Mode</span>
        <span class='tag-blue'>Real-Time Feed</span>
    </div>
</div>
<div style='height:1px; background:linear-gradient(90deg, rgba(0,229,201,0.4), rgba(79,140,255,0.2), transparent); margin-bottom:28px;'></div>
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
    
    st.markdown("---")
    st.markdown("### 🇮🇳 India Pulse")
    fii_data = intel.get_fii_dii_flow()
    if fii_data:
        flow_color = "#00ffcc" if fii_data['sentiment'] == "BULLISH" else "#ff4b4b"
        st.markdown(textwrap.dedent(f"""
            <div class="india-card">
                <div style="font-size:10px; color:rgba(0,255,204,0.6); letter-spacing:1px; font-family:'JetBrains Mono';">INSTITUTIONAL FLOW (CR)</div>
                <div style="font-size:18px; font-weight:700; color:{flow_color}; margin:5px 0;">{fii_data['total_flow']:+d}</div>
                <div style="font-size:10px; color:#fff;">FII: {fii_data['fii_net']:+d} | DII: {fii_data['dii_net']:+d}</div>
            </div>
        """), unsafe_allow_html=True)

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

        # ── HERO METRICS ──
        m1, m2, m3, m4, m5 = st.columns(5)
        with m1:
            st.markdown(f'<div class="m-card"><div class="m-label">Market Quote</div><div class="m-val">${current_price:.2f}</div></div>', unsafe_allow_html=True)
        with m2:
            st.markdown(f'<div class="m-card"><div class="m-label">AI Target ({interval})</div><div class="m-val" style="color:#00e5c9">${predicted:.2f}</div></div>', unsafe_allow_html=True)
        with m3:
            sig_col = "#00e676" if signal=="BUY" else ("#ff5370" if signal=="SELL" else "#4f8cff")
            st.markdown(f'<div class="m-card"><div class="m-label">Signal Engine</div><div class="m-val" style="color:{sig_col}">{signal}</div></div>', unsafe_allow_html=True)
        with m4:
            conf_score = calculate_multi_timeframe_confluence(ticker)
            st.markdown(f'<div class="m-card"><div class="m-label">AI Confluence</div><div class="m-val" style="color:#00e5c9">{conf_score}%</div></div>', unsafe_allow_html=True)
        with m5:
            vix_col = 'VIX' if 'VIX' in df.columns else None
            if vix_col:
                vix_val = df[vix_col].iloc[-1]
                vix_color = '#ff5370' if vix_val > 30 else ('#f7b731' if vix_val > 20 else '#00e5c9')
                st.markdown(f'<div class="m-card"><div class="m-label">Market Fear (VIX)</div><div class="m-val" style="color:{vix_color}">{vix_val:.1f}</div></div>', unsafe_allow_html=True)
            else:
                st.markdown('<div class="m-card"><div class="m-label">Market Fear (VIX)</div><div class="m-val" style="color:#2a3050">N/A</div></div>', unsafe_allow_html=True)

        st.markdown("<div style='height:24px;'></div>", unsafe_allow_html=True)

        # ── GAUGE & ANALYSIS ──
        c1, c2 = st.columns([1, 1.6])
        with c1:
            g_color = sig_col if 'sig_col' in dir() else "#4f8cff"
            fig_gauge = go.Figure(go.Indicator(
                mode = "gauge+number",
                value = gauge_val,
                domain = {'x': [0, 1], 'y': [0, 1]},
                title = {'text': "Neural Confidence", 'font': {'size': 14, 'color': '#5a6585'}},
                number = {'font': {'color': '#fff', 'size': 44}},
                gauge = {
                    'axis': {'range': [0, 100], 'tickwidth': 0, 'tickcolor': '#1a2035', 'tickfont': {'color': '#5a6585'}},
                    'bar': {'color': '#00e5c9', 'thickness': 0.22},
                    'bgcolor': 'rgba(0,0,0,0)',
                    'borderwidth': 0,
                    'steps': [
                        {'range': [0, 35], 'color': 'rgba(255,83,112,0.06)'},
                        {'range': [35, 65], 'color': 'rgba(79,140,255,0.06)'},
                        {'range': [65, 100], 'color': 'rgba(0,230,118,0.06)'}
                    ]
                }
            ))
            fig_gauge.update_layout(height=260, margin=dict(l=20,r=20,t=45,b=20), paper_bgcolor='rgba(0,0,0,0)', font=dict(family='JetBrains Mono'))
            st.plotly_chart(fig_gauge, use_container_width=True)
            
        with c2:
            st.markdown(f"### 🤖 Scalp Analysis // {ticker}")
            st.markdown(textwrap.dedent(f"""
                <div class="terminal-analysis">
                    <span style="color:#888; font-size:12px;">SYSTEM OUTPUT:</span><br>
                    {reason}
                    <br><br>
                    <span style="color:#888; font-size:12px;">SENTIMENT FLUX:</span> <span style="color:{color}">{sentiment_val:+.2f}</span> | 
                    <span style="color:#888; font-size:12px;">RSI:</span> {rsi:.1f}
                </div>
            """), unsafe_allow_html=True)
            
            # --- RISK MANAGEMENT TERMINAL ---
            st.markdown("### 🛡️ Scalp Risk Center")
            with st.container(border=True):
                account_val = st.number_input("Capital Buffer ($)", value=5000)
                risk_p = st.slider("Risk Per Scalp (%)", 0.1, 2.0, 0.5)
                sl_price = st.number_input("Stop Loss Price ($)", value=current_price*0.995)
                
                shares = calculate_position_size(account_val, risk_p, current_price, sl_price)
                
                st.markdown(textwrap.dedent(f"""
                    <div style="background:rgba(0,255,204,0.1); padding:15px; border-radius:8px; border:1px solid #00ffcc;">
                        <div style="font-size:11px; color:#00ffcc; font-family:'JetBrains Mono';">SCALP QUANTITY</div>
                        <div style="font-size:22px; font-weight:700; color:#fff;">{shares} Units</div>
                        <div style="font-size:10px; color:#aaa; margin-top:5px;">Max Loss: ${account_val * (risk_p/100):.2f}</div>
                    </div>
                """), unsafe_allow_html=True)

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
            
            # Auto Support & Resistance
            levels = detect_support_resistance(df_plot, window=10)
            for s in levels['support']:
                fig.add_hline(y=s, line_dash="dash", line_color="rgba(0, 255, 204, 0.3)", annotation_text="Support", annotation_position="bottom right")
            for r in levels['resistance']:
                fig.add_hline(y=r, line_dash="dash", line_color="rgba(255, 51, 51, 0.3)", annotation_text="Resistance", annotation_position="top right")
            
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
