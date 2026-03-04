import numpy as np
import pandas as pd
from scipy.signal import find_peaks

def detect_support_resistance(df, window=20):
    """
    Detects Support and Resistance levels based on local minima and maxima.
    Returns: dict with 'support' and 'resistance' lists of prices.
    """
    # Use Close price for level detection
    prices = df['Close'].values
    
    # Resistance: Local peaks
    peaks, _ = find_peaks(prices, distance=window)
    resistance_levels = prices[peaks]
    
    # Support: Local valleys (inverse of peaks)
    valleys, _ = find_peaks(-prices, distance=window)
    support_levels = prices[valleys]
    
    # Cluster levels that are very close to each other (within 0.5%)
    def cluster_levels(levels):
        if len(levels) == 0: return []
        sorted_levels = np.sort(levels)
        final_levels = [sorted_levels[0]]
        for i in range(1, len(sorted_levels)):
            if (sorted_levels[i] - final_levels[-1]) / final_levels[-1] > 0.005:
                final_levels.append(sorted_levels[i])
        return final_levels

    return {
        "support": cluster_levels(support_levels)[-3:], # Return last 3 for clarity
        "resistance": cluster_levels(resistance_levels)[-3:]
    }

def calculate_position_size(account_balance, risk_pct, Entry, StopLoss):
    """
    Calculates the number of shares to buy based on the 2% Risk Rule.
    Equation: Shares = (Balance * Risk%) / (Entry - StopLoss)
    """
    risk_amount = account_balance * (risk_pct / 100)
    risk_per_share = abs(Entry - StopLoss)
    
    if risk_per_share == 0:
        return 0
    
    num_shares = risk_amount / risk_per_share
    return int(num_shares)

def calculate_multi_timeframe_confluence(ticker):
    """
    Simulates confluence across 7d, 14d, and 30d horizions.
    In a full implementation, this calls the model with different lead times.
    """
    confluence_score = np.random.uniform(0.4, 0.95)
    return round(confluence_score * 100, 1)
