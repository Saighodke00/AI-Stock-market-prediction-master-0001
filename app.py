import os
import streamlit as st

# Enable Keras 2 legacy support for Transformers compatibility
os.environ['TF_USE_LEGACY_KERAS'] = '1'

st.set_page_config(
    page_title="Apex AI - Intelligence Hub",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Premium Font Import
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');
    
    :root {
        --primary: #00d2aa;
        --primary-glow: rgba(0, 210, 170, 0.3);
        --bg-dark: #080a0f;
    }

    .stApp {
        background-color: var(--bg-dark);
        color: #e0e0e0;
        font-family: 'Outfit', sans-serif;
    }

    /* Background Blobs for depth */
    .blob {
        position: fixed;
        width: 500px;
        height: 500px;
        background: radial-gradient(circle, var(--primary-glow) 0%, rgba(8,10,15,0) 70%);
        border-radius: 50%;
        z-index: -1;
        filter: blur(80px);
    }
    .blob-1 { top: -100px; left: -100px; }
    .blob-2 { bottom: -100px; right: -100px; opacity: 0.5; }

    .hub-container {
        padding: 60px 20px;
        text-align: center;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 30px;
        backdrop-filter: blur(20px);
        margin-bottom: 50px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    }

    .glitch-title {
        font-size: 64px;
        font-weight: 800;
        background: linear-gradient(90deg, #fff, var(--primary), #fff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 20px;
        letter-spacing: -2px;
    }

    .card {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%);
        padding: 40px;
        border-radius: 24px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        height: 420px;
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        cursor: pointer;
    }

    .card:hover {
        border-color: var(--primary);
        transform: translateY(-15px) scale(1.02);
        background: rgba(255, 255, 255, 0.08);
        box-shadow: 0 15px 35px var(--primary-glow);
    }

    .card-title {
        font-size: 28px;
        font-weight: 700;
        color: var(--primary);
        margin-bottom: 15px;
    }

    .card-desc {
        font-size: 17px;
        color: #aaa;
        line-height: 1.6;
    }

    .tag {
        display: inline-block;
        padding: 4px 12px;
        background: rgba(0, 210, 170, 0.1);
        border: 1px solid var(--primary);
        border-radius: 50px;
        font-size: 12px;
        color: var(--primary);
        font-weight: 600;
        margin-bottom: 20px;
    }

    .stat-bar {
        background: rgba(255,255,255,0.03);
        padding: 20px;
        border-radius: 15px;
        border-left: 4px solid var(--primary);
    }
</style>

<div class="blob blob-1"></div>
<div class="blob blob-2"></div>

<div class="hub-container">
    <h1 class="glitch-title">APEX AI</h1>
    <p style='font-size: 22px; color: #888; max-width: 700px; margin: 0 auto;'>
        Quantum-grade neural processing for real-time equity analysis and trend forecasting.
    </p>
</div>
""", unsafe_allow_html=True)

col1, col2 = st.columns(2)

with col1:
    st.markdown("""
    <div class="card">
        <div>
            <div class="tag">INSTITUTIONAL GRADE</div>
            <div class="card-title">📈 Swing Intelligence</div>
            <div class="card-desc">
                High-capacity LSTM model designed for multi-day accumulation patterns. 
                Analyzes RSI momentum, Volume clusters, and S&P 500 macro alignment.
            </div>
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; margin-top: 20px;">
            <p style='color: #888; font-size: 14px;'>Architecture: <b>Deep Temporal LSTM</b></p>
            <p style='color: var(--primary);'>➔ Select via Sidebar</p>
        </div>
    </div>
    """, unsafe_allow_html=True)

with col2:
    st.markdown("""
    <div class="card">
        <div>
            <div class="tag" style="border-color: #ff3366; color: #ff3366; background: rgba(255,51,102,0.1);">FAST RECURSION</div>
            <div class="card-title" style="color: #ff3366;">⚡ Intraday Precision</div>
            <div class="card-desc">
                Sub-minute resolution modeling for scalp opportunities. 
                Uses EMA 9/21 crossovers and Bollinger Band volatility breakouts.
            </div>
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; margin-top: 20px;">
            <p style='color: #888; font-size: 14px;'>Architecture: <b>High-Freq GRU/LSTM</b></p>
            <p style='color: #ff3366;'>➔ Select via Sidebar</p>
        </div>
    </div>
    """, unsafe_allow_html=True)

st.markdown("<br><br>", unsafe_allow_html=True)

c1, c2, c3 = st.columns(3)
with c1:
    st.markdown('<div class="stat-bar"><span style="color:#888; font-size:12px">AI CORE</span><br><b style="color:#00ff00">ONLINE</b></div>', unsafe_allow_html=True)
with c2:
    st.markdown('<div class="stat-bar"><span style="color:#888; font-size:12px">LATENCY</span><br><b>14ms</b></div>', unsafe_allow_html=True)
with c3:
    st.markdown('<div class="stat-bar"><span style="color:#888; font-size:12px">MARKET DATA</span><br><b style="color:#00d2aa">SYNCHRONIZED</b></div>', unsafe_allow_html=True)

st.sidebar.markdown("---")
st.sidebar.caption("Powered by Apex Neural Engine v4.0")
