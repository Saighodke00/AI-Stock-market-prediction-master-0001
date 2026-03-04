import yfinance as yf
import pandas as pd
import sys

def check_ticker(ticker):
    print(f"Checking ticker: {ticker}")
    try:
        data = yf.download(ticker, period="1mo", interval="1d", progress=False)
        if data is None or data.empty:
            print(f"  FAILED: No data returned for {ticker}")
            return False
        else:
            print(f"  SUCCESS: Downloaded {len(data)} rows for {ticker}")
            return True
    except Exception as e:
        print(f"  ERROR: Exception for {ticker}: {e}")
        return False

if __name__ == "__main__":
    tickers = ["AAPL", "TSLA", "^NSEI", "RELIANCE.NS"]
    for t in tickers:
        check_ticker(t)
