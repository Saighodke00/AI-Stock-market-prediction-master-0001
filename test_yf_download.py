import sys
import os
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
from utils.yf_utils import download_yf
import pandas as pd

tickers = ["^CNXIT", "^NSEBANK", "^CNXFMCG", "^CNXPHARMA"]

print("Testing YFinance Download with threads=False...")
for ticker in tickers:
    print(f"\n--- Testing {ticker} ---")
    try:
        data = download_yf(ticker, period="1d", interval="5m")
        if data is not None and not data.empty:
            print(f"SUCCESS: {ticker} returned {len(data)} rows.")
            print(data.tail(2))
        else:
            print(f"FAILURE: {ticker} returned EMPTY dataframe.")
    except Exception as e:
        print(f"CRITICAL ERROR for {ticker}: {e}")
