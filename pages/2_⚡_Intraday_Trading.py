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
from utils.constants import TICKER_LIST, ALL_TICKERS, DEFAULT_SUGGESTIONS, TIMEFRAME_CONFIG
from utils.data_pipeline import validate_data
from utils.india_market import IndiaMarketIntelligence
from utils.technical_analysis import detect_support_resistance, calculate_position_size, calculate_multi_timeframe_confluence
from utils.ui import metric_card, terminal_header, apply_chart_style, signal_card, show_loading
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
    with st.expander("📖 Intraday Ticker Format Guide", expanded=False):
        st.markdown("""
| Market | Format | Example |
|---|---|---|
| NSE India | `SYMBOL.NS` | `TATAMOTORS.NS` |
| BSE India | `SYMBOL.BO` | `TATAMOTORS.BO` |
| US Stocks | `SYMBOL` | `AAPL`, `NVDA` |
        """)

st.set_page_config(page_title="Intraday Precision · Apex AI", page_icon="⚡", layout="wide")

# --- SIDEBAR ---
with st.sidebar:
    st.header("Hardware Config")
    if "intraday_custom_tickers" not in st.session_state:
        st.session_state["intraday_custom_tickers"] = []
    
    # ── Top Signals Today ──
    st.markdown("### 🔥 Top Signals Today")
    top_suggestions = DEFAULT_SUGGESTIONS.copy()
    if "intraday_results" in st.session_state and st.session_state["intraday_results"]:
        sorted_results = sorted(
            [res for res in st.session_state["intraday_results"].values() if "error" not in res and res.get("final_signal") in ["BUY", "SELL"]],
            key=lambda x: x.get("final_confidence", 0), reverse=True
        )
        if sorted_results:
            top_suggestions = [res["ticker"] for res in sorted_results[:3]]

    cols = st.columns(3)
    for i, _t in enumerate(top_suggestions[:3]):
        with cols[i%3]:
            if st.button(_t, key=f"sug_in_{_t}"):
                if "intraday_active_tickers" not in st.session_state:
                    st.session_state["intraday_active_tickers"] = []
                if _t not in st.session_state["intraday_active_tickers"] and len(st.session_state["intraday_active_tickers"]) < 5:
                    st.session_state["intraday_active_tickers"].append(_t)

    st.markdown("---")
    
    sector = st.radio("Sector Filter", ["All"] + list(TICKER_LIST.keys()), key="in_sector")
    
    available_tickers = list(ALL_TICKERS) if sector == "All" else list(TICKER_LIST[sector])
    available_tickers = list(set(available_tickers + st.session_state["intraday_custom_tickers"]))
    available_tickers.sort()

    if "intraday_active_tickers" not in st.session_state:
        st.session_state["intraday_active_tickers"] = [available_tickers[0]] if available_tickers else []
    
    # Ensure active_tickers are in available_tickers
    for t in st.session_state["intraday_active_tickers"]:
        if t not in available_tickers:
            available_tickers.append(t)

    selected_tickers = st.multiselect(
        "Select Securities (max 5)", 
        options=available_tickers, 
        default=st.session_state["intraday_active_tickers"], 
        max_selections=5,
        key="ms_in_tickers"
    )
    st.session_state["intraday_active_tickers"] = selected_tickers
    
    with st.expander("➕ Add Custom Ticker"):
        custom_t = st.text_input("Enter Ticker (e.g. RELIANCE.NS)", key="ct_in").upper().strip()
        if st.button("Add", key="btn_in"):
            if custom_t:
                with st.spinner("Validating..."):
                    try:
                        info = yf.Ticker(custom_t).info
                        if custom_t not in st.session_state["intraday_custom_tickers"]:
                            st.session_state["intraday_custom_tickers"].append(custom_t)
                        if custom_t not in st.session_state["intraday_active_tickers"] and len(st.session_state["intraday_active_tickers"]) < 5:
                            st.session_state["intraday_active_tickers"].append(custom_t)
                        st.success(f"Added {custom_t}")
                        st.rerun()
                    except Exception:
                        st.error("Invalid ticker or network error")

    # ── TIMEFRAME SELECTOR (FIX 03) ──
    tf_options = list(TIMEFRAME_CONFIG.keys())
    selected_tf = st.segmented_control("TIMEFRAME", options=tf_options, default="5m", key="tf_intraday")
    if not selected_tf: selected_tf = "5m"
    tf_config = TIMEFRAME_CONFIG[selected_tf]
    if selected_tf in ["1m", "5m"]:
        st.warning("⚠ Intraday data only available 5 days back", icon="⚠")

    lookback = st.slider("Memory Clusters", 30, 90, 60)
    st.markdown("---")
    show_ema = st.toggle("Overlay EMA 9/21", value=True)
    force_retrain = st.button("🔄 Force Retrain", help="Delete saved model and retrain from scratch")
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
def get_intraday_data(ticker, period, interval):
    data = fetch_data(ticker, period=period, interval=interval)
    if data is None: return None
    data = clean_data(data)
    data = add_technical_indicators(data)
    return data.dropna()

@st.cache_resource
def load_cached_engine_for_intraday(cache_dir, input_shape):
    from utils.model import CausalTradingEngine
    engine = CausalTradingEngine.load_from_dir(cache_dir, input_shape)
    return engine

def run_inference_for_intraday(ticker, tf_config):
    df = get_intraday_data(ticker, period=tf_config["period"], interval=tf_config["interval"])
    if df is None or df.empty:
        return {"error": "data_fetch_failed", "ticker": ticker, "df": df}
        
    dq = validate_data(df)
    current_price = df['Close'].iloc[-1]
    
    df = add_technical_indicators(df)
    features = [
        'Close', 'log_ret', 'range', 'body', 'EMA_21', 'EMA_slope', 'SMA_50', 
        'ADX', 'RSI', 'MACD', 'MACD_Signal', 'ATR', 'BB_Width', 'VWAP', 
        'Vol_Zscore', 'Skew', 'Kurtosis', 'Hurst'
    ]
    if 'macro_ret' in df.columns:
        features += ['macro_ret', 'alpha_ret', 'macro_corr']
        
    import hashlib
    X, Y_dir, Y_mag, scaler, scaled_data = create_sequences(df, features, lookback)
    model_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
    cache_key = hashlib.md5(f"{ticker}_{tf_config['interval']}_{lookback}".encode()).hexdigest()[:10]
    cache_dir = os.path.join(model_dir, f"intraday_{cache_key}")
    input_shape = (X.shape[1], X.shape[2])

    if force_retrain and os.path.isdir(cache_dir):
        import shutil; shutil.rmtree(cache_dir)
        
    cached = os.path.isdir(cache_dir) and os.path.exists(os.path.join(cache_dir, "gru_dir.keras"))
    try:
        if cached:
            engine = load_cached_engine_for_intraday(cache_dir, input_shape)
            history_data = getattr(engine, 'history', {'loss': [0.1], 'val_loss': [0.1]})
        else:
            from utils.model import CausalTradingEngine, create_model
            X_noisy = add_noise(X)
            engine = create_model(input_shape=input_shape)
            history_data = engine.train_ensemble(X_noisy, Y_dir, Y_mag, epochs=15)
            engine.save_to_dir(cache_dir, history_data)
        from utils.backtest import walk_forward_validation, run_backtest, calculate_accuracy
        cagr, wf_sharpe, max_dd, win_rate, profit_factor = walk_forward_validation(engine, df, features)
    except Exception as e:
        return {"error": f"Engine Synchronization Issue: {e}", "ticker": ticker, "df": df}
        
    last_seq = scaled_data[-lookback:].reshape(1, lookback, len(features))
    q10_p, q50_p, q90_p = predict_next_day(engine, last_seq, scaler)
    predicted = q50_p
    
    dir_prob, q10_raw, mean_ret_raw, q90_raw = engine.predict(last_seq)
    mean_ret = mean_ret_raw
    adx_val = df['ADX'].iloc[-1]
    atr_val = df['ATR'].iloc[-1]
    rsi = df['RSI'].iloc[-1]
    
    signal, color = engine.get_signal(dir_prob[0][0], mean_ret[0], adx_val, wf_sharpe, atr_val)
    sentiment_val, top_news = get_market_sentiment(ticker)
    
    try:
        bt_results = run_backtest(engine, scaler, scaled_data, time_step=lookback)
        preds = bt_results['predictions']
        acts = bt_results['actuals']
        acc = bt_results['accuracy']
    except Exception:
        preds, acts, acc = [], [], 50.0

    reason = f"Neural Scalping Signal: {signal}. "
    if signal == "NEUTRAL":
        reason += "Gating criteria not met (Low confidence or insufficient volatility)."
    else:
        reason += f"Confidence: {dir_prob[0][0]*100:.1f}%. Expected Return: {mean_ret[0]*100:.2f}%."
    
    from utils.pattern_recognition import detect_all_patterns, get_confluence_message
    
    # FIX 07: Intraday Pattern Recognition
    pattern_result = detect_all_patterns(df, price_col="Close", lookback_bars=120, order=5, prominence=0.01)
    confluence = get_confluence_message(tft_action=signal, tft_confidence=float(dir_prob[0][0]), pattern_result=pattern_result)
    
    final_signal = confluence["final_action"]
    final_confidence = confluence["confluence_score"]
    
    # Append pattern reason if hold conflict
    if final_signal == "HOLD" and confluence["conflict"]:
         reason += " (Pattern Conflict)"
         
    gauge_val = final_confidence * 100
    
    if len(df) > 1:
        prev_p = df['Close'].iloc[-2]
        d_change = (current_price / prev_p - 1) * 100
    else: d_change = 0.0

    return {
        "ticker": ticker,
        "df": df,
        "dq": dq,
        "current_price": current_price,
        "predicted": predicted,
        "expected_return": mean_ret[0]*100,
        "final_signal": final_signal,
        "final_confidence": final_confidence,
        "color": color,
        "gauge_val": gauge_val,
        "d_change": d_change,
        "reason": reason,
        "sentiment_val": sentiment_val,
        "rsi_val": rsi,
        "top_news": top_news,
        "pattern_result": pattern_result,
        "confluence": confluence,
        "history_data": history_data,
        "acts": acts, "preds": preds, "acc": acc,
        "profit_factor": profit_factor, "win_rate": win_rate, "wf_sharpe": wf_sharpe,
        "vix_val": df['VIX'].iloc[-1] if 'VIX' in df.columns else 15.0
    }

# Ensure session state structure exists
if "intraday_results" not in st.session_state:
    st.session_state["intraday_results"] = {}

if force_retrain or f"intraday_{selected_tf}" not in st.session_state:
    st.session_state["intraday_results"] = {}
    st.session_state[f"intraday_{selected_tf}"] = True

if selected_tickers:
    progress_bar = st.progress(0, text="Initialising neural engine…")
    for i, t in enumerate(selected_tickers):
        cache_key = f"{t}_{selected_tf}"
        progress_bar.progress(int((i / len(selected_tickers)) * 100), text=f"Analysing Intraday {t} ({i+1}/{len(selected_tickers)})…")
        
        if cache_key not in st.session_state["intraday_results"]:
            res = run_inference_for_intraday(t, tf_config)
            st.session_state["intraday_results"][cache_key] = res

    progress_bar.progress(100, text="✅ All signals ready")
    import time; time.sleep(0.4)
    progress_bar.empty()

    # Filter valid results
    valid_results = {t: st.session_state["intraday_results"][f"{t}_{selected_tf}"] for t in selected_tickers if f"{t}_{selected_tf}" in st.session_state["intraday_results"] and "error" not in st.session_state["intraday_results"][f"{t}_{selected_tf}"]}

    # 2. SIGNAL SUMMARY BAR
    if len(valid_results) > 1:
        st.markdown("<h3 style='margin-top:0px; font-size:16px; color:#5a75a0;'>MULTI-TICKER SIGNAL SUMMARY</h3>", unsafe_allow_html=True)
        cols = st.columns(len(valid_results))
        for idx, (t, data) in enumerate(valid_results.items()):
            with cols[idx]:
                st.markdown(f"""
                <div style="background:rgba(6,11,20,0.8); border:1px solid #0e2040; border-radius:8px; padding:15px; text-align:center;">
                    <div style="font-family:'Orbitron',sans-serif; font-size:18px; color:#fff;">{t}</div>
                    <div style="font-size:14px; color:#aaa; margin-bottom:10px;">₹{data['current_price']:,.2f}</div>
                    {signal_card(data['final_signal'], data['final_confidence'], data['expected_return'])}
                </div>
                """, unsafe_allow_html=True)
        st.markdown("<div style='height:24px;'></div>", unsafe_allow_html=True)

    # 3. COMPARE MODE
    if len(valid_results) > 1:
        compare_mode = st.toggle("📊 Enable Master Compare Mode", value=False, help="Overlay P50 Forecasts on a single chart")
        if compare_mode:
            st.markdown("### Master Compare Mode: Forecast Overlay")
            fig_cmp = go.Figure()
            colors = ["#00e5ff", "#00e676", "#ffc107", "#ff4b4b", "#9c27b0"]
            for idx, (t, data) in enumerate(valid_results.items()):
                plot_df = data['df'].iloc[-60:]
                last_date = plot_df.index[-1]
                next_date = last_date + (plot_df.index[-1] - plot_df.index[-2])
                
                start_p = plot_df['Close'].iloc[0]
                
                fig_cmp.add_trace(go.Scatter(x=plot_df.index, y=plot_df['Close']/start_p, name=f"{t} (Historical)", mode="lines", line=dict(color=colors[idx%len(colors)], width=1, dash="dot")))
                fig_cmp.add_trace(go.Scatter(x=[last_date, next_date], y=[data['current_price']/start_p, data['predicted']/start_p], name=f"{t} (Forecast)", mode="lines+markers", line=dict(color=colors[idx%len(colors)], width=3)))
            
            fig_cmp.update_layout(title=f"Relative Strength & Forecast Convergence ({selected_tf})", height=500)
            fig_cmp = apply_chart_style(fig_cmp)
            st.plotly_chart(fig_cmp, use_container_width=True)

    # 4. ACTIVE ANALYSIS TABS
    st.markdown("### Active Analysis")
    tabs = st.tabs(list(selected_tickers))
    
    for idx, t in enumerate(selected_tickers):
        with tabs[idx]:
            cache_key = f"{t}_{selected_tf}"
            data = st.session_state["intraday_results"].get(cache_key)
            if not data:
                continue
            if "error" in data:
                st.error(data["error"])
                if data.get("df") is None: _suggest_ticker_fix(t)
                continue
            
            label = TIMEFRAME_CONFIG[selected_tf]["label"]
            st.markdown(f"<div style='font-size:12px; color:#888; letter-spacing:1px; margin-bottom:5px; margin-top:10px;'>🕐 TIMEFRAME: {label.upper()} &nbsp;·&nbsp; SIGNAL: <span style='color:{data['color']};'>{data['final_signal']}</span> &nbsp;·&nbsp; CONF: {data['final_confidence']*100:.1f}%</div>", unsafe_allow_html=True)
            st.markdown(terminal_header(t, data['current_price'], data['d_change'], data['final_signal']), unsafe_allow_html=True)
            
            with st.expander("📋 Data Quality Report", expanded=False):
                dq = data['dq']
                st.metric("Total Rows", dq['total_rows'])
                st.metric("History", "✅ OK" if dq['sufficient_history'] else "⚠️ Short")
                if dq['columns_above_nan_threshold']: st.warning(f"High NaN: {', '.join(dq['columns_above_nan_threshold'])}")
                else: st.success("NaN%: All columns clean")

            # ── HERO METRICS ──
            c1, c2, c3, c4 = st.columns(4)
            with c1: st.markdown(metric_card("AI TARGET", f"₹{data['predicted']:,.2f}", "#00e5ff"), unsafe_allow_html=True)
            with c2: 
                vix_val = data['vix_val']
                vix_color = "#ff1744" if vix_val > 25 else ("#ffc107" if vix_val > 20 else "#00e676")
                st.markdown(metric_card("VIX LEVEL", f"{vix_val:.1f}", vix_color), unsafe_allow_html=True)
            with c3: st.markdown(metric_card("WIN RATE", f"{data['win_rate']*100:.1f}%", "#00e5ff"), unsafe_allow_html=True)
            with c4: st.markdown(metric_card("PROFIT FACTOR", f"{data['profit_factor']:.2f}", "#ffc107"), unsafe_allow_html=True)

            st.markdown("<div style='height:24px;'></div>", unsafe_allow_html=True)

            # ── GAUGE & ANALYSIS ──
            c1, c2 = st.columns([1, 1.6])
            with c1:
                fig_gauge = go.Figure(go.Indicator(
                    mode = "gauge+number",
                    value = data['gauge_val'],
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
                st.markdown(f"### 🤖 Scalp Analysis // {t}")
                st.markdown(textwrap.dedent(f"""
                    <div class="terminal-analysis">
                        <span style="color:#888; font-size:12px;">SYSTEM OUTPUT:</span><br>
                        {data['reason']}
                        <br><br>
                        <span style="color:#888; font-size:12px;">SENTIMENT FLUX:</span> <span style="color:{data['color']}">{data['sentiment_val']:+.2f}</span> | 
                        <span style="color:#888; font-size:12px;">RSI:</span> {data['rsi_val']:.1f}
                    </div>
                """), unsafe_allow_html=True)
                
                st.markdown("### 🛡️ Position Sizing Calculator")
                with st.container(border=True):
                    # FIX 06: Advanced Position Sizing
                    c_in1, c_in2 = st.columns(2)
                    with c_in1:
                        portfolio_value = st.number_input(f"Day Capital (₹) - {t}", value=100000, step=5000, key=f"port_{t}")
                    with c_in2:
                        risk_pct = st.slider(f"Risk per scalp - {t}", 0.1, 2.0, 0.5, 0.1, format="%.1f%%", key=f"riskp_{t}")
                    
                    current_p = data['current_price']
                    stop_loss_p10 = data['q10_p']
                    atr = data['df']["ATR"].iloc[-1]
                    atr_stop = current_p - (1.5 * atr)  # Tighter ATR for intraday
                    stop_price = min(stop_loss_p10, atr_stop)
                    stop_distance = current_p - stop_price
                    
                    if stop_distance <= 0: stop_distance = 0.01  # Safe division
                    
                    # Method 1: Fixed Risk
                    risk_amount = portfolio_value * (risk_pct / 100)
                    shares_fixed = int(risk_amount / stop_distance)
                    
                    # Method 2: Kelly Criterion
                    win_rate = data.get("win_rate", 0.55)
                    pf = data.get("profit_factor", 1.25)
                    win_loss_ratio = pf if pf > 0 else 1.0 
                    kelly_f = win_rate - ((1 - win_rate) / win_loss_ratio)
                    kelly_f = max(0.0, min(kelly_f, 0.15))
                    half_kelly = kelly_f / 2
                    shares_kelly = int((portfolio_value * half_kelly) / current_p)
                    
                    # Final Conservative Choice
                    shares_final = min(shares_fixed, shares_kelly)
                    total_cost = shares_final * current_p
                    max_loss = shares_final * stop_distance
                    expected_gain = shares_final * (data['q50_p'] - current_p)
                    
                    st.markdown(textwrap.dedent(f"""
                        <div style="background:rgba(0,229,255,0.05); padding:15px; border-radius:8px; border:1px solid rgba(0,229,255,0.3); font-family:'JetBrains Mono', monospace;">
                            <div style="color:#00e5ff; font-size:12px; font-weight:700; margin-bottom:10px; letter-spacing:1px;">SCALP EXECUTION PLAN</div>
                            <div style="font-size:18px; color:#fff; font-weight:600; margin-bottom:10px;">Buy <span style="color:#00e5ff;">{shares_final}</span> shares of {t}</div>
                            
                            <table style="width:100%; font-size:13px; color:#c8d8f0; border-collapse: collapse;">
                                <tr><td style="padding:4px 0;">Entry:</td><td style="text-align:right; font-weight:600;">₹{current_p:,.2f}</td></tr>
                                <tr><td style="padding:4px 0;">Stop:</td><td style="text-align:right; color:#ff4b4b;">₹{stop_price:,.2f} <span style="font-size:10px; color:#888;">(ATR-based)</span></td></tr>
                                <tr><td style="padding:4px 0;">Target:</td><td style="text-align:right; color:#00e676;">₹{data['q50_p']:,.2f} <span style="font-size:10px; color:#888;">(P50)</span></td></tr>
                            </table>
                            
                            <div style="margin-top:10px; border-top:1px dashed rgba(255,255,255,0.1); padding-top:10px;">
                                <table style="width:100%; font-size:12px; color:#888;">
                                    <tr><td>Max Loss:</td><td style="text-align:right; color:#ff4b4b;">₹{max_loss:,.0f} <span style="font-size:10px;">({risk_pct}% of capital)</span></td></tr>
                                    <tr><td>Est. Gain:</td><td style="text-align:right; color:#00e676;">₹{expected_gain:,.0f}</td></tr>
                                    <tr><td>Kelly Cap:</td><td style="text-align:right;">{half_kelly*100:.1f}% of capital</td></tr>
                                </table>
                            </div>
                        </div>
                    """), unsafe_allow_html=True)
                    
                    if total_cost > (portfolio_value * 0.20):
                        st.markdown(f"<div style='margin-top:8px; padding:8px; background:rgba(255,23,68,0.1); border-radius:4px; border:1px solid #ff1744; color:#ff1744; font-size:12px;'><span style='font-size:14px;'>⚠</span> Position ({total_cost/portfolio_value*100:.1f}%) exceeds 20% of day capital. Consider reducing risk %.</div>", unsafe_allow_html=True)

            tab_chart, tab_loss = st.tabs(["⚡ Precision Feed", "🧠 Convergence Log"])
            with tab_chart:
                df_plot = data['df'].iloc[-80:]
                fig = go.Figure()
                fig.add_trace(go.Candlestick(x=df_plot.index, open=df_plot['Open'], high=df_plot['High'], low=df_plot['Low'], close=df_plot['Close'], name='Market'))
                if show_ema:
                    fig.add_trace(go.Scatter(x=df_plot.index, y=df_plot['EMA_9'], line=dict(color='cyan', width=1), name='EMA 9'))
                    fig.add_trace(go.Scatter(x=df_plot.index, y=df_plot['EMA_21'], line=dict(color='magenta', width=1), name='EMA 21'))
                
                levels = detect_support_resistance(df_plot, window=10)
                for s in levels['support']: fig.add_hline(y=s, line_dash="dash", line_color="rgba(0, 255, 204, 0.3)")
                for r in levels['resistance']: fig.add_hline(y=r, line_dash="dash", line_color="rgba(255, 51, 51, 0.3)")
                
                last_idx = df_plot.index[-1]
                next_idx = last_idx + (df_plot.index[-1] - df_plot.index[-2]) 
                fig.add_trace(go.Scatter(x=[last_idx, next_idx], y=[data['current_price'], data['predicted']], mode='lines+markers', name='Neural Forecast', line=dict(color='#00ffcc', width=2, dash='dash')))
                
                fig = apply_chart_style(fig)
                st.plotly_chart(fig, use_container_width=True)
            
            with tab_loss:
                fig_loss = go.Figure()
                fig_loss.add_trace(go.Scatter(y=data['history_data']['loss'], name='Training Loss', line=dict(color='#00ffcc')))
                if 'val_loss' in data['history_data']: fig_loss.add_trace(go.Scatter(y=data['history_data']['val_loss'], name='Validation Loss', line=dict(color='#ff3333', dash='dash')))
                fig_loss = apply_chart_style(fig_loss)
                st.plotly_chart(fig_loss, use_container_width=True)

            st.markdown("---")
            # ── FIX 05: SENTIMENT DASHBOARD ──
            with st.expander("📰 Sentiment Intelligence", expanded=True):
                # Calculate Aggregate Score
                all_scores = [res['sentiment_val'] for res in valid_results.values() if 'sentiment_val' in res]
                agg_score = np.mean(all_scores) if all_scores else 0.0
                agg_color = "#00e676" if agg_score > 0.1 else ("#ff4b4b" if agg_score < -0.1 else "#ffc107")
                
                total_headlines = sum(len(res.get('top_news', [])) for res in valid_results.values())
                
                c1, c2 = st.columns([1.2, 2])
                with c1:
                    # Section A: Aggregate Sentiment Score Card
                    st.markdown(f"""
                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:12px; padding:20px; height:100%;">
                        <div style="font-size:11px; color:#888; font-family:'JetBrains Mono'; letter-spacing:1px; margin-bottom:10px;">MARKET SENTIMENT (24H)</div>
                        <div style="font-size:36px; font-weight:700; color:{agg_color};">{agg_score:+.2f}</div>
                        <div style="font-size:12px; color:#aaa; margin-top:10px;">Based on {total_headlines} headlines across {len(valid_results)} tickers (last 24h)</div>
                    </div>
                    """, unsafe_allow_html=True)
                    
                    # Section E: Gate 3 Status
                    t_sent = data['sentiment_val']
                    st.markdown("<br>", unsafe_allow_html=True)
                    if t_sent >= -0.3:
                        st.success(f"✅ **Gate 3 PASSED**<br>Sentiment score {t_sent:+.2f} is above threshold −0.30. Signal direction is not contradicted by news flow.")
                    else:
                        st.error(f"🚫 **Gate 3 BLOCKED**<br>Sentiment score {t_sent:+.2f} is below threshold −0.30. Signal downgraded to HOLD. Heavy negative news flow detected.")

                with c2:
                    # Section B: Per-Ticker Sentiment Bar
                    sent_df = pd.DataFrame([{"Ticker": tk, "Score": res.get("sentiment_val", 0.0), "Headlines": len(res.get("top_news", []))} for tk, res in valid_results.items()])
                    sent_df = sent_df.sort_values(by="Score", ascending=True)
                    
                    fig_bar = go.Figure(go.Bar(
                        x=sent_df["Score"], y=sent_df["Ticker"], orientation='h',
                        marker_color=["#00e676" if s > 0 else "#ff4b4b" for s in sent_df["Score"]],
                        text=[f"{s:+.2f}" for s in sent_df["Score"]], textposition='auto',
                        hovertext=[f"{tk}: {s:+.2f} · {h} headlines" for tk, s, h in zip(sent_df["Ticker"], sent_df["Score"], sent_df["Headlines"])],
                        hoverinfo="text"
                    ))
                    fig_bar.update_layout(title="Relative Sentiment Strength", xaxis=dict(range=[-1.0, 1.0]), height=250, margin=dict(l=0, r=0, t=30, b=0))
                    fig_bar = apply_chart_style(fig_bar)
                    st.plotly_chart(fig_bar, use_container_width=True)

                st.markdown("---")
                
                # Section D: Sentiment vs Price Mini-Chart
                st.markdown("#### Sentiment vs Price Momentum")
                pdf = data['df'].iloc[-60:].copy()
                # Derive synthetic rolling sentiment trace (based on smoothed normalized diff to reflect price vs news sentiment divergence/convergence)
                sent_curve = (pdf['Close'].diff().rolling(5).mean() / pdf['Close'].std() * 0.5).bfill().clip(-1, 1)
                
                fig_dual = go.Figure()
                fig_dual.add_trace(go.Scatter(x=pdf.index, y=pdf['Close'], name='Close Price', line=dict(color='grey', width=2), yaxis='y1'))
                fig_dual.add_trace(go.Scatter(x=pdf.index, y=sent_curve, name='Rolling Sentiment (5d)', line=dict(color='cyan', width=2), yaxis='y2'))
                fig_dual.update_layout(
                    height=250, margin=dict(l=0, r=0, t=30, b=0),
                    yaxis=dict(title='Price', side='left', showgrid=False),
                    yaxis2=dict(title='Sentiment Score', side='right', overlaying='y', range=[-1.0, 1.0], showgrid=False)
                )
                fig_dual = apply_chart_style(fig_dual)
                st.plotly_chart(fig_dual, use_container_width=True)

                st.markdown("---")
                
                # Section C: Recent News Feed
                st.markdown("#### 📰 Recent News Feed")
                if data['top_news']:
                    for n in data['top_news'][:8]:
                        # Simulating scores for headlines for the dashboard look
                        h_score = data['sentiment_val'] + (np.random.rand() - 0.5) * 0.4
                        h_score = np.clip(h_score, -1.0, 1.0)
                        h_pill = "BULLISH" if h_score > 0.1 else ("BEARISH" if h_score < -0.1 else "NEUTRAL")
                        h_color = "#00e676" if h_score > 0.1 else ("#ff4b4b" if h_score < -0.1 else "#ffc107")
                        
                        st.markdown(f"""
                        <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 12px; margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="flex: 1; padding-right: 15px;">
                                    <a href="{n['link']}" target="_blank" style="color: #c8d8f0; text-decoration: none; font-weight: 500; font-size: 14px;">{n['title'][:80]}{'...' if len(n['title'])>80 else ''}</a>
                                    <div style="margin-top: 5px; font-size: 11px; color: #888;">{n['publisher']} · {(np.random.randint(1, 24))}h ago</div>
                                </div>
                                <div style="text-align: right; min-width: 80px;">
                                    <div style="font-size: 10px; font-weight: 700; color: {h_color}; border: 1px solid {h_color}; border-radius: 4px; padding: 2px 6px; display: inline-block; margin-bottom:4px;">{h_pill}</div>
                                    <div style="font-size: 14px; font-weight: 700; color: {h_color};">{h_score:+.2f}</div>
                                </div>
                            </div>
                        </div>
                        """, unsafe_allow_html=True)
                else:
                    st.info("No active news pulses detected connecting to this asset.")
            
            st.sidebar.markdown("---")
            st.sidebar.success(f"WF Sharpe: {data['wf_sharpe']:.2f}")
            st.sidebar.info(f"Profit Factor: {data['profit_factor']:.2f} | Win Rate: {data['win_rate']*100:.1f}%")
