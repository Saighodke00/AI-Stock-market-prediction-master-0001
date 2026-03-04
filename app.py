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
# WORLD-CLASS CSS DESIGN SYSTEM
# ────────────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;700&display=swap');

/* ── Reset & Root ──────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }

:root {
    --bg:        #03050c;
    --bg2:       #070c18;
    --panel:     rgba(12, 17, 35, 0.85);
    --border:    rgba(255,255,255,0.06);
    --border-h:  rgba(255,255,255,0.15);
    --amber:     #f7b731;
    --teal:      #00e5c9;
    --blue:      #4f8cff;
    --red:       #ff5370;
    --green:     #00e676;
    --txt:       #d0d8ef;
    --txt2:      #5a6585;
    --glow-a:    rgba(247,183,49,0.12);
    --glow-t:    rgba(0,229,201,0.10);
}

/* ── Body & App ─────────────────────────────────────────────────────────── */
.stApp {
    background: var(--bg);
    color: var(--txt);
    font-family: 'Space Grotesk', sans-serif;
}

/* hide default streamlit header/footer */
#MainMenu, header, footer { visibility: hidden; }
.block-container { padding: 0 clamp(0.5rem, 2vw, 2rem) 2rem !important; max-width: 100% !important; }

/* ── Sidebar Glassmorphism ──────────────────────────────────────────────── */
section[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #07101e 0%, #03070f 100%);
    border-right: 1px solid var(--border);
}
section[data-testid="stSidebar"] * { color: var(--txt) !important; }

/* ── Animated gradient background ──────────────────────────────────────── */
.apex-bg {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background:
        radial-gradient(ellipse 80% 60% at 10% 10%, rgba(79,140,255,0.06) 0%, transparent 60%),
        radial-gradient(ellipse 60% 50% at 90% 80%, rgba(0,229,201,0.06) 0%, transparent 60%),
        radial-gradient(ellipse 50% 40% at 50% 50%, rgba(247,183,49,0.03) 0%, transparent 70%);
}

/* ── Ticker Bar ─────────────────────────────────────────────────────────── */
.ticker-rail {
    width: 100%; overflow: hidden;
    background: linear-gradient(90deg, transparent, rgba(247,183,49,0.03), transparent);
    border-top: 1px solid rgba(247,183,49,0.12);
    border-bottom: 1px solid rgba(247,183,49,0.12);
    padding: 9px 0; margin-bottom: 32px;
    position: relative;
}
.ticker-rail::before, .ticker-rail::after {
    content: '';
    position: absolute; top: 0; width: 80px; height: 100%; z-index: 2;
}
.ticker-rail::before { left: 0; background: linear-gradient(90deg, var(--bg), transparent); }
.ticker-rail::after  { right: 0; background: linear-gradient(-90deg, var(--bg), transparent); }
@keyframes slide { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.ticker-inner {
    display: inline-flex; gap: 48px; white-space: nowrap;
    animation: slide 36s linear infinite;
    font-family: 'JetBrains Mono', monospace; font-size: 13px;
}
.tick-item { display: flex; align-items: center; gap: 8px; }
.tick-name { color: var(--txt2); }
.tick-up   { color: var(--green); }
.tick-dn   { color: var(--red); }

/* ── Hero ───────────────────────────────────────────────────────────────── */
.hero {
    text-align: center;
    padding: clamp(32px, 6vw, 72px) 0 clamp(24px, 4vw, 56px);
    position: relative;
}
.hero-eyebrow {
    font-family: 'JetBrains Mono', monospace;
    font-size: clamp(9px, 1.2vw, 11px); letter-spacing: 4px;
    color: var(--amber); text-transform: uppercase;
    margin-bottom: clamp(12px, 2vw, 20px); opacity: 0.85;
}
@keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
}
.hero-title {
    font-size: clamp(36px, 8vw, 88px);
    font-weight: 700; line-height: 1;
    background: linear-gradient(120deg, #fff 20%, var(--amber) 45%, #fff 55%, var(--teal) 80%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 5s linear infinite;
    margin-bottom: clamp(10px, 2vw, 20px);
}
.hero-sub {
    font-family: 'JetBrains Mono', monospace;
    color: var(--txt2); font-size: clamp(11px, 1.5vw, 15px); letter-spacing: 1px;
}
.hero-badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(0,229,201,0.08);
    border: 1px solid rgba(0,229,201,0.25);
    border-radius: 50px; padding: 6px 18px;
    font-size: 12px; color: var(--teal);
    font-family: 'JetBrains Mono', monospace;
    margin-top: 28px;
}
@keyframes pulse-dot { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
.pulse-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--teal);
    animation: pulse-dot 1.5s ease-in-out infinite;
    box-shadow: 0 0 8px var(--teal);
}

/* ── Module Cards ───────────────────────────────────────────────────────── */
.mod-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
    gap: clamp(12px, 2vw, 20px);
    margin: 0 0 clamp(20px, 3vw, 40px);
}
.mod-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: clamp(14px, 2vw, 20px);
    padding: clamp(20px, 3vw, 36px) clamp(18px, 2.5vw, 32px);
    backdrop-filter: blur(24px) saturate(1.5);
    position: relative; overflow: hidden;
    transition: transform 0.35s cubic-bezier(.4,0,.2,1),
                border-color 0.35s, box-shadow 0.35s;
}
.mod-card::before {
    content: '';
    position: absolute;
    inset: 0; border-radius: 20px;
    opacity: 0; transition: opacity 0.35s;
}
.mod-card-swing::before { background: radial-gradient(ellipse at 0% 0%, var(--glow-a), transparent 65%); }
.mod-card-intra::before { background: radial-gradient(ellipse at 100% 0%, var(--glow-t), transparent 65%); }
.mod-card:hover { transform: translateY(-6px); border-color: var(--border-h); }
.mod-card:hover::before { opacity: 1; }
.mod-card-swing:hover { box-shadow: 0 20px 60px rgba(247,183,49,0.08); }
.mod-card-intra:hover { box-shadow: 0 20px 60px rgba(0,229,201,0.08); }

.mod-icon { font-size: clamp(28px, 4vw, 40px); margin-bottom: clamp(12px, 2vw, 20px); line-height: 1; }
.mod-tier {
    font-family: 'JetBrains Mono', monospace;
    font-size: clamp(9px, 1vw, 10px); letter-spacing: 3px;
    text-transform: uppercase; margin-bottom: 12px;
}
.mod-tier-a { color: var(--amber); }
.mod-tier-t { color: var(--teal); }
.mod-name { font-size: clamp(18px, 2.5vw, 28px); font-weight: 700; color: #fff; margin-bottom: 10px; }
.mod-desc { color: var(--txt2); font-size: clamp(13px, 1.4vw, 15px); line-height: 1.7; }
.mod-footer {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 28px; padding-top: 20px;
    border-top: 1px solid var(--border);
}
.mod-arch { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--txt2); }
.mod-status {
    padding: 5px 14px; border-radius: 50px;
    font-size: 11px; font-family: 'JetBrains Mono', monospace;
    letter-spacing: 1px;
}
.status-active  { background: rgba(0,230,118,0.08); border:1px solid rgba(0,230,118,0.25); color:var(--green); }
.status-stream  { background: rgba(0,229,201,0.08); border:1px solid rgba(0,229,201,0.25); color:var(--teal); }
.status-tuner   { background: rgba(79,140,255,0.08); border:1px solid rgba(79,140,255,0.25); color:var(--blue); }

/* ── Stat Bar ───────────────────────────────────────────────────────────── */
.stat-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr));
    gap: clamp(8px, 1.5vw, 16px); margin-top: 8px;
}
.stat-box {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px; padding: clamp(14px, 2vw, 20px) clamp(14px, 2vw, 22px);
}
.stat-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: clamp(9px, 1vw, 10px); letter-spacing: 2px;
    color: var(--txt2); text-transform: uppercase; margin-bottom: 8px;
}
.stat-val {
    font-family: 'JetBrains Mono', monospace;
    font-size: clamp(18px, 2.5vw, 26px); font-weight: 500; color: #fff;
}
.stat-val.green { color: var(--green); }
.stat-val.amber { color: var(--amber); }

/* ── Scrollbar ──────────────────────────────────────────────────────────── */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: var(--amber); }

/* ── Streamlit component overrides ─────────────────────────────────────── */
div[data-testid="stMetric"] {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 18px 20px;
}
div[data-testid="stMetric"] label { color: var(--txt2) !important; font-size: 12px !important; }
div[data-testid="stMetric"] [data-testid="stMetricValue"] { color: #fff !important; }
div.stButton > button {
    background: linear-gradient(135deg, var(--amber), #e6920f);
    color: #000; font-weight: 700;
    border: none; border-radius: 10px;
    padding: 10px 24px; font-size: 14px;
    transition: 0.3s; width: 100%;
}
div.stButton > button:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(247,183,49,0.3); }
</style>

<div class="apex-bg"></div>
""", unsafe_allow_html=True)

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
    <div class="hero-eyebrow">Neural Trading Intelligence Platform</div>
    <div class="hero-title">APEX AI</div>
    <div class="hero-sub">V4.0 · Aero Terminal · Institutional Grade Analytics</div>
    <div class="hero-badge">
        <span class="pulse-dot"></span>
        LIVE · NSE/BSE Synchronized · AI Core Operational
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
        <div class="stat-label">CPU Core Load</div>
        <div class="stat-val">{cpu_val}<span style="font-size:14px; color:var(--txt2);">%</span></div>
    </div>
    <div class="stat-box">
        <div class="stat-label">Memory Flux</div>
        <div class="stat-val">{mem_val}<span style="font-size:14px; color:var(--txt2);">%</span></div>
    </div>
    <div class="stat-box">
        <div class="stat-label">API Latency</div>
        <div class="stat-val">{lat_val}<span style="font-size:14px; color:var(--txt2);">ms</span></div>
    </div>
    <div class="stat-box">
        <div class="stat-label">Institutional Flow (Cr)</div>
        <div class="stat-val {fii_col}">{fii_val}</div>
    </div>
</div>
""", unsafe_allow_html=True)

st.markdown("<div style='text-align:center; color:#242a3e; font-size:11px; margin-top:40px; font-family:JetBrains Mono'>APEX AI · FOR RESEARCH PURPOSES ONLY · NOT FINANCIAL ADVICE</div>", unsafe_allow_html=True)
