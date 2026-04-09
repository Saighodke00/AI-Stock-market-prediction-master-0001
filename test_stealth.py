import yfinance as yf
import requests

def test():
    ticker = "RELIANCE.NS"
    print(f"Testing {ticker} with stealth session...")
    
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    })
    
    try:
        data = yf.download(ticker, period="1d", session=session)
        print("Download Success!")
        print(data.tail())
        
        t = yf.Ticker(ticker, session=session)
        print("News Count:", len(t.news))
    except Exception as e:
        print("Failed:", e)

if __name__ == "__main__":
    test()
