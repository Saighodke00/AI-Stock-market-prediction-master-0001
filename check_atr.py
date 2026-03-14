import sys
import os
import pandas as pd
import numpy as np
import yfinance as yf

# Add current dir to path
sys.path.insert(0, os.getcwd())

from utils.indicators import compute_atr

if __name__ == "__main__":
    ticker = "RELIANCE.NS"
    print(f"Fetching data for {ticker}...")
    df = yf.download(ticker, period="6mo", interval="1d", progress=False, auto_adjust=True)
    if hasattr(df.columns, 'get_level_values'):
        df.columns = df.columns.get_level_values(0)
    
    print(f"Calculating ATR for {ticker}...")
    atr = compute_atr(df)
    print(f"ATR: {atr} (type: {type(atr)})")
    
    import math
    if math.isnan(atr):
        print("ATR IS NAN!")
    else:
        print("ATR is valid.")
