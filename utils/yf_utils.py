import requests
import yfinance as yf

# Global hardened session for yfinance to bypass 401 Unauthorized (crumb) errors
YF_SESSION = requests.Session()
YF_SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
})

def download_yf(ticker, use_session=True, **kwargs):
    """Wrapper for yf.download, optionally using the hardened session."""
    if use_session:
        return yf.download(ticker, session=YF_SESSION, **kwargs)
    return yf.download(ticker, **kwargs)


def get_ticker(ticker, use_session=True):
    """Wrapper for yf.Ticker, optionally using the hardened session."""
    if use_session:
        return yf.Ticker(ticker, session=YF_SESSION)
    return yf.Ticker(ticker)

