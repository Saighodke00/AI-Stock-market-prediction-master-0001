
import sys
import os
sys.path.append(os.getcwd())


try:
    import yfinance as yf
    print("Testing yf.download WITHOUT session...")
    data = yf.download("AAPL", period="1d")
    print(f"SUCCESS: yf.download executed without session, shape: {data.shape}")
except Exception as e:
    print(f"FAILED without session: {e}")

