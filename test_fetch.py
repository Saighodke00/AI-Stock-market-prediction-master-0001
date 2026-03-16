
import yfinance as yf
import time
import pandas as pd

def test():
    ticker = "RELIANCE.NS"
    print(f"Testing primary fetch for {ticker}...")
    start = time.time()
    try:
        data = yf.download(ticker, period="2y", interval="1d", progress=False)
        print(f"Primary fetch took {time.time() - start:.2f}s. Shape: {data.shape}")
    except Exception as e:
        print(f"Primary fetch failed: {e}")

    print("\nTesting info fetch (static metadata)...")
    start = time.time()
    try:
        t = yf.Ticker(ticker)
        info = t.info
        print(f"Info fetch took {time.time() - start:.2f}s. Fields: {len(info) if info else 0}")
    except Exception as e:
        print(f"Info fetch failed: {e}")

    print("\nTesting macro fetch (^NSEI)...")
    start = time.time()
    try:
        macro = yf.download("^NSEI", period="2y", interval="1d", progress=False)
        print(f"Macro fetch took {time.time() - start:.2f}s. Shape: {macro.shape}")
    except Exception as e:
        print(f"Macro fetch failed: {e}")

if __name__ == "__main__":
    test()
