import yfinance as yf
import pandas as pd

def check_prices():
    tickers = ["RELIANCE.NS", "^NSEI", "^INDIAVIX"]
    for t in tickers:
        df = yf.download(t, period="1d", progress=False)
        if not df.empty:
            print(f"{t}: {df['Close'].iloc[-1]}")
        else:
            print(f"{t}: NO DATA")

if __name__ == "__main__":
    check_prices()
