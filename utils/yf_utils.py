import yfinance as yf
import threading
import time
import logging
import random
import requests
from functools import wraps
from typing import Optional

# ---------------------------------------------------------------------------
# Logging & Globals
# ---------------------------------------------------------------------------
logger = logging.getLogger("apex_ai.yf_utils")
_INIT_LOCK = threading.Lock()
_WARMED_UP = False

# Note: yfinance v0.2.40+ often requires curl_cffi for obfuscation.
# Manual session injection (requests) is now explicitly rejected by Yahoo.
# We are removing session-based downloads to let yf handle it natively.

def _get_headers():
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
    }

# ---------------------------------------------------------------------------
# Robust Retry Decorator
# ---------------------------------------------------------------------------
def yf_retry(max_retries=3, initial_backoff=1.0):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            retries = 0
            while retries <= max_retries:
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    err_msg = str(e)
                    is_transient = any(msg in err_msg for msg in [
                        "401", "Unauthorized", "Invalid Crumb", 
                        "404", "Not Found", "possibly delisted",
                        "ConnectionResetError", "RemoteDisconnected"
                    ])
                    
                    if not is_transient or retries == max_retries:
                        if retries > 0:
                            logger.error(f"Function {func.__name__} failed after {retries} retries: {e}")
                        raise
                    
                    backoff = initial_backoff * (2 ** retries) + random.uniform(0, 0.5)
                    logger.warning(f"Transient error in {func.__name__} for {args[0] if args else 'unknown'}: {e}. Retrying in {backoff:.2f}s...")
                    time.sleep(backoff)
                    retries += 1
            return None
        return wrapper
    return decorator

# ---------------------------------------------------------------------------
# Warm-up Logic
# ---------------------------------------------------------------------------
def _ensure_warm_up():
    global _WARMED_UP
    if not _WARMED_UP:
        with _INIT_LOCK:
            if not _WARMED_UP:
                logger.info("Initializing YFinance (warm-up)...")
                try:
                    # Fetch a reliable major ticker without session
                    yf.download("AAPL", period="1d", progress=False)
                    _WARMED_UP = True
                    logger.info("YFinance initialized successfully.")
                except Exception as e:
                    logger.warning(f"YFinance warm-up failed: {e}.")

# ---------------------------------------------------------------------------
# Robust Wrappers
# ---------------------------------------------------------------------------
@yf_retry(max_retries=3)
def download_yf(ticker, use_session=True, **kwargs):
    _ensure_warm_up()
    # Note: use_session is now ignored
    # Avoid 'multiple values for keyword argument' if progress in kwargs
    kwargs.setdefault('progress', False)
    kwargs.setdefault('threads', False) # Disable multithreading to avoid NoneType parsing errors
    return yf.download(ticker, **kwargs)


@yf_retry(max_retries=2)
def fetch_news_fallback(ticker: str) -> list:
    from bs4 import BeautifulSoup
    try:
        url = f"https://finance.yahoo.com/rss/headline?s={ticker}"
        resp = requests.get(url, headers=_get_headers(), timeout=5)
        if resp.status_code != 200: return []
        
        soup = BeautifulSoup(resp.content, "xml")
        items = []
        for item in soup.find_all("item")[:10]:
            items.append({
                "content": {
                    "title": item.title.text if item.title else "News Update",
                    "pubDate": item.pubDate.text if item.pubDate else "",
                    "url": item.link.text if item.link else "",
                    "summary": item.description.text if item.description else ""
                }
            })
        return items
    except Exception as e:
        logger.warning(f"RSS Fallback failed for {ticker}: {e}")
        return []


@yf_retry(max_retries=3)
def get_ticker(ticker, use_session=True):
    _ensure_warm_up()
    # Note: use_session is now ignored
    return yf.Ticker(ticker)

_ensure_warm_up()
