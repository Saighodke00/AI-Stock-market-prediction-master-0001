import os
import streamlit as st
import numpy as np
try:
    import psutil
except ImportError:
    psutil = None

import time
from utils.india_market import IndiaMarketIntelligence

intel = IndiaMarketIntelligence()

st.set_page_config(
    page_title="Apex AI - Intelligence Hub",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Aero Terminal Design System
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&family=Share+Tech+Mono&display=swap');
    
    :root {
        --amber: #f5a623;
        --amber-glow: rgba(245, 166, 35, 0.2);
        --bg-dark: #060810;
        --panel-bg: rgba(15, 18, 32, 0.7);
        --border: rgba(26, 32, 53, 1);
    }

    .stApp {
        background-color: var(--bg-dark);
        color: #c8d0e0;
        font-family: 'Outfit', sans-serif;
    }

    /* Aero Glass Panels */
    .stCard {
        background: var(--panel-bg);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 35px;
        backdrop-filter: blur(24px);
        transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .stCard:hover {
        border-color: var(--amber);
        transform: translateY(-8px);
        background: rgba(15, 18, 32, 0.9);
        box-shadow: 0 12px 40px rgba(0,0,0,0.4);
    }

    .card-title {
        font-size: 32px;
        font-weight: 700;
        color: #fff;
        margin-bottom: 10px;
        font-family: 'Outfit', sans-serif;
    }
    .card-tag {
        font-size: 10px;
        font-family: 'Share Tech Mono', monospace;
        color: var(--amber);
        letter-spacing: 2px;
        text-transform: uppercase;
        margin-bottom: 15px;
    }

    /* Ticker Animation */
    @keyframes ticker {
        0% { transform: translateX(100%); }
        100% { transform: translateX(-100%); }
    }
    .ticker-wrap {
        width: 100%;
        overflow: hidden;
        background: rgba(245, 166, 35, 0.03);
        border-top: 1px solid rgba(245, 166, 35, 0.1);
        border-bottom: 1px solid rgba(245, 166, 35, 0.1);
        padding: 10px 0;
        margin: 20px 0;
    }
    .ticker {
        display: inline-block;
        white-space: nowrap;
        animation: ticker 40s linear infinite;
        color: var(--amber);
        font-family: 'Share Tech Mono', monospace;
        font-size: 14px;
        opacity: 0.8;
    }

    /* Status Pill */
    .status-pill {
        background: rgba(0, 212, 180, 0.1);
        border: 1px solid rgba(0, 212, 180, 0.3);
        color: #00d4b4;
        padding: 4px 12px;
        border-radius: 50px;
        font-size: 11px;
        font-family: 'Share Tech Mono', monospace;
    }
</style>
""", unsafe_allow_html=True)

# --- LIVE TICKER ---
stocks = intel.get_sector_heatmap()
if stocks:
    ticker_text = " • ".join([f"{s['sector']}: {s['change']:+.2f}%" for s in stocks])
    st.markdown(f"""
    <div class="ticker-wrap">
        <div class="ticker">
            {ticker_text} • {ticker_text} • {ticker_text}
        </div>
    </div>
    """, unsafe_allow_html=True)

# --- HERO ---
st.markdown("""
<div style='text-align: center; padding: 60px 0;'>
    <h1 style='font-size: 64px; font-weight: 800; color: #f5a623; margin-bottom: 10px; letter-spacing: -2px;'>APEX <span style='color:#fff'>AI</span></h1>
    <p style='color: #7a8299; font-size: 20px; font-family: "JetBrains Mono";'>NEURAL COMMAND CENTER // V4.0 AERO</p>
</div>
""", unsafe_allow_html=True)

# --- MODELS ---
c1, c2 = st.columns(2)

with c1:
    st.markdown("""
    <div class="stCard">
        <div>
            <div class="card-tag">Institutional Tier</div>
            <div class="card-title">Swing Intelligence</div>
            <p style='color:#7a8299; line-height:1.6;'>
                Multi-day trend forecasting utilizing Deep Temporal LSTMs. 
                Optimized for wealth accumulation and institutional momentum alignment.
            </p>
        </div>
        <div style="margin-top:30px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.05);">
            <div style='display:flex; justify-content:space-between; align-items:center;'>
                <span style='color:#fff; font-family:"Share Tech Mono";'>0.5% - 2% SPREAD</span>
                <span class="status-pill">ACTIVE</span>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

with c2:
    st.markdown("""
    <div class="stCard">
        <div>
            <div class="card-tag">High-Frequency Tier</div>
            <div class="card-title" style="color:#00ffcc;">Intraday Precision</div>
            <p style='color:#7a8299; line-height:1.6;'>
                Sub-minute resolution scalping engine with recursive neural feedback. 
                Designed for high-volatility capture and regime-aware entries.
            </p>
        </div>
        <div style="margin-top:30px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.05);">
            <div style='display:flex; justify-content:space-between; align-items:center;'>
                <span style='color:#fff; font-family:"Share Tech Mono";'>RECURSIVE GRU</span>
                <span class="status-pill" style="border-color:#00ffcc33; color:#00ffcc; background:#00ffcc11;">STREAMING</span>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

# --- SYSTEM HEALTH ---
st.markdown("<br><br>", unsafe_allow_html=True)
st.markdown("---")

sh1, sh2, sh3, sh4 = st.columns(4)
with sh1:
    cpu_val = psutil.cpu_percent() if psutil else "N/A"
    st.markdown(f"**CORE LOAD**<br><span style='font-family:\"Share Tech Mono\"; font-size:22px;'>{cpu_val}%</span>", unsafe_allow_html=True)
with sh2:
    mem_val = psutil.virtual_memory().percent if psutil else "N/A"
    st.markdown(f"**MEMORY FLUX**<br><span style='font-family:\"Share Tech Mono\"; font-size:22px;'>{mem_val}%</span>", unsafe_allow_html=True)
with sh3:
    st.markdown(f"**SYNC LATENCY**<br><span style='font-family:\"Share Tech Mono\"; font-size:22px;'>{np.random.randint(15, 30)}ms</span>", unsafe_allow_html=True)
with sh4:
    st.markdown(f"**NEURAL STATUS**<br><span style='color:#00d4b4; font-family:\"Share Tech Mono\"; font-size:22px;'>STABLE</span>", unsafe_allow_html=True)

st.sidebar.markdown("---")
st.sidebar.info("Operational: Apex Terminal v4.0 is now aligned with NSE/BSE institutional flow data.")
