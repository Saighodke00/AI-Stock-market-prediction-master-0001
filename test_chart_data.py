import yfinance as yf
import pandas as pd

ticker = yf.Ticker("MARUTI.NS")
hist = ticker.history(period="1d")
print(f"Dataframe index: {type(hist.index)}")
print(f"First 5 index items: {hist.index[:5]}")
if not hist.empty:
    print(f"Index(0) type: {type(hist.index[0])}")
    try:
        print(f"Timestamp(0): {hist.index[0].timestamp()}")
    except Exception as e:
        print(f"Timestamp failed: {e}")
