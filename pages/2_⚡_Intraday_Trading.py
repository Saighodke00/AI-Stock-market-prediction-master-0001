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

from utils.data_loader import fetch_data, clean_data, normalize_data, create_sequences, add_noise
from utils.indicators import add_technical_indicators
from utils.model import create_model, predict_next_day, convert_to_tflite
from utils.sentiment import get_market_sentiment
from utils.data_pipeline import validate_data
from utils.india_market import IndiaMarketIntelligence
from utils.technical_analysis import detect_support_resistance, calculate_position_size, calculate_multi_timeframe_confluence
from utils.ui import metric_card, terminal_header, apply_chart_style
from utils.pattern_recognition import (
    detect_all_patterns,
    draw_patterns_on_chart,
    get_confluence_message,
    render_pattern_panel_streamlit,
)

intel = IndiaMarketIntelligence()

def _suggest_ticker_fix(ticker: str):
    import yfinance as yf
    suggestions = []
    t = ticker.upper().strip()
    if not t.endswith('.NS') and not t.endswith('.BO') and '.' not in t:
        suggestions.append(f"`{t}.NS` — NSE India")
        suggestions.append(f"`{t}.BO` — BSE India")
    if t.endswith('.NS'):
        suggestions.append(f"`{t[:-3]}.BO` — Try BSE instead")
    online = True
    try:
        test = yf.download("AAPL", period="5d", progress=False)
        online = test is not None and not test.empty
    except Exception:
        online = False

    st.markdown(f"""
    <div style='background:rgba(255,83,112,0.06); border:1px solid rgba(255,83,112,0.25);
                border-left:4px solid #ff5370; border-radius:0 12px 12px 0; padding:24px; margin:20px 0;'>
        <div style='font-family:JetBrains Mono; font-size:11px; letter-spacing:2px; color:#ff5370;
                    text-transform:uppercase; margin-bottom:12px;'>⚠ Market Data Fetch Failed</div>
        <div style='font-size:16px; color:#fff;'><b>Ticker:</b> <code>{ticker}</code></div>
        <div style='font-size:14px; color:#d0d8ef; margin-top:6px;'>Yahoo Finance returned no data for this symbol.</div>
    </div>
    """, unsafe_allow_html=True)
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("**🌐 Connectivity**")
        st.success("✓ Yahoo Finance reachable") if online else st.error("✗ Network issue — check connection")
    with c2:
        st.markdown("**🔧 Suggestions**")
        for s in suggestions:
            st.markdown(f"  • {s}")
        if not suggestions:
            st.info("Verify at [finance.yahoo.com](https://finance.yahoo.com)")
    with st.expander("📖 Intraday Ticker Format Guide"):
        st.markdown("""
| Market | Format | Example |
|---|---|---|
| NSE India | `SYMBOL.NS` | `TATAMOTORS.NS` |
| BSE India | `SYMBOL.BO` | `TATAMOTORS.BO` |
| US Stocks | `SYMBOL` | `AAPL`, `NVDA` |
        """)

st.set_page_config(page_title="Intraday Precision · Apex AI", page_icon="⚡", layout="wide")

# The global CSS is now handled in app.py
# Pages can add specific overrides if needed.

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
        
        import hashlib
        # \u2500 Directory-based model cache (no pickle \u2013 Keras native format) \u2500
        model_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
        cache_key = hashlib.md5(f"{ticker}_{interval}_{lookback}".encode()).hexdigest()[:10]
        cache_dir = os.path.join(model_dir, f"intraday_{cache_key}")
        input_shape = (X.shape[1], X.shape[2])

        cached = os.path.isdir(cache_dir) and os.path.exists(os.path.join(cache_dir, "gru_dir.keras"))
        with st.spinner('⚡ Loading cached model...' if cached else '🧠 Training Intraday Engine (first run takes ~1 min)...'):
            try:
                if cached:
                    from utils.model import CausalTradingEngine
                    engine = CausalTradingEngine.load_from_dir(cache_dir, input_shape)
                    history_data = engine.history
                    st.toast("✓ Model loaded from cache", icon="⚡")
                else:
                    X_noisy = add_noise(X)
                    engine = create_model(input_shape=input_shape)
                    history_data = engine.train_ensemble(X_noisy, Y_dir, Y_mag, epochs=15)
                    engine.save_to_dir(cache_dir, history_data)
                    st.toast("✓ Model trained & cached", icon="📦")
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
        
        # ── Terminal Header ────────────────────────────────────────────────────────
        if ticker:
            try:
                # Calculate daily change for the header
                if len(df) > 1:
                    prev_p = df['Close'].iloc[-2]
                    d_change = (current_price / prev_p - 1) * 100
                else: d_change = 0.0
                st.markdown(terminal_header(ticker, current_price, d_change, signal), unsafe_allow_html=True)
            except Exception:
                st.markdown(f"<h1>{ticker} // SCALP TERMINAL</h1>", unsafe_allow_html=True)

        # ── HERO METRICS ──
        c1, c2, c3, c4 = st.columns(4)
        with c1:
            st.markdown(metric_card("AI TARGET", f"₹{predicted:,.2f}", "#00e5ff"), unsafe_allow_html=True)
        with c2:
            st.markdown(metric_card("CONFLUENCE", f"{conf_score}%", "#00e676"), unsafe_allow_html=True)
        with c3:
            vix_val = df['VIX'].iloc[-1] if 'VIX' in df.columns else 15.0
            vix_color = "#ff1744" if vix_val > 25 else ("#ffc107" if vix_val > 20 else "#00e676")
            st.markdown(metric_card("VIX LEVEL", f"{vix_val:.1f}", vix_color), unsafe_allow_html=True)
        with c4:
            st.markdown(metric_card("WIN RATE", f"{win_rate*100:.1f}%", "#00e5ff"), unsafe_allow_html=True)

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
            
            fig = apply_chart_style(fig)
            st.plotly_chart(fig, use_container_width=True)
        
        with tab2:
            fig_loss = go.Figure()
            fig_loss.add_trace(go.Scatter(y=history_data['loss'], name='Training Loss', line=dict(color='#00ffcc')))
            if 'val_loss' in history_data:
                fig_loss.add_trace(go.Scatter(y=history_data['val_loss'], name='Validation Loss', line=dict(color='#ff3333', dash='dash')))
            fig_loss = apply_chart_style(fig_loss)
            st.plotly_chart(fig_loss, use_container_width=True)
            
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
        _suggest_ticker_fix(ticker)
    else:
        _suggest_ticker_fix(ticker)
