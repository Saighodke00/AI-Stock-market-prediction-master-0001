import os
import sys
from typing import List

import numpy as np
import pandas as pd
import streamlit as st

# Ensure project root on path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from screener import (  # type: ignore
    build_screener_dataframe,
    filter_signals,
    load_screener_results,
)


st.set_page_config(
    page_title="Apex AI · Market Scanner",
    page_icon="🧭",
    layout="wide",
    initial_sidebar_state="expanded",
)


@st.cache_data(show_spinner=False)
def _get_screener_df(
    action_filter: str | None,
    min_conf: float,
    min_ret: float,
    sector_filter: str | None,
) -> pd.DataFrame:
    """Load cached screener results from Redis/disk and shape for UI."""
    raw = load_screener_results()
    if not raw:
        # If nothing cached yet, return empty frame – CLI/cron should populate.
        return pd.DataFrame(
            columns=[
                "Ticker",
                "Action",
                "Confidence",
                "P50 Forecast ($)",
                "Expected Return %",
                "Sector",
                "Why (short)",
            ]
        )

    filtered = filter_signals(
        raw,
        action=action_filter or None,
        min_confidence=min_conf,
        sector=sector_filter or None,
        min_expected_return=min_ret,
        limit=200,
    )
    return build_screener_dataframe(filtered)


# ── Global CSS to match dark terminal look ─────────────────────────────────────
st.markdown(
    """
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap');

.stApp {
    background: #03050c;
    color: #d0d8ef;
    font-family: 'Space Grotesk', sans-serif;
}

.block-container {
    padding: 1.5rem 2.5rem !important;
    max-width: 100% !important;
}

section[data-testid="stSidebar"] {
    background: #060c1a;
    border-right: 1px solid rgba(255,255,255,0.06);
}
section[data-testid="stSidebar"] * {
    color: #d0d8ef !important;
}

.scanner-pill {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.12);
    color: #8f9cc5;
}

.scanner-card {
    background: rgba(12,17,35,0.9);
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.06);
    padding: 18px 18px 16px;
}

.signal-buy    { color: #00e676; }
.signal-sell   { color: #ff5370; }
.signal-hold   { color: #f7b731; }

.scanner-table thead tr th {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
}
</style>
""",
    unsafe_allow_html=True,
)


# ── Sidebar controls ───────────────────────────────────────────────────────────
with st.sidebar:
    st.header("Scanner Filters")

    action = st.radio(
        "Signal Type",
        options=["All", "BUY", "SELL", "HOLD"],
        index=0,
        horizontal=True,
    )
    action_filter = None if action == "All" else action

    min_conf = st.slider("Minimum Confidence", 0.5, 0.95, 0.7, 0.01)
    min_ret = st.slider("Min Expected Return %", 0.5, 10.0, 2.0, 0.5)

    sector_filter = st.text_input("Sector contains (optional)", "")
    sector_filter = sector_filter or None

    st.caption(
        "Results are pulled from the last screener run. "
        "Use the CLI / Celery task to refresh the cache every few hours."
    )


# ── Header ─────────────────────────────────────────────────────────────────────
st.markdown(
    """
<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
  <div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:3px;color:#5a6585;text-transform:uppercase;margin-bottom:6px;">
      Apex AI · Multi‑Asset Scanner
    </div>
    <h1 style="font-size:32px;color:#ffffff;margin:0;">Market Scanner</h1>
  </div>
  <div style="display:flex; gap:8px; align-items:center;">
    <span class="scanner-pill">S&P 500 · NSE · Custom</span>
  </div>
</div>
<div style="height:1px;background:linear-gradient(90deg,rgba(247,183,49,0.45),rgba(0,229,201,0.35),transparent);margin-bottom:20px;"></div>
""",
    unsafe_allow_html=True,
)


# ── Load data & top metrics ────────────────────────────────────────────────────
df = _get_screener_df(
    action_filter=action_filter,
    min_conf=min_conf,
    min_ret=min_ret,
    sector_filter=sector_filter,
)

total = len(df)
buy_count = int((df["Action"] == "BUY").sum()) if total else 0
sell_count = int((df["Action"] == "SELL").sum()) if total else 0
hold_count = int((df["Action"] == "HOLD").sum()) if total else 0

m1, m2, m3, m4 = st.columns([1, 1, 1, 1.5])
with m1:
    st.markdown(
        f"""
        <div class="scanner-card">
          <div style="font-family:'JetBrains Mono';font-size:10px;letter-spacing:2px;color:#5a6585;text-transform:uppercase;">Buy Signals</div>
          <div style="font-size:26px;font-weight:700;color:#00e676;">{buy_count}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
with m2:
    st.markdown(
        f"""
        <div class="scanner-card">
          <div style="font-family:'JetBrains Mono';font-size:10px;letter-spacing:2px;color:#5a6585;text-transform:uppercase;">Sell Signals</div>
          <div style="font-size:26px;font-weight:700;color:#ff5370;">{sell_count}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
with m3:
    st.markdown(
        f"""
        <div class="scanner-card">
          <div style="font-family:'JetBrains Mono';font-size:10px;letter-spacing:2px;color:#5a6585;text-transform:uppercase;">Hold Signals</div>
          <div style="font-size:26px;font-weight:700;color:#f7b731;">{hold_count}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
with m4:
    st.markdown(
        f"""
        <div class="scanner-card">
          <div style="font-family:'JetBrains Mono';font-size:10px;letter-spacing:2px;color:#5a6585;text-transform:uppercase;">Universe Coverage</div>
          <div style="font-size:24px;font-weight:700;color:#ffffff;">{total} <span style="font-size:13px;color:#5a6585;">active signals</span></div>
        </div>
        """,
        unsafe_allow_html=True,
    )

st.markdown("<div style='height:20px;'></div>", unsafe_allow_html=True)


# ── Table + search ─────────────────────────────────────────────────────────────
search = st.text_input("Search ticker or sector", "").strip().upper()
display_df = df.copy()

if search:
    mask = display_df["Ticker"].str.contains(search, case=False, na=False) | display_df[
        "Sector"
    ].str.contains(search, case=False, na=False)
    display_df = display_df[mask]

if display_df.empty:
    st.warning(
        "No signals found for the current filters. "
        "Try lowering the confidence / return thresholds or refreshing the screener cache."
    )
else:
    # Color-code action and expected return columns
    def _fmt_action(val: str) -> str:
        cls = (
            "signal-buy"
            if val == "BUY"
            else "signal-sell"
            if val == "SELL"
            else "signal-hold"
        )
        return f'<span class="{cls}">{val}</span>'

    def _fmt_ret(val: str) -> str:
        try:
            pct = float(val.replace("%", ""))
        except Exception:
            return val
        color = "#00e676" if pct >= 0 else "#ff5370"
        return f'<span style="color:{color};">{val}</span>'

    html_table = (
        display_df.to_html(
            escape=False,
            index=False,
            classes="scanner-table",
        )
        .replace("dataframe", "scanner-table")
    )

    st.markdown(
        """
<style>
.scanner-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}
.scanner-table thead tr {
    background: rgba(11, 17, 35, 0.95);
}
.scanner-table th, .scanner-table td {
    padding: 9px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
}
.scanner-table tbody tr:hover {
    background: rgba(255,255,255,0.02);
}
</style>
""",
        unsafe_allow_html=True,
    )

    # Apply custom formatting for Action and Expected Return %
    display_df = display_df.copy()
    display_df["Action"] = display_df["Action"].apply(_fmt_action)
    display_df["Expected Return %"] = display_df["Expected Return %"].apply(_fmt_ret)

    html_table = (
        display_df.to_html(
            escape=False,
            index=False,
            classes="scanner-table",
        )
        .replace("dataframe", "scanner-table")
    )

    st.markdown(html_table, unsafe_allow_html=True)

