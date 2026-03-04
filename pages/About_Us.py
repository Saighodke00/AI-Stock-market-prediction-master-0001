import streamlit as st

st.set_page_config(
    page_title="Apex AI - Neural Architects",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- REFINED STYLING ---
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');
    
    .stApp {
        background-color: #080a0f;
        color: #ffffff;
        font-family: 'Outfit', sans-serif;
    }

    .hero-section {
        padding: 80px 40px;
        background: linear-gradient(135deg, rgba(0, 210, 170, 0.1) 0%, rgba(8, 10, 15, 1) 100%);
        border-radius: 30px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        text-align: center;
        margin-bottom: 60px;
        position: relative;
        overflow: hidden;
    }
    
    .hero-section::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: radial-gradient(circle, rgba(0, 210, 170, 0.05) 0%, transparent 70%);
        z-index: 0;
    }

    .team-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 30px;
        perspective: 1000px;
    }

    .member-card {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 24px;
        padding: 40px 30px;
        text-align: center;
        backdrop-filter: blur(15px);
        transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
        position: relative;
        overflow: hidden;
    }

    .member-card:hover {
        transform: translateY(-15px) rotateX(5deg);
        border-color: #00d2aa;
        background: rgba(0, 210, 170, 0.03);
        box-shadow: 0 20px 40px rgba(0, 210, 170, 0.1);
    }

    .avatar-circle {
        width: 100px;
        height: 100px;
        background: linear-gradient(135deg, #00d2aa, #009e80);
        margin: 0 auto 25px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 36px;
        font-weight: 800;
        color: #080a0f;
        box-shadow: 0 10px 20px rgba(0, 210, 170, 0.3);
    }

    .member-name {
        font-size: 26px;
        font-weight: 800;
        color: #ffffff;
        margin-bottom: 8px;
        letter-spacing: -0.5px;
    }

    .member-role {
        font-family: 'JetBrains Mono', monospace;
        font-size: 13px;
        color: #00d2aa;
        text-transform: uppercase;
        letter-spacing: 2px;
        margin-bottom: 20px;
    }

    .member-bio {
        font-size: 16px;
        color: #aaa;
        line-height: 1.6;
        margin-bottom: 25px;
    }

    .tech-pill {
        display: inline-block;
        padding: 4px 12px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 50px;
        font-size: 11px;
        color: #888;
        margin: 4px;
    }

    .mission-statement {
        max-width: 800px;
        margin: 0 auto;
        font-size: 20px;
        color: #ddd;
        line-height: 1.8;
        font-weight: 300;
    }
</style>
""", unsafe_allow_html=True)

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
