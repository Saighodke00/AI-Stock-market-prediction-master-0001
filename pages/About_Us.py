import streamlit as st

st.set_page_config(
    page_title="Apex AI - Neural Architects",
    layout="wide",
    initial_sidebar_state="expanded"
)

# The global CSS is now handled in app.py
# Pages can add specific overrides if needed.

# --- HERO SECTION ---
st.markdown("""
<div class="hero-section">
    <div style="position: relative; z-index: 1;">
        <h1 style='font-size: 56px; font-weight: 800; margin-bottom: 20px; letter-spacing: -2px;'>The Neural Architects</h1>
        <p class="mission-statement">
            We are a collective of engineers and data scientists dedicated to democratizing institutional-grade financial intelligence through advanced causal neural networks, temporal convolutional ensembles, and real-time sentiment synthesis.
        </p>
    </div>
</div>
""", unsafe_allow_html=True)

# --- TEAM SECTION ---
col1, col2, col3 = st.columns(3)

with col1:
    st.markdown("""
    <div class="member-card">
        <div class="avatar-circle">SG</div>
        <div class="member-name">Sai Narendra Ghodke</div>
        <div class="member-role">Lead AI Architect</div>
        <div class="member-bio">
            Engineered the dual-head Causal Engine combining GRU and Temporal Convolutional Networks. Spearheaded the shift towards non-leakage, research-grade architectures.
        </div>
        <div>
            <span class="tech-pill">TCN</span>
            <span class="tech-pill">Causal AI</span>
            <span class="tech-pill">Python</span>
        </div>
    </div>
    """, unsafe_allow_html=True)

with col2:
    st.markdown("""
    <div class="member-card">
        <div class="avatar-circle">SB</div>
        <div class="member-name">Siddhartha V. Bhosale</div>
        <div class="member-role">Quant Data Scientist</div>
        <div class="member-bio">
            Developed the multi-target feature store and walk-forward validation engine. Specialized in cross-asset correlation and market regime regime detection.
        </div>
        <div>
            <span class="tech-pill">Time Series</span>
            <span class="tech-pill">Quant Stat</span>
            <span class="tech-pill">LightGBM</span>
        </div>
    </div>
    """, unsafe_allow_html=True)

with col3:
    st.markdown("""
    <div class="member-card">
        <div class="avatar-circle">SS</div>
        <div class="member-name">Sunraj Shetty</div>
        <div class="member-role">UI/UX Specialist</div>
        <div class="member-bio">
            Crafted the high-fidelity glassmorphism interface. Focused on creating an immersive visual experience for probabilistic outputs and neural heatmaps.
        </div>
        <div>
            <span class="tech-pill">Streamlit</span>
            <span class="tech-pill">CSS3/HTML5</span>
            <span class="tech-pill">Plotly</span>
        </div>
    </div>
    """, unsafe_allow_html=True)

st.markdown("<br><br>", unsafe_allow_html=True)

# --- FOOTER ---
st.markdown("""
<div style="text-align: center; padding: 40px; border-top: 1px solid rgba(255,255,255,0.05); color: #555;">
    <p style="font-family: 'JetBrains Mono'; font-size: 12px; letter-spacing: 2px;">
        APEX CAUSAL ENGINE // BUILD 2026.V4 // RESEARCH GRADE
    </p>
</div>
""", unsafe_allow_html=True)
