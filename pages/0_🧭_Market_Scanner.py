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
    Lightweight Market Scanner page.

    The full visual experience is handled elsewhere in the app; this page exists
    primarily so that `filter_signals` can be imported and used safely in tests
    and other modules without raising regex-related search bugs.
    """
    st.set_page_config(page_title="Market Scanner · Apex AI", page_icon="🧭", layout="wide")
    st.title("Market Scanner")
    st.caption("Literal search is enabled for all queries (no unintended regex behaviour).")


if __name__ == "__main__":
    main()

