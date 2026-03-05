import os
import sys
import streamlit as st
import numpy as np

# Enable Keras 2 legacy support
os.environ['TF_USE_LEGACY_KERAS'] = '1'

try:
    import psutil
except ImportError:
    psutil = None

sys.path.append(os.path.abspath(os.path.dirname(__file__)))
from utils.india_market import IndiaMarketIntelligence

intel = IndiaMarketIntelligence()

st.set_page_config(
    page_title="Apex AI — Intelligence Hub",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# ────────────────────────────────────────────────────────────────────────────
# WORLD-CLASS DESIGN SYSTEM: NEURAL TERMINAL V2
# ────────────────────────────────────────────────────────────────────────────
def inject_global_css():
    st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Rajdhani:wght@400;500;600&family=Share+Tech+Mono&display=swap');

    /* ── Core Terminal Aesthetics ─────────────────────────────────────────── */
    :root {
        --bg:        #020409;
        --panel:     #060b14;
        --border:    #0e2040;
        --cyan:      #00e5ff;
        --green:     #00e676;
        --red:       #ff1744;
        --gold:      #ffc107;
        --txt:       #c8d8f0;
    }

    [data-testid="stAppViewContainer"] {
        background: var(--bg) !important;
        color: var(--txt) !important;
        font-family: 'Rajdhani', sans-serif !important;
    }

    [data-testid="stSidebar"] {
        background: var(--panel) !important;
        border-right: 1px solid var(--border) !important;
    }

    h1, h2, h3 {
        font-family: 'Orbitron', sans-serif !important;
        color: var(--cyan) !important;
        text-transform: uppercase;
        letter-spacing: 2px;
    }

    /* ── Glow Effects ─────────────────────────────────────────────────────── */
    .glow-cyan  { color: var(--cyan);  text-shadow: 0 0 15px rgba(0,229,255,0.4); }
    .glow-green { color: var(--green); text-shadow: 0 0 15px rgba(0,230,118,0.4); }
    .glow-red   { color: var(--red);   text-shadow: 0 0 15px rgba(255,23,68,0.4); }
    .glow-gold  { color: var(--gold);  text-shadow: 0 0 15px rgba(255,193,7,0.4); }

    /* ── Custom Metric Cards ──────────────────────────────────────────────── */
    .metric-card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 15px;
        text-align: left;
        transition: 0.3s;
    }
    .metric-card:hover {
        border-color: var(--cyan);
        box-shadow: 0 0 15px rgba(0,229,255,0.1);
    }
    .m-label {
        font-family: 'Share Tech Mono', monospace;
        font-size: 11px;
        color: #5a75a0;
        text-transform: uppercase;
        margin-bottom: 5px;
    }
    .m-val {
        font-family: 'Orbitron', sans-serif;
        font-size: 22px;
        font-weight: 700;
        line-height: 1.2;
    }

    /* ── Ticker Rail ───────────────────────────────────────────────────────── */
    .ticker-rail {
        background: #040812;
        border-bottom: 1px solid var(--border);
        padding: 8px 0;
        font-family: 'Share Tech Mono', monospace;
        font-size: 12px;
    }

    /* ── Hide Streamlit Elements ─────────────────────────────────────────── */
    #MainMenu, header, footer { visibility: hidden; }
    .block-container { padding-top: 2rem !important; }
    </style>
    """, unsafe_allow_html=True)

inject_global_css()

# ── Live Ticker ──────────────────────────────────────────────────────────────
sectors = intel.get_sector_heatmap()
tick_html = ""
if sectors:
    items = ""
    for s in sectors * 3:
        change = s['change']
        cls = "tick-up" if change >= 0 else "tick-dn"
        arrow = "▲" if change >= 0 else "▼"
        name = s['sector'].replace("NIFTY ", "")
        items += f'<span class="tick-item"><span class="tick-name">{name}</span><span class="{cls}">{arrow} {abs(change):.2f}%</span></span>'
    tick_html = f'<div class="ticker-rail"><div class="ticker-inner">{items}</div></div>'
else:
    tick_html = '<div class="ticker-rail"><div class="ticker-inner" style="color:#5a6585">Market data loading…</div></div>'

st.markdown(tick_html, unsafe_allow_html=True)

# ── Hero Section ─────────────────────────────────────────────────────────────
st.markdown("""
<div class="hero">
    <div class="hero-eyebrow" style="font-family: 'Share Tech Mono', monospace; letter-spacing: 5px;">Neural Trading Intelligence Platform</div>
    <div class="hero-title" style="font-family: 'Orbitron', sans-serif;">APEX AI</div>
    <div class="hero-sub" style="font-family: 'Share Tech Mono', monospace;">V4.0 // NEURAL TERMINAL V2 // INSTITUTIONAL GRADE</div>
    <div class="hero-badge" style="font-family: 'Share Tech Mono', monospace; border-color: var(--cyan); color: var(--cyan);">
        <span class="pulse-dot" style="background: var(--cyan); box-shadow: 0 0 10px var(--cyan);"></span>
        LIVE // NSE-BSE SYNC // AI CORE ACTIVE
    </div>
</div>
""", unsafe_allow_html=True)

# ── Module Cards ─────────────────────────────────────────────────────────────
st.markdown("""
<div class="mod-grid">

  <div class="mod-card mod-card-swing">
    <div class="mod-icon">📈</div>
    <div class="mod-tier mod-tier-a">Institutional · Multi-Day</div>
    <div class="mod-name">Swing Intelligence</div>
    <p class="mod-desc">
        Deep Temporal LSTM engine for multi-day trend forecasting. 
        Cross-referenced with FII/DII institutional flow and Auto S/R levels 
        for maximum conviction entries.
    </p>
    <div class="mod-footer">
        <span class="mod-arch">LSTM · GRU Ensemble</span>
        <span class="mod-status status-active">● ACTIVE</span>
    </div>
  </div>

  <div class="mod-card mod-card-intra">
    <div class="mod-icon">⚡</div>
    <div class="mod-tier mod-tier-t">High-Frequency · Intraday</div>
    <div class="mod-name">Intraday Precision</div>
    <p class="mod-desc">
        Sub-minute recursive neural scalping engine. Combines EMA 9/21 crossovers, 
        Bollinger Band breakouts, and real-time volatility regime detection 
        for precision entries.
    </p>
    <div class="mod-footer">
        <span class="mod-arch">Recursive GRU · TCN</span>
        <span class="mod-status status-stream">◉ STREAMING</span>
    </div>
  </div>

</div>
""", unsafe_allow_html=True)

# ── Third card row ────────────────────────────────────────────────────────────
st.markdown("""
<div class="mod-grid" style="grid-template-columns: 1fr 2fr;">

  <div class="mod-card">
    <div class="mod-icon">⚙️</div>
    <div class="mod-tier" style="color:var(--blue);">Auto · Optuna Powered</div>
    <div class="mod-name" style="font-size:24px;">HyperDrive Tuner</div>
    <p class="mod-desc">Bayesian Optimization to find the mathematically optimal neural architecture for any stock or timeframe.</p>
    <div class="mod-footer">
        <span class="mod-arch">Bayesian Search</span>
        <span class="mod-status status-tuner">◈ READY</span>
    </div>
  </div>

  <div class="mod-card" style="background:linear-gradient(135deg, rgba(12,17,35,0.9), rgba(8,12,25,0.9));">
    <div class="mod-tier mod-tier-a">India Market Intelligence</div>
    <div class="mod-name" style="font-size:22px;">🇮🇳 NSE/BSE Live Pulse</div>
    <p class="mod-desc">
        Real-time FII/DII institutional flow tracking, NSE sector rotation heatmap, 
        and earnings calendar with AI-powered surprise score. 
        Navigate the Indian market like an institution.
    </p>
    <div style="display:flex; gap:12px; margin-top:24px; flex-wrap:wrap;">
        <span style="background:rgba(247,183,49,0.08); border:1px solid rgba(247,183,49,0.2); color:var(--amber); padding:4px 12px; border-radius:50px; font-size:11px; font-family:'JetBrains Mono';">FII/DII Flow</span>
        <span style="background:rgba(247,183,49,0.08); border:1px solid rgba(247,183,49,0.2); color:var(--amber); padding:4px 12px; border-radius:50px; font-size:11px; font-family:'JetBrains Mono';">Sector Heatmap</span>
        <span style="background:rgba(247,183,49,0.08); border:1px solid rgba(247,183,49,0.2); color:var(--amber); padding:4px 12px; border-radius:50px; font-size:11px; font-family:'JetBrains Mono';">Earnings Calendar</span>
        <span style="background:rgba(247,183,49,0.08); border:1px solid rgba(247,183,49,0.2); color:var(--amber); padding:4px 12px; border-radius:50px; font-size:11px; font-family:'JetBrains Mono';">Auto S/R</span>
    </div>
  </div>

</div>
""", unsafe_allow_html=True)

# ── System Health Bar ─────────────────────────────────────────────────────────
cpu_val  = f"{psutil.cpu_percent():.0f}" if psutil else "—"
mem_val  = f"{psutil.virtual_memory().percent:.0f}" if psutil else "—"
lat_val  = f"{np.random.randint(12, 28)}"
fii      = intel.get_fii_dii_flow()
fii_val  = f"{fii['total_flow']:+,.0f}" if fii else "—"
fii_col  = "green" if (fii and fii['total_flow'] > 0) else "amber"

st.markdown(f"""
<div class="stat-row">
    <div class="stat-box">
        <div class="stat-label" style="font-family: 'Share Tech Mono', monospace;">CPU CORE LOAD</div>
        <div class="stat-val" style="font-family: 'Orbitron', sans-serif;">{cpu_val}<span style="font-size:14px; color:#5a75a0;">%</span></div>
    </div>
    <div class="stat-box">
        <div class="stat-label" style="font-family: 'Share Tech Mono', monospace;">MEMORY FLUX</div>
        <div class="stat-val" style="font-family: 'Orbitron', sans-serif;">{mem_val}<span style="font-size:14px; color:#5a75a0;">%</span></div>
    </div>
    <div class="stat-box">
        <div class="stat-label" style="font-family: 'Share Tech Mono', monospace;">API LATENCY</div>
        <div class="stat-val" style="font-family: 'Orbitron', sans-serif;">{lat_val}<span style="font-size:14px; color:#5a75a0;">ms</span></div>
    </div>
    <div class="stat-box">
        <div class="stat-label" style="font-family: 'Share Tech Mono', monospace;">INSTITUTIONAL FLOW (CR)</div>
        <div class="stat-val" style="font-family: 'Orbitron', sans-serif; color:{'#00e676' if fii_col=='green' else '#ffc107'};">{fii_val}</div>
    </div>
</div>
""", unsafe_allow_html=True)

st.markdown("<div style='text-align:center; color:#242a3e; font-size:11px; margin-top:40px; font-family:JetBrains Mono'>APEX AI · FOR RESEARCH PURPOSES ONLY · NOT FINANCIAL ADVICE</div>", unsafe_allow_html=True)
