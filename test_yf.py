import yfinance as yf
import time

print("Testing yfinance download...")
t0 = time.time()
try:
    data = yf.download("RELIANCE.NS", period="1d", interval="1m", progress=False)
    print(f"SUCCESS: {len(data)} rows fetched in {time.time()-t0:.2f}s")
except Exception as e:
    print(f"FAILED: {e}")
