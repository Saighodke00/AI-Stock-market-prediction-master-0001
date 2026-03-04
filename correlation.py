import yfinance as yf
import pandas as pd
import numpy as np
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

# ── LOGGING ──────────────────────────────────────────────────────────────────
logger = logging.getLogger("apex_ai.correlation")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(name)s — %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

# ── FUNCTIONS ────────────────────────────────────────────────────────────────

def calculate_correlation_matrix(tickers: List[str], period: str = '90d') -> Dict[str, Any]:
    """
    Fetch 90-day closing prices for all tickers and compute their correlation matrix.
    """
    logger.info(f"Calculating correlation matrix for {len(tickers)} tickers over {period}...")
    
    if not tickers:
        return {'matrix': {}, 'tickers': [], 'period': period, 'computed_at': datetime.now().isoformat()}

    try:
        # Fetch data for all tickers at once
        data = yf.download(tickers, period=period, interval='1d', progress=False)
        
        # Handle single ticker edge case vs multi-ticker multi-index
        if len(tickers) == 1:
            prices = data['Close'].to_frame()
            prices.columns = tickers
        else:
            if isinstance(data.columns, pd.MultiIndex):
                prices = data['Close']
            else:
                prices = data # Should not happen with multiple tickers in yfinance normally
        
        # Calculate daily returns
        returns = prices.pct_change().dropna()
        
        # Compute correlation matrix
        corr_matrix = returns.corr()
        
        # Convert to dict-of-dicts for JSON serialization
        matrix_dict = corr_matrix.to_dict()
        
        return {
            'matrix': matrix_dict,
            'tickers': list(corr_matrix.columns),
            'period': period,
            'computed_at': datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error calculating correlation matrix: {e}")
        return {'matrix': {}, 'tickers': [], 'period': period, 'error': str(e)}

def analyze_portfolio_risk(tickers: List[str], weights: Optional[List[float]] = None) -> Dict[str, Any]:
    """
    Analyze portfolio risk based on asset correlations and concentration.
    """
    if not tickers:
        return {'avg_correlation': 0.0, 'concentration_risk': 'LOW', 'suggestion': 'Add tickers to analyze risk.'}

    # Calculate correlation matrix first
    corr_data = calculate_correlation_matrix(tickers)
    matrix = corr_data.get('matrix', {})
    
    if not matrix:
        return {'avg_correlation': 0.0, 'concentration_risk': 'UNKNOWN', 'suggestion': 'Could not fetch data for analysis.'}
    
    # Extract values from dict-of-dicts
    df_corr = pd.DataFrame(matrix)
    
    # Calculate average pairwise correlation (excluding diagonal)
    mask = np.ones(df_corr.shape, dtype=bool)
    np.fill_diagonal(mask, 0)
    avg_corr = df_corr.values[mask].mean()
    
    # Find highest correlated pair
    corr_pairs = []
    for i in range(len(df_corr.columns)):
        for j in range(i + 1, len(df_corr.columns)):
            t1, t2 = df_corr.columns[i], df_corr.columns[j]
            corr_pairs.append(((t1, t2), matrix[t1][t2]))
    
    most_correlated = sorted(corr_pairs, key=lambda x: x[1], reverse=True)[0] if corr_pairs else (None, 0)
    
    # Portfolio Concentration Assessment
    risk_level = "LOW"
    if avg_corr > 0.70:
        risk_level = "HIGH"
    elif avg_corr > 0.45:
        risk_level = "MEDIUM"
        
    # Suggestion Logic
    # Simple sector check (proxy based on ticker patterns or common tech stocks)
    tech_proxies = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'TSLA', 'AMZN']
    tech_count = sum(1 for t in tickers if t.upper() in tech_proxies)
    tech_overlap = tech_count / len(tickers) if tickers else 0
    
    suggestion = "Your portfolio is well-diversified."
    if tech_overlap > 0.6 and avg_corr > 0.6:
        suggestion = f"Your portfolio is {int(avg_overlap*100 if 'avg_overlap' in locals() else tech_overlap*100)}% correlated to tech momentum. Consider adding positions in XLP (Consumer Staples) or GLD (Gold) to reduce concentration risk."
    elif avg_corr > 0.5:
        suggestion = "High internal correlation detected. Consider adding non-correlated assets like Bonds (BND) or defensive sectors."

    return {
        'avg_correlation': round(float(avg_corr), 4),
        'concentration_risk': risk_level,
        'most_correlated_pair': most_correlated[0],
        'most_correlated_value': round(float(most_correlated[1]), 4),
        'suggestion': suggestion
    }

if __name__ == "__main__":
    # Standalone test
    test_tickers = ["AAPL", "MSFT", "NVDA", "GLD", "XOM"]
    print(f"Testing correlation analysis for: {test_tickers}")
    
    corr_results = calculate_correlation_matrix(test_tickers)
    risk_results = analyze_portfolio_risk(test_tickers)
    
    print("\nCORRELATION MATRIX PREVIEW (AAPL):")
    if "AAPL" in corr_results['matrix']:
        for t, val in corr_results['matrix']['AAPL'].items():
            print(f"  AAPL vs {t}: {val:.2f}")
            
    print("\nRISK ASSESSMENT:")
    print(f"  Avg Correlation    : {risk_results['avg_correlation']:.2f}")
    print(f"  Concentration Risk : {risk_results['concentration_risk']}")
    print(f"  Most Correlated    : {risk_results['most_correlated_pair']} ({risk_results['most_correlated_value']})")
    print(f"  Suggestion         : {risk_results['suggestion']}")
