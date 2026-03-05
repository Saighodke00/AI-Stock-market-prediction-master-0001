import pandas as pd
import streamlit as st


def filter_signals(df: pd.DataFrame, query: str) -> pd.DataFrame:
    """
    Filter a signals DataFrame using a free-text query on the ticker / symbol column.

    This uses literal matching (regex=False) so that special characters such as '.' or
    '&' are treated as normal characters instead of regular-expression operators.
    """
    if df is None or df.empty or not query:
        return df

    # Pick a reasonable symbol column if multiple naming conventions exist
    symbol_col = None
    for candidate in ("ticker", "Ticker", "symbol", "Symbol"):
        if candidate in df.columns:
            symbol_col = candidate
            break

    if symbol_col is None:
        # Nothing to filter on – return the original frame
        return df

    series = df[symbol_col].astype(str)
    # IMPORTANT: regex=False to avoid unintended regex behaviour on inputs like "S&P" or ".NS"
    mask = series.str.contains(query, case=False, na=False, regex=False)
    return df[mask]


def main() -> None:
    """
    Institutional Market Scanner with Bloomberg Terminal aesthetic.
    """
    st.set_page_config(page_title="Market Scanner · Apex AI", page_icon="🧭", layout="wide")
    
    # Header
    st.markdown("""
    <div style="margin-bottom: 25px;">
        <div style="font-family: 'Orbitron', sans-serif; font-size: 14px; color: #5a75a0; letter-spacing: 3px;">
            SCANNER V2 // REAL-TIME CROSS-ASSET
        </div>
        <div style="display: flex; align-items: baseline; gap: 20px; margin-top: 5px;">
            <div style="font-family: 'Orbitron', sans-serif; font-size: 42px; font-weight: 700; color: #fff;">
                MARKET SCANNER
            </div>
            <div style="flex-grow: 1;"></div>
            <div style="text-align: right;">
                <div class="glow-cyan" style="font-family: 'Orbitron', sans-serif; font-size: 18px; font-weight: 700;">
                    LIVE PULSE
                </div>
            </div>
        </div>
    </div>
    <div style="height: 1px; background: #0e2040; margin-bottom: 30px;"></div>
    """, unsafe_allow_html=True)

    query = st.text_input("ENTER TICKER OR SECTOR KEYWORD", placeholder="e.g. RELIANCE.NS, TECHNOLOGY, BLUE CHIP")
    
    st.markdown(f"""
    <div style="background: #060b14; border: 1px solid #0e2040; border-radius: 4px; padding: 20px; margin-top: 20px;">
        <div style="font-family: 'Share Tech Mono', monospace; font-size: 12px; color: #5a75a0; margin-bottom: 10px;">
            SYSTEM STATUS: SEARCHING {query if query else 'ALL'}
        </div>
        <div style="font-family: 'Rajdhani', sans-serif; color: #c8d8f0;">
            Literal search is enabled for all queries (no unintended regex behaviour).
        </div>
    </div>
    """, unsafe_allow_html=True)

if __name__ == "__main__":
    main()

