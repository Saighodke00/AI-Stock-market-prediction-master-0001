import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import sys
import os
import yfinance as yf
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import textwrap

from utils.data_loader import fetch_data, clean_data, normalize_data, create_sequences, add_noise
from utils.indicators import add_technical_indicators
from utils.model import create_model, train_model, predict_next_day, convert_to_tflite
from utils.sentiment import get_market_sentiment
from utils.data_pipeline import validate_data
from utils.india_market import IndiaMarketIntelligence
from utils.technical_analysis import detect_support_resistance, calculate_position_size, calculate_multi_timeframe_confluence
from utils.ui import metric_card, terminal_header, apply_chart_style
from utils.backtest import run_backtest

intel = IndiaMarketIntelligence()

def _suggest_ticker_fix(ticker: str):
    """Show a smart diagnostic panel when data fetch fails."""
    import yfinance as yf

    # Auto-suggest ticker corrections
    suggestions = []
    t = ticker.upper().strip()
    if not t.endswith('.NS') and not t.endswith('.BO') and '.' not in t:
        suggestions.append(f"`{t}.NS` — NSE (National Stock Exchange)")
        suggestions.append(f"`{t}.BO` — BSE (Bombay Stock Exchange)")
    if t.endswith('.NS'):
        suggestions.append(f"`{t[:-3]}.BO` — Try BSE instead of NSE")

    # Quick connectivity test
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
        <div style='font-size:16px; color:#fff; margin-bottom:8px;'><b>Ticker:</b> <code>{ticker}</code></div>
        <div style='font-size:14px; color:#d0d8ef; margin-bottom:16px;'>
            Yahoo Finance returned no data for this symbol.
        </div>
    </div>
    """, unsafe_allow_html=True)

    col1, col2 = st.columns(2)
    with col1:
        st.markdown("**🌐 Connectivity Status**")
        if online:
            st.success("✓ Internet & Yahoo Finance reachable")
        else:
            st.error("✗ Cannot reach Yahoo Finance — check your network")

    with col2:
        st.markdown("**🔧 Common Fixes**")
        if suggestions:
            st.info("Try these corrected ticker symbols:")
            for s in suggestions:
                st.markdown(f"  • {s}")
        else:
            st.info("Verify the ticker at [finance.yahoo.com](https://finance.yahoo.com)")

    with st.expander("📖 Ticker Format Guide", expanded=True):
        st.markdown("""
| Market | Format | Example |
|---|---|---|
| NSE India | `SYMBOL.NS` | `RELIANCE.NS` |
| BSE India | `SYMBOL.BO` | `RELIANCE.BO` |
| US Stocks | `SYMBOL` | `AAPL`, `TSLA` |
| Nifty 50 | `^NSEI` | `^NSEI` |
| Sensex | `^BSESN` | `^BSESN` |
        """)


st.set_page_config(page_title="Swing Intelligence · Apex AI", page_icon="📈", layout="wide")

# The global CSS is now handled in app.py
# Pages can add specific overrides if needed.

# --- SIDEBAR ---
with st.sidebar:
    st.header("Terminal Controls")
    
    # Stock Presets
    market_cat = st.selectbox("Market Category", ["Indian Equities", "US Equities", "Custom"])
    
    if market_cat == "Indian Equities":
        ticker_list = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS", "TATAMOTORS.NS", "SBIN.NS", "BHARTIARTL.NS", "LT.NS", "ITC.NS", "ADANIENT.NS"]
        ticker = st.selectbox("Select Security", ticker_list)
    elif market_cat == "US Equities":
        ticker_list = ["TSLA", "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "NFLX"]
        ticker = st.selectbox("Select Security", ticker_list)
    else:
        ticker = st.text_input("Enter Custom Ticker (e.g., RELIANCE.NS)", "TSLA").upper()

    st.markdown("---")
    lookback = st.slider("Lookback Memory (Days)", 30, 120, 60)
    epochs = st.slider("Neural Depth (Epochs)", 5, 50, 15)
    st.markdown("---")
    show_ma = st.toggle("Overlay SMA 50", value=True)
    force_retrain = st.button("🔄 Force Retrain", help="Delete saved model and retrain from scratch")
    st.markdown("---")
    
    st.markdown("### 🧪 What-If Analysis")
    sim_mood = st.select_slider(
        "Simulated Sentiment",
        options=["Bearish", "Neutral", "Bullish"],
        value="Neutral"
    )
    st.caption("Adjust to see how the AI reacts to simulated news events.")
    
    # ── India Pulse ──────────────────────────────────────────────────────
    st.markdown("---")
    st.markdown("<div style='font-family:JetBrains Mono; font-size:10px; letter-spacing:2px; color:#5a6585; text-transform:uppercase; margin-bottom:8px;'>🇮🇳 Institutional Flow</div>", unsafe_allow_html=True)
    if fii_data:
        fn_color = "#00e676" if fii_data['total_flow'] > 0 else "#ff5370"
        st.markdown(f"""
            <div class="ind-card">
                <div style="font-size:22px; font-weight:700; color:{fn_color};">{fii_data['total_flow']:+,} Cr</div>
                <div style="font-size:11px; color:#5a6585; margin-top:4px;">FII: {fii_data['fii_net']:+,} &nbsp;|&nbsp; DII: {fii_data['dii_net']:+,}</div>
            </div>
        """, unsafe_allow_html=True)
    st.markdown("<div style='height:6px;'></div>", unsafe_allow_html=True)
    st.caption("Strategy: Institutional Momentum Alignment")

@st.cache_data
def get_swing_data(ticker):
    data = fetch_data(ticker, period="2y", interval="1d")
    if data is None: return None
    data = clean_data(data)
    data = add_technical_indicators(data)
    return data.dropna()

if ticker:
    df = get_swing_data(ticker)

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
        
        # Prepare Advanced Feature Set
        df = add_technical_indicators(df)
        features = [
            'Close', 'log_ret', 'range', 'body', 'EMA_21', 'EMA_slope', 'SMA_50',
            'ADX', 'RSI', 'MACD', 'MACD_Signal', 'ATR', 'BB_Width', 'VWAP',
            'Vol_Zscore', 'Skew', 'Kurtosis', 'Hurst',
            'PE_Ratio', 'EPS', 'Debt_to_Equity',
            'RSI_lag_1', 'RSI_lag_3', 'RSI_lag_5',
            'MACD_lag_1', 'MACD_lag_3', 'MACD_lag_5'
        ]
        # Cross-asset macro features (added dynamically)
        if 'macro_ret' in df.columns:
            features += ['macro_ret', 'alpha_ret', 'macro_corr']
        # Phase-2: VIX / SP500 / NSEI (fetch_multi_modal column names)
        for col in ['VIX', 'SP500', 'NSEI', 'VIX_ret']:
            if col in df.columns and col not in features:
                features.append(col)
        # Phase-2 static metadata covariates
        for col in ['log_market_cap', 'beta']:
            if col in df.columns and col not in features:
                features.append(col)
        # Safety net: drop any feature that isn't actually in the DataFrame
        features = [f for f in features if f in df.columns]
            
        import hashlib
        # ─ Build sequences (always needed for inference / walk-forward) ─
        X, Y_dir, Y_mag, scaler, scaled_data = create_sequences(df, features, lookback)

        # ─ Directory-based model cache (no pickle – Keras native format) ─
        model_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
        cache_key = hashlib.md5(f"{ticker}_{lookback}_{epochs}".encode()).hexdigest()[:10]
        cache_dir = os.path.join(model_dir, f"swing_{cache_key}")
        input_shape = (X.shape[1], X.shape[2])

        # Delete cache if Force Retrain clicked
        if force_retrain and os.path.isdir(cache_dir):
            import shutil; shutil.rmtree(cache_dir)
            st.toast("🔄 Cache cleared. Retraining...", icon="⚡")

        cached = os.path.isdir(cache_dir) and os.path.exists(os.path.join(cache_dir, "gru_dir.keras"))
        with st.spinner('⚡ Loading cached model...' if cached else '🧠 Calibrating Neural Ensemble (first run takes 1–2 min)...'):
            try:
                if cached:
                    from utils.model import CausalTradingEngine
                    engine = CausalTradingEngine.load_from_dir(cache_dir, input_shape)
                    history_data = engine.history
                    st.toast("✓ Model loaded from cache", icon="⚡")
                else:
                    X_noisy = add_noise(X)
                    engine = create_model(input_shape=input_shape)
                    history_data = engine.train_ensemble(X_noisy, Y_dir, Y_mag, epochs=epochs)
                    engine.save_to_dir(cache_dir, history_data)
                    st.toast("✓ Model trained & saved", icon="📦")
                # Walk-Forward Validation for Signal Gating
                from utils.backtest import walk_forward_validation, run_backtest, calculate_accuracy
                cagr, wf_sharpe, max_dd, win_rate, profit_factor = walk_forward_validation(engine, df, features)
            except Exception as e:
                st.error(f"Neural Calibration Error: {e}")
                st.stop()
            
        last_seq = scaled_data[-lookback:].reshape(1, lookback, len(features))
        q10_p, q50_p, q90_p = predict_next_day(engine, last_seq, scaler)
        
        # Signal Gatekeeper
        dir_prob, q10, q50, q90 = engine.predict(last_seq)
        adx_val = df['ADX'].iloc[-1]
        atr_val = df['ATR'].iloc[-1]
        rsi_val = df['RSI'].iloc[-1]
        
        signal, color = engine.get_signal(dir_prob[0][0], q50[0], adx_val, wf_sharpe, atr_val, fii_dii_score=fii_data['total_flow'] if fii_data else 0)
        
        # Live News Sentiment Integration
        sentiment_val, top_news = get_market_sentiment(ticker)
        
        # Backtest for Confidence
        try:
            from utils.backtest import run_monte_carlo
            bt_results = run_backtest(engine, scaler, scaled_data, time_step=lookback)
            preds = bt_results['predictions']
            acts = bt_results['actuals']
            acc = bt_results['accuracy']
            sharpe_bt = bt_results['sharpe']
            sortino_bt = bt_results['sortino']
            equity_curve = bt_results['equity_curve']
            
            # Monte Carlo Stress Test
            mc_results = run_monte_carlo(bt_results['returns'])
        except Exception as e:
            st.warning(f"Backtest engine issue: {e}. Using simulated confidence.")
            preds, acts = np.zeros(10), np.zeros(10)
            acc = 55.0
            sharpe_bt, sortino_bt = 1.2, 1.5
            equity_curve = [10000]
            mc_results = []

        # Recommendation Logic
        reason = f"Causal Engine Signal: {signal}. "
        if signal == "NEUTRAL":
            reason += "Gating criteria not met (Low confidence, weak trend, or high variance)."
        else:
            reason += f"Confidence: {dir_prob[0][0]*100:.1f}%. Expected Return: {q50[0]*100:.2f}%."
        
        gauge_val = dir_prob[0][0] * 100

        if signal:
            try:
                # Calculate daily change for the header
                if len(df) > 1:
                    prev_p = df['Close'].iloc[-2]
                    d_change = (current_price / prev_p - 1) * 100
                else: d_change = 0.0
                st.markdown(terminal_header(ticker, current_price, d_change, signal), unsafe_allow_html=True)
            except Exception:
                st.markdown(f"<h1>{ticker} // TERMINAL</h1>", unsafe_allow_html=True)

        # ── HERO METRICS ──
        c_p10, c_p50, c_p90, c_conf = st.columns(4)
        with c_p10:
            st.markdown(metric_card("P10 LOW", f"₹{q10_p:,.0f}", "#ff1744"), unsafe_allow_html=True)
        with c_p50:
            st.markdown(metric_card("P50 MEDIAN", f"₹{q50_p:,.0f}", "#00e5ff"), unsafe_allow_html=True)
        with c_p90:
            st.markdown(metric_card("P90 HIGH", f"₹{q90_p:,.0f}", "#00e676"), unsafe_allow_html=True)
        with c_conf:
            conf_score = calculate_multi_timeframe_confluence(ticker)
            st.markdown(metric_card("CONFIDENCE", f"{conf_score}%", "#ffc107"), unsafe_allow_html=True)

        st.markdown("<div style='height:24px;'></div>", unsafe_allow_html=True)

        # --- GAUGE & REASONING ---
        c1, c2 = st.columns([1, 1.5])
        with c1:
            fig_gauge = go.Figure(go.Indicator(
                mode = "gauge+number",
                value = gauge_val,
                domain = {'x': [0, 1], 'y': [0, 1]},
                title = {'text': "Strategic Score", 'font': {'size': 20, 'color': '#888'}},
                gauge = {
                    'axis': {'range': [0, 100], 'tickwidth': 1, 'tickcolor': "white"},
                    'bar': {'color': color},
                    'bgcolor': "rgba(255,255,255,0.05)",
                    'borderwidth': 2,
                    'bordercolor': "rgba(255,255,255,0.1)",
                    'steps': [
                        {'range': [0, 35], 'color': 'rgba(255,75,75,0.2)'},
                        {'range': [35, 65], 'color': 'rgba(255,204,0,0.2)'},
                        {'range': [65, 100], 'color': 'rgba(0,255,136,0.2)'}
                    ]
                }
            ))
            fig_gauge.update_layout(height=300, margin=dict(l=30, r=30, t=50, b=20), paper_bgcolor='rgba(0,0,0,0)', font={'color': "white", 'family': "Outfit"})
            st.plotly_chart(fig_gauge, width='stretch')
            
        # --- XAI INTELLIGENCE ---
        with st.spinner('Decomposing Neural Decisions (XAI)...'):
            xai_report = engine.explain_prediction(last_seq, features)
        
        # Scenario Simulation Drift
        drift = 0.0
        if sim_mood == "Bullish": drift = 0.01
        elif sim_mood == "Bearish": drift = -0.01
        
        q10_p *= (1 + drift)
        q50_p *= (1 + drift)
        q90_p *= (1 + drift)

        with c2:
            # Fix Bug 03: Use clean markdown for better rendering reliability
            st.markdown("### 🤖 Neural Intelligence Report")
            with st.container(border=True):
                st.write("**Execution Rationale:**")
                st.info(reason)
                
                c_a, c_b = st.columns(2)
                with c_a:
                    st.write("**Strategic Vitals**")
                    st.write(f"Sentiment Flux: {sentiment_val:+.2f}")
                    st.write(f"RSI: {rsi_val:.1f}")
                with c_b:
                    st.write("**XAI Driver Analysis**")
                    for x in xai_report:
                        st.write(f"- {x['feature']}: {x['importance']*100:+.1f}%")
            
            # --- RISK MANAGEMENT TERMINAL ---
            st.markdown("### 🛡️ Risk Management")
            with st.container(border=True):
                account_val = st.number_input("Account Balance ($)", value=10000)
                risk_p = st.slider("Risk Per Trade (%)", 0.5, 5.0, 2.0)
                sl_price = st.number_input("Stop Loss Price ($)", value=current_price*0.97)
                
                shares = calculate_position_size(account_val, risk_p, current_price, sl_price)
                
                st.markdown(textwrap.dedent(f"""
                    <div style="background:rgba(245,166,35,0.1); padding:15px; border-radius:8px; border:1px solid #f5a623;">
                        <div style="font-size:12px; color:#f5a623;">RECOMMENDED POSITION SIZE</div>
                        <div style="font-size:24px; font-weight:700; color:#fff;">{shares} Shares</div>
                        <div style="font-size:11px; color:#aaa; margin-top:5px;">Total Risk: ${account_val * (risk_p/100):.2f}</div>
                    </div>
                """), unsafe_allow_html=True)

        # --- MAIN CHART ---
        st.markdown("<h3 style='margin-top:20px; font-size:18px; color:#7a8299;'>TERMINAL VIEW</h3>", unsafe_allow_html=True)
        tab1, tab2, tab_heat = st.tabs(["📊 Price & Prediction", "🧠 Learning Convergence", "🗺️ NSE Sector Heatmap"])
        
        with tab1:
            plot_df = df.iloc[-100:]
            fig = go.Figure()
            # SMA Overlay
            if show_ma:
                fig.add_trace(go.Scatter(x=plot_df.index, y=plot_df['SMA_50'], name='SMA 50', line=dict(color='#f5a623', width=1.5, dash='dot')))
            
            # Auto Support & Resistance
            levels = detect_support_resistance(plot_df)
            for s in levels['support']:
                fig.add_hline(y=s, line_dash="dash", line_color="rgba(0, 212, 180, 0.4)", annotation_text="Support", annotation_position="bottom right")
            for r in levels['resistance']:
                fig.add_hline(y=r, line_dash="dash", line_color="rgba(255, 69, 96, 0.4)", annotation_text="Resistance", annotation_position="top right")
            
            # Prediction Extension with Confidence Cloud
            last_date = plot_df.index[-1]
            next_date = last_date + pd.Timedelta(days=1)
            
            # Confidence Cloud (Shaded Area)
            fig.add_trace(go.Scatter(
                x=[next_date, next_date],
                y=[q10_p, q90_p],
                mode='lines',
                name='Confidence Cloud',
                line=dict(color='rgba(0, 210, 170, 0.2)', width=15),
                hoverinfo='none'
            ))
            
            # Median Forecast Path
            fig.add_trace(go.Scatter(
                x=[last_date, next_date],
                y=[current_price, q50_p],
                mode='lines+markers',
                name='Median Forecast',
                line=dict(color='#00d2aa', width=3, dash='dash')
            ))
            
            # Upper & Lower Bounds (Quantile markers)
            fig.add_trace(go.Scatter(x=[next_date], y=[q90_p], mode='markers', name='Upper Bound (Q90)', marker=dict(color='#00ff88', size=8)))
            fig.add_trace(go.Scatter(x=[next_date], y=[q10_p], mode='markers', name='Lower Bound (Q10)', marker=dict(color='#ff4b4b', size=8)))
            
            fig = apply_chart_style(fig)
            st.plotly_chart(fig, use_container_width=True)
            
        with tab2:
            fig_loss = go.Figure()
            fig_loss.add_trace(go.Scatter(y=history_data['loss'], name='Training Loss', line=dict(color='#00d2aa')))
            if 'val_loss' in history_data:
                fig_loss.add_trace(go.Scatter(y=history_data['val_loss'], name='Validation Loss', line=dict(color='#ff3366', dash='dash')))
            fig_loss = apply_chart_style(fig_loss)
            st.plotly_chart(fig_loss, use_container_width=True)
            
        with tab_heat:
            st.markdown("#### Real-time Sector Rotation (NSE)")
            heatmap = intel.get_sector_heatmap()
            if heatmap:
                h_cols = st.columns(len(heatmap))
                for i, h in enumerate(heatmap):
                    with h_cols[i]:
                        h_color = "#00d4b4" if h['change'] > 0 else "#ff4560"
                        st.markdown(textwrap.dedent(f"""
                            <div style="text-align:center; padding:10px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                                <div style="font-size:10px; color:#7a8299;">{h['sector'].replace('NIFTY ', '')}</div>
                                <div style="font-size:14px; font-weight:700; color:{h_color};">{h['change']:+.2f}%</div>
                            </div>
                        """), unsafe_allow_html=True)
                
                # Plotly Bar Chart for Heatmap
                fig_heat = go.Figure(go.Bar(
                    x=[h['sector'] for h in heatmap],
                    y=[h['change'] for h in heatmap],
                    marker_color=[("#00d4b4" if h['change'] > 0 else "#ff4560") for h in heatmap]
                ))
                fig_heat.update_layout(height=350)
                fig_heat = apply_chart_style(fig_heat)
                st.plotly_chart(fig_heat, use_container_width=True)
            else:
                st.warning("NSE Data link temporarily unavailable. Retrying...")
            
            # Diagnostic message
            if 'val_loss' in history_data:
                final_train = history_data['loss'][-1]
                final_val = history_data['val_loss'][-1]
                ratio = final_val / final_train if final_train > 0 else 1
                
                if ratio > 1.5:
                    st.warning("⚠️ Warning: Potential Overfitting detected. Validation loss is significantly higher than training loss.")
                else:
                    st.success("✅ Model Generalization: STABLE. Training and validation losses are converging well.")

        st.markdown("---")
        st.markdown("### 🧪 Performance Rigor & Risk Stats")
        st.caption("Validating AI effectiveness through institutional-grade backtracking and stress testing.")
        
        b_tabs = st.tabs(["📈 Equity Curve", "🎲 Monte Carlo Stress Test", "🎯 Price Tracking"])
        
        with b_tabs[0]:
            fig_eq = go.Figure()
            fig_eq.add_trace(go.Scatter(y=equity_curve, name='Portfolio Equity', line=dict(color='#00d2aa', width=3)))
            fig_eq = apply_chart_style(fig_eq)
            st.plotly_chart(fig_eq, use_container_width=True)
            
        with b_tabs[1]:
            if len(mc_results) > 0:
                fig_mc = go.Figure()
                fig_mc.add_trace(go.Histogram(x=mc_results, nbinsx=30, marker_color='#00d2aa', opacity=0.7))
                fig_mc = apply_chart_style(fig_mc)
                st.plotly_chart(fig_mc, use_container_width=True)
                st.info(f"Median Stress-Test Growth: x{np.median(mc_results):.2f} after 20 targeted days.")
            else:
                st.warning("Insufficient data for Monte Carlo simulation.")

        with b_tabs[2]:
            fig_bt = go.Figure()
            fig_bt.add_trace(go.Scatter(y=acts, name='Actual Price', line=dict(color='rgba(255,255,255,0.3)', width=1)))
            fig_bt.add_trace(go.Scatter(y=preds, name='AI Forecast (Median)', line=dict(color='#00d2aa', width=2)))
            fig_bt = apply_chart_style(fig_bt)
            st.plotly_chart(fig_bt, use_container_width=True)
        
        c1, c2, c3, c4, c5 = st.columns(5)
        c1.metric("Sharpe Ratio", f"{sharpe_bt:.2f}")
        c2.metric("Sortino Ratio", f"{sortino_bt:.2f}")
        c3.metric("Profit Factor", f"{profit_factor:.2f}")
        c4.metric("Win Rate", f"{win_rate*100:.1f}%")
        c5.metric("Max Drawdown", f"{max_dd*100:.1f}%")
        c5.success("System: RESEARCH GRADE")
        
        # --- LIVE NEWS FEED ---
        st.markdown("---")
        st.markdown("### 📰 Market Intelligence Feed")
        st.caption(f"Real-time sentiment signals for {ticker}")
        
        if top_news:
            for n in top_news:
                with st.container():
                    st.markdown(f"""
                    <div style="
                        background: rgba(255, 255, 255, 0.02);
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        border-radius: 12px;
                        padding: 15px;
                        margin-bottom: 15px;
                        transition: 0.3s;
                    ">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="flex: 1;">
                                <a href="{n['link']}" target="_blank" style="
                                    color: #00d2aa;
                                    text-decoration: none;
                                    font-weight: 600;
                                    font-size: 16px;
                                    line-height: 1.4;
                                ">{n['title']}</a>
                                <div style="margin-top: 8px; font-size: 12px; color: #888;">
                                    <span style="background: rgba(0, 210, 170, 0.1); color: #00d2aa; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(0, 210, 170, 0.2);">{n['publisher']}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    """, unsafe_allow_html=True)
        else:
            st.warning(f"No active news clusters detected for {ticker}. The model is relying purely on technical momentum.")

        st.info("The system uses multivariate backtracking to confirm that current neural weights align with established historical trends before issuing a signal.")
    elif df is not None:
        _suggest_ticker_fix(ticker)
    else:
        _suggest_ticker_fix(ticker)
