import yfinance as yf
import json

ticker_symbol = "MARUTI.NS"
ticker = yf.Ticker(ticker_symbol)
news = ticker.news

if news and len(news) > 0:
    first = news[0]
    print(f"Type of news item: {type(first)}")
    if isinstance(first, dict):
        print(f"Keys in news item: {list(first.keys())}")
        # Try to find 'title' or 'content'
        if 'content' in first:
            print(f"Keys in 'content': {list(first['content'].keys())}")
        
        # Deep search for title
        def find_key(obj, key):
            if key in obj: return obj[key]
            for k, v in obj.items():
                if isinstance(v, dict):
                    res = find_key(v, key)
                    if res: return res
            return None
        
        print(f"Deep search for 'title': {find_key(first, 'title')}")
    else:
        print(f"News item is not a dict: {first}")
else:
    print("No news found.")
