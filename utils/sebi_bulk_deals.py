"""
APEX AI — SEBI Bulk Deal Tracker  v1.0
Replaces: insider_tracker.py (was attempting SEC Form 4 — US-only, wrong for India)

Data source: NSE India bulk deal JSON API
  https://www.nseindia.com/api/bulk-deals
  https://www.nseindia.com/api/block-deals

NSE requires session cookies obtained by first hitting the homepage.
Falls back to empty list if the fetch fails (NSE occasionally changes API).
"""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

log = logging.getLogger("apex.sebi")

NSE_BULK_URL  = "https://www.nseindia.com/api/bulk-deals"
NSE_BLOCK_URL = "https://www.nseindia.com/api/block-deals"
NSE_HOME      = "https://www.nseindia.com"

NSE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/market-data/bulk-deals",
    "X-Requested-With": "XMLHttpRequest",
}

N_DEALS   = 10
CACHE_TTL = 300      # 5 minutes

_session_cookies: Optional[str] = None
_cookie_ts: float = 0.0
_cache: Dict[str, tuple[float, List[Dict]]] = {}


# ── NSE session management ────────────────────────────────────────────────────

def _get_nse_session_headers() -> Dict[str, str]:
    global _session_cookies, _cookie_ts
    try:
        import requests
    except ImportError:
        return {}

    if _session_cookies and (time.time() - _cookie_ts < 3600):
        return {"Cookie": _session_cookies}

    try:
        session = requests.Session()
        session.headers.update(NSE_HEADERS)
        session.get(NSE_HOME, timeout=10)
        _session_cookies = "; ".join(f"{k}={v}" for k, v in session.cookies.items())
        _cookie_ts = time.time()
        return {"Cookie": _session_cookies}
    except Exception as e:
        log.warning("NSE session init failed: %s", e)
        return {}


# ── Cache helpers ─────────────────────────────────────────────────────────────

def _get_cached(ticker: str) -> Optional[List[Dict]]:
    if ticker in _cache:
        ts, data = _cache[ticker]
        if time.time() - ts < CACHE_TTL:
            return data
    return None


def _set_cache(ticker: str, data: List[Dict]) -> None:
    _cache[ticker] = (time.time(), data)


# ── NSE fetch ─────────────────────────────────────────────────────────────────

def _classify(flag: str) -> str:
    return "BUY" if str(flag).upper().strip() in ("B", "BUY", "P", "PURCHASE") else "SELL"


def _fetch_nse(ticker: str) -> List[Dict]:
    try:
        import requests
    except ImportError:
        log.warning("requests not installed — pip install requests")
        return []

    symbol = ticker.replace(".NS", "").replace(".BO", "").upper()
    headers = {**NSE_HEADERS, **_get_nse_session_headers()}
    results: List[Dict] = []

    for url in [NSE_BULK_URL, NSE_BLOCK_URL]:
        try:
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code != 200:
                continue
            raw = resp.json()
            deals = raw.get("data", raw) if isinstance(raw, dict) else raw

            for d in deals:
                sym = (d.get("symbol") or d.get("SYMBOL") or d.get("Symbol") or "").upper()
                if sym != symbol:
                    continue
                results.append({
                    "symbol":      sym,
                    "client":      (d.get("clientName") or d.get("CLIENT_NAME") or "Unknown").strip(),
                    "transaction": _classify(d.get("buyOrSell") or d.get("BUY_SELL_FLAG") or "B"),
                    "quantity":    int(d.get("quantityTraded") or d.get("QUANTITY") or 0),
                    "price":       float(d.get("tradePrice") or d.get("PRICE") or 0.0),
                    "date":        d.get("mTIMESTAMP") or d.get("DATE") or datetime.now().strftime("%d-%b-%Y"),
                    "source":      "NSE Bulk Deal" if "bulk" in url else "NSE Block Deal",
                })
        except Exception as e:
            log.warning("NSE fetch failed (%s): %s", url, e)

    results.sort(key=lambda d: d.get("date", ""), reverse=True)
    return results[:N_DEALS]


# ── Public API ────────────────────────────────────────────────────────────────

def get_bulk_deals(ticker: str) -> List[Dict[str, Any]]:
    """
    Returns up to N_DEALS recent bulk/block deals for the ticker.
    Each deal: {symbol, client, transaction, quantity, price, date, source}
    Cached for CACHE_TTL seconds.
    """
    cached = _get_cached(ticker)
    if cached is not None:
        return cached

    deals = _fetch_nse(ticker)
    _set_cache(ticker, deals)

    if deals:
        buys  = sum(1 for d in deals if d["transaction"] == "BUY")
        sells = sum(1 for d in deals if d["transaction"] == "SELL")
        log.info("📋 SEBI deals %s: %d BUY, %d SELL", ticker, buys, sells)
    else:
        log.info("📋 No bulk deals for %s (normal for smaller caps)", ticker)

    return deals


def get_deal_summary(ticker: str) -> Dict[str, Any]:
    """Higher-level: net BUY/SELL volume + bullish/bearish signal label."""
    deals = get_bulk_deals(ticker)
    if not deals:
        return {"ticker": ticker, "net_signal": "NEUTRAL", "deals": [], "summary": "No recent bulk deals"}

    buy_qty  = sum(d["quantity"] for d in deals if d["transaction"] == "BUY")
    sell_qty = sum(d["quantity"] for d in deals if d["transaction"] == "SELL")
    total    = buy_qty + sell_qty

    if total == 0:
        net_signal = "NEUTRAL"
    elif buy_qty / total > 0.65:
        net_signal = "BULLISH"
    elif sell_qty / total > 0.65:
        net_signal = "BEARISH"
    else:
        net_signal = "MIXED"

    return {
        "ticker": ticker,
        "net_signal": net_signal,
        "buy_volume": buy_qty,
        "sell_volume": sell_qty,
        "deals": deals,
        "summary": f"{len(deals)} deal(s) — {net_signal} ({buy_qty:,} bought / {sell_qty:,} sold)",
    }


if __name__ == "__main__":
    import json
    for sym in ["RELIANCE.NS", "TCS.NS", "INFY.NS"]:
        print(f"\n{'='*50}\n{sym}")
        print(json.dumps(get_deal_summary(sym), indent=2, default=str))

# Alias used by main.py v3.0 import
fetch_bulk_deals = get_bulk_deals

