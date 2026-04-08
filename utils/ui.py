import streamlit as st

def metric_card(label: str, value: str, color: str = "#00e5ff", glow: bool = True):
    """
    Renders a Bloomberg-style metric card with optional glow effect.
    """
    glow_class = ""
    if glow:
        if color == "#00e5ff": glow_class = "glow-cyan"
        elif color == "#00e676": glow_class = "glow-green"
        elif color == "#ff1744": glow_class = "glow-red"
        elif color == "#ffc107": glow_class = "glow-gold"

    return f"""
    <div class="metric-card">
        <div class="m-label">{label}</div>
        <div class="m-val {glow_class}" style="color:{color}">
            {value}
        </div>
    </div>
    """

def signal_card(action: str, confidence: float, expected_return: float):
    """
    Renders a high-impact signal card with dynamic coloring.
    """
    color = "#00e676" if action == "BUY" else ("#ff1744" if action == "SELL" else "#ffc107")
    glow = "glow-green" if action == "BUY" else ("glow-red" if action == "SELL" else "glow-gold")
    
    return f"""
    <div style="background: rgba(6, 11, 20, 0.8); border: 1px solid {color}44; border-left: 4px solid {color}; 
                border-radius: 8px; padding: 20px; text-align: left; margin-bottom: 20px;">
        <div style="font-family: 'Share Tech Mono', monospace; font-size: 11px; color: #5a75a0; letter-spacing: 2px;">NEURAL SIGNAL</div>
        <div class="{glow}" style="font-family: 'Orbitron', sans-serif; font-size: 32px; font-weight: 900; margin: 10px 0;">{action}</div>
        <div style="display: flex; gap: 20px;">
            <div>
                <div style="font-size: 10px; color: #5a75a0;">CONFIDENCE</div>
                <div style="font-family: 'Share Tech Mono', monospace; color: #fff;">{confidence*100:.1f}%</div>
            </div>
            <div>
                <div style="font-size: 10px; color: #5a75a0;">EXPECTED RETURN</div>
                <div style="font-family: 'Share Tech Mono', monospace; color: {color};">{expected_return:+.2f}%</div>
            </div>
        </div>
    </div>
    """

def terminal_header(ticker: str, price: float, change: float, signal: str):
    """
    Renders the "Neural Terminal v2" high-impact header.
    """
    sig_color = "#00e676" if signal == "BUY" else ("#ff1744" if signal == "SELL" else "#ffc107")
    sig_glow = "glow-green" if signal == "BUY" else ("glow-red" if signal == "SELL" else "glow-gold")
    
    change_color = "#00e676" if change >= 0 else "#ff1744"
    arrow = "▲" if change >= 0 else "▼"
    
    return f"""
    <div style="margin-bottom: 25px;">
        <div style="font-family: 'Orbitron', sans-serif; font-size: 14px; color: #5a75a0; letter-spacing: 3px;">
            TERMINAL V2 // {ticker}
        </div>
        <div style="display: flex; align-items: baseline; gap: 20px; margin-top: 5px;">
            <div style="font-family: 'Orbitron', sans-serif; font-size: 42px; font-weight: 700; color: #fff;">
                ₹{price:,.2f}
            </div>
            <div style="font-family: 'Share Tech Mono', monospace; font-size: 18px; color: {change_color};">
                {arrow} {abs(change):.2f}%
            </div>
            <div style="flex-grow: 1;"></div>
            <div style="text-align: right;">
                <div class="{sig_glow}" style="font-family: 'Orbitron', sans-serif; font-size: 28px; font-weight: 700;">
                    {arrow if signal != "HOLD" else "●"} {signal}
                </div>
                <div style="font-family: 'Share Tech Mono', monospace; font-size: 11px; color: #5a75a0; text-transform: uppercase;">
                    Neural Alignment Score
                </div>
            </div>
        </div>
    </div>
    """

def apply_chart_style(fig):
    """
    Applies the "Neural Terminal" chart aesthetic to a Plotly figure.
    """
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#c8d8f0", family="Rajdhani"),
        xaxis=dict(
            gridcolor="#0e2040", 
            linecolor="#0e2040",
            title_font=dict(family="Share Tech Mono", size=10),
            tickfont=dict(family="Share Tech Mono", size=10)
        ),
        yaxis=dict(
            gridcolor="#0e2040", 
            linecolor="#0e2040",
            title_font=dict(family="Share Tech Mono", size=10),
            tickfont=dict(family="Share Tech Mono", size=10)
        ),
        margin=dict(l=0, r=0, t=30, b=0),
        legend=dict(
            bgcolor="rgba(6, 11, 20, 0.8)",
            bordercolor="#0e2040",
            borderwidth=1,
            font=dict(family="Share Tech Mono", size=10)
        )
    )
    return fig

# Alias for user requirement
dark_theme = apply_chart_style

def show_loading():
    """
    Displays a premium pulsing neural engine animation.
    """
    st.markdown("""
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 0;">
        <div class="neural-pulse"></div>
        <div style="margin-top: 30px; font-family: 'Share Tech Mono', monospace; color: #00e5ff; letter-spacing: 4px; font-size: 14px; animation: blink 1.5s infinite;">
            CALIBRATING NEURAL ARCHITECTURE // SYNCING MARKET DATA
        </div>
    </div>
    <style>
    @keyframes pulse {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 229, 255, 0.7); }
        70% { transform: scale(1); box-shadow: 0 0 0 20px rgba(0, 229, 255, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 229, 255, 0); }
    }
    @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
    }
    .neural-pulse {
        width: 80px; height: 80px; background: #00e5ff; border-radius: 50%;
        animation: pulse 2s infinite; box-shadow: 0 0 20px #00e5ff;
        position: relative;
    }
    .neural-pulse::after {
        content: ''; position: absolute; top: -10px; left: -10px; right: -10px; bottom: -10px;
        border: 2px solid #00e5ff; border-radius: 50%; opacity: 0.5;
    }
    </style>
    """, unsafe_allow_html=True)

def inject_global_css():
    """
    Injects the core "Neural Terminal V2" design system into the Streamlit app.
    """
    st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Rajdhani:wght@400;500;600&family=Share+Tech+Mono&family=JetBrains+Mono&display=swap');

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
        font-weight: 700 !important;
    }

    /* ── Responsive Main Container ────────────────────────────────────────── */
    .block-container {
        padding-top: 1.5rem !important;
        padding-bottom: 2rem !important;
    }

    /* Custom Wrapper for Trading Pages */
    .main-content-wrapper {
        padding: 0 5% 50px 5%;
        max-width: 1800px;
        margin: 0 auto;
    }
    
    @media (max-width: 1200px) {
        .main-content-wrapper {
            padding: 0 2% 50px 2%;
        }
    }

    /* ── Premium Scrollbar ────────────────────────────────────────────────── */
    *, *::before, *::after {
        scrollbar-width: thin;
        scrollbar-color: #1a2b4d var(--bg);
    }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg) !important; }
    ::-webkit-scrollbar-thumb { background: #1a2b4d !important; border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--cyan) !important; }

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
        padding: 18px;
        text-align: left;
        transition: 0.3s;
        margin-bottom: 10px;
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
        font-size: 24px;
        font-weight: 700;
        line-height: 1.2;
    }

    /* ── Terminal Styles ─────────────────────────────────────────────────── */
    .terminal-analysis {
        background: rgba(6, 11, 20, 0.8);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 20px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 14px;
        line-height: 1.6;
        color: #d0d8ef;
        margin-bottom: 20px;
    }

    /* ── Hide Streamlit Overlays ─────────────────────────────────────────── */
    #MainMenu, header, footer { visibility: hidden; }
    </style>
    """, unsafe_allow_html=True)

