import yfinance as yf
import json

ticker_symbol = "MARUTI.NS"
print(f"Testing YFinance for {ticker_symbol}...")

ticker = yf.Ticker(ticker_symbol)

# Test News
news = ticker.news
print(f"News count: {len(news)}")
if news:
    print("First headline:", news[0].get('title') if isinstance(news[0], dict) else "Structure unknown")
else:
    print("No news found via .news property.")

# Test History (Charts)
hist = ticker.history(period="1d")
print(f"History rows: {len(hist)}")

# Check if there's a structure change
if news:
    print("Full structure of first news item:")
    print(json.dumps(news[0], indent=2))
