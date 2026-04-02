import yfinance as yf
import threading
import time
import logging
import random
from functools import wraps

# ---------------------------------------------------------------------------
# Logging & Globals
# ---------------------------------------------------------------------------
logger = logging.getLogger("apex_ai.yf_utils")
_INIT_LOCK = threading.Lock()
_WARMED_UP = False

# ---------------------------------------------------------------------------
# Robust Retry Decorator
# ---------------------------------------------------------------------------
def yf_retry(max_retries=3, initial_backoff=1.0):
    """
    Decorator to handle intermittent YFinance failures (401, 404, etc.)
    with exponential backoff and jitter.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            retries = 0
            while retries <= max_retries:
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    err_msg = str(e)
                    # Common transient errors that warrant a retry
                    is_transient = any(msg in err_msg for msg in [
                        "401", "Unauthorized", "Invalid Crumb", 
                        "404", "Not Found", "possibly delisted",
                        "ConnectionResetError", "RemoteDisconnected"
                    ])
                    
                    if not is_transient or retries == max_retries:
                        if retries > 0:
                            logger.error(f"Function {func.__name__} failed after {retries} retries: {e}")
                        raise
                    
                    if "possibly delisted" in err_msg or "401" in err_msg or "Unauthorized" in err_msg:
                        global _WARMED_UP
                        with _INIT_LOCK:
                            if _WARMED_UP:
                                _WARMED_UP = False # Force fresh warm-up on next try
                                logger.info(f"Resetting YFinance session due to error: {err_msg}")
                                time.sleep(2) # Cooldown before re-initialization

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
    """
    Sequential warm-up to anchor the yfinance/curl_cffi session/crumb.
    Prevents race conditions where multiple threads trigger crumb-generation simultaneously.
    """
    global _WARMED_UP
    if not _WARMED_UP:
        with _INIT_LOCK:
            if not _WARMED_UP:
                logger.info("Initializing YFinance session (warm-up)...")
                try:
                    # Fetch a reliable major ticker to establish the session
                    # We no longer pass a manual 'session' object because recent yfinance
                    # versions (using curl_cffi) explicitly reject requests.Session.
                    yf.download("AAPL", period="1d", progress=False)
                    _WARMED_UP = True
                    logger.info("YFinance session initialized successfully.")
                except Exception as e:
                    logger.warning(f"YFinance warm-up failed: {e}. Subsequent calls may be unstable.")

# ---------------------------------------------------------------------------
# Robust Wrappers
# ---------------------------------------------------------------------------
@yf_retry(max_retries=3)
def download_yf(ticker, use_session=True, **kwargs):
    """
    Deep-stabilized wrapper for yf.download.
    Ensures session is warmed up and handles retries.
    """
    _ensure_warm_up()
    # Let yfinance handle session/crumb management internally via curl_cffi
    return yf.download(ticker, **kwargs)


@yf_retry(max_retries=3)
def get_ticker(ticker, use_session=True):
    """
    Deep-stabilized wrapper for yf.Ticker.
    Ensures session is warmed up and handles retries.
    """
    _ensure_warm_up()
    return yf.Ticker(ticker)
