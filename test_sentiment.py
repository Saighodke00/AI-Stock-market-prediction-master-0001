from utils.sentiment import fetch_and_score_ticker
import json

ticker = "NYKAA.NS"
print(f"Testing sentiment for {ticker}...")
result = fetch_and_score_ticker(ticker)
print(json.dumps(result, indent=2))
