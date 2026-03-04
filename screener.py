"""
screener.py
===========
Apex AI — Multi-Ticker Signal Screener
---------------------------------------
Scans hundreds of stocks in parallel, gates each through the TFT signal
pipeline, and returns a ranked table of the best BUY / SELL opportunities.

Architecture
------------
  get_sp500_tickers()              → list[str]          (24-h disk cache)
  run_single_ticker_safe()         → dict | None        (error-safe wrapper)
  run_screener()                   → list[dict]         (ThreadPoolExecutor)
  filter_signals()                 → list[dict]         (ranked, pruned)
  build_screener_dataframe()       → pd.DataFrame       (display-ready)
  refresh_screener_cache [Celery]  → dict               (runs every 6 h)

CLI
---
  python screener.py               # full S&P 500 scan
  python screener.py --dry-run     # first 10 tickers only
  python screener.py --workers 4   # custom parallelism

Author : Apex AI Team
Requires: pandas, requests, tqdm, redis-py, celery
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("apex_ai.screener")

# ---------------------------------------------------------------------------
# Constants / Environment
# ---------------------------------------------------------------------------
_REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Disk-cache paths
_CACHE_DIR  = Path(__file__).parent / ".screener_cache"
_TICKER_CACHE_FILE  = _CACHE_DIR / "sp500_tickers.json"
_TICKER_CACHE_TTL   = 86_400        # 24 hours in seconds

# Redis cache
_SCREENER_REDIS_KEY = "apex_ai:screener_results"
_SCREENER_REDIS_TTL = 6 * 3600     # 6 hours in seconds

# S&P 500 Wikipedia URL
_SP500_WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"

# Slow-ticker warning threshold (seconds)
_SLOW_TICKER_THRESHOLD = 30.0


# ===========================================================================
# ── FUNCTION: get_sp500_tickers ──────────────────────────────────────────────
# ===========================================================================

def get_sp500_tickers(force_refresh: bool = False) -> List[str]:
    """Fetch the current S&P 500 constituent tickers from Wikipedia.

    Results are cached on disk for 24 hours to avoid repeated HTTP requests.

    Parameters
    ----------
    force_refresh : bool, optional
        If ``True``, bypass the disk cache and re-scrape Wikipedia.
        Defaults to ``False``.

    Returns
    -------
    list of str
        Ticker symbols compatible with yfinance (e.g. ``'BRK-B'`` not
        ``'BRK.B'``).

    Raises
    ------
    RuntimeError
        If scraping fails and no cached data is available.

    Notes
    -----
    The Wikipedia table may occasionally have tickers with a period (e.g.
    ``BRK.B``) which yfinance does not recognise; these are converted to
    hyphens automatically.
    """
    _CACHE_DIR.mkdir(exist_ok=True)

    # ── Check disk cache ─────────────────────────────────────────────────────
    if not force_refresh and _TICKER_CACHE_FILE.exists():
        try:
            cached = json.loads(_TICKER_CACHE_FILE.read_text(encoding="utf-8"))
            age = time.time() - cached.get("timestamp", 0)
            if age < _TICKER_CACHE_TTL:
                tickers = cached["tickers"]
                logger.info(
                    "get_sp500_tickers: loaded %d tickers from cache (age %.0f s)",
                    len(tickers), age,
                )
                return tickers
        except (json.JSONDecodeError, KeyError, OSError) as exc:
            logger.warning("get_sp500_tickers: cache read failed (%s) — re-fetching", exc)

    # ── Scrape Wikipedia ──────────────────────────────────────────────────────
    logger.info("get_sp500_tickers: fetching from Wikipedia…")
    try:
        tables = pd.read_html(_SP500_WIKI_URL, header=0)
        # First table on the page is the S&P 500 components
        df = tables[0]
        raw_tickers: List[str] = df["Symbol"].dropna().tolist()
    except Exception as exc:
        # Fallback: try loading stale cache before giving up
        if _TICKER_CACHE_FILE.exists():
            try:
                cached = json.loads(_TICKER_CACHE_FILE.read_text(encoding="utf-8"))
                logger.warning(
                    "get_sp500_tickers: Wikipedia scrape failed (%s) — using stale cache", exc
                )
                return cached["tickers"]
            except Exception:
                pass
        raise RuntimeError(
            f"get_sp500_tickers: could not fetch tickers from Wikipedia: {exc}"
        ) from exc

    # ── Normalise: period → hyphen for yfinance ───────────────────────────────
    tickers = [t.replace(".", "-") for t in raw_tickers]

    # ── Persist to cache ──────────────────────────────────────────────────────
    cache_payload = {"timestamp": time.time(), "tickers": tickers}
    try:
        _TICKER_CACHE_FILE.write_text(
            json.dumps(cache_payload, indent=2), encoding="utf-8"
        )
        logger.info("get_sp500_tickers: cached %d tickers to disk", len(tickers))
    except OSError as exc:
        logger.warning("get_sp500_tickers: could not write cache (%s)", exc)

    return tickers


# ===========================================================================
# ── FUNCTION: _get_sector ────────────────────────────────────────────────────
# ===========================================================================

def _get_sector_map() -> Dict[str, str]:
    """Return a ticker→sector mapping sourced from the Wikipedia S&P 500 table.

    Cached alongside the ticker list.  Returns empty dict on failure.
    """
    _CACHE_DIR.mkdir(exist_ok=True)
    sector_cache = _CACHE_DIR / "sp500_sectors.json"

    if sector_cache.exists():
        try:
            cached = json.loads(sector_cache.read_text(encoding="utf-8"))
            age = time.time() - cached.get("timestamp", 0)
            if age < _TICKER_CACHE_TTL:
                return cached["sectors"]
        except Exception:
            pass

    try:
        tables = pd.read_html(_SP500_WIKI_URL, header=0)
        df = tables[0]
        sector_map: Dict[str, str] = {}
        col = "GICS Sector" if "GICS Sector" in df.columns else (
            "Sector" if "Sector" in df.columns else None
        )
        sym_col = "Symbol" if "Symbol" in df.columns else df.columns[0]
        if col:
            for _, row in df.iterrows():
                sym = str(row[sym_col]).replace(".", "-")
                sector_map[sym] = str(row[col])
        payload = {"timestamp": time.time(), "sectors": sector_map}
        sector_cache.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return sector_map
    except Exception as exc:
        logger.warning("_get_sector_map: failed (%s) — sector info unavailable", exc)
        return {}


# ===========================================================================
# ── FUNCTION: run_single_ticker_safe ────────────────────────────────────────
# ===========================================================================

def run_single_ticker_safe(
    ticker: str,
    model: Any,
    training_dataset: Any,
    sentiment_cache: Optional[Dict[str, float]] = None,
    sector_map: Optional[Dict[str, str]] = None,
) -> Optional[Dict[str, Any]]:
    """Run TFT inference on one ticker with full error isolation.

    Any exception causes the ticker to be skipped (returns ``None``) rather
    than crashing the screener loop.  Execution time is measured and a
    warning is emitted for tickers that take longer than
    ``_SLOW_TICKER_THRESHOLD`` seconds.

    Parameters
    ----------
    ticker : str
        yfinance-compatible ticker symbol.
    model : TemporalFusionTransformer
        Trained TFT model in eval mode.
    training_dataset : TimeSeriesDataSet
        Training dataset for normalisation context.
    sentiment_cache : dict, optional
        Pre-computed ``{ticker: sentiment_score}`` mapping.  If the ticker
        is missing, a neutral score of 0.0 is used.
    sector_map : dict, optional
        ``{ticker: sector_string}`` mapping from Wikipedia data.

    Returns
    -------
    dict or None
        Flat result dict with all :class:`SignalOutput` fields plus
        ``'ticker'`` and ``'sector'``, or ``None`` on any error.
    """
    from signal_gate import run_inference  # lazy import (heavy deps)

    sentiment_score = (sentiment_cache or {}).get(ticker, 0.0)
    sector          = (sector_map or {}).get(ticker, "Unknown")

    t_start = time.monotonic()
    try:
        signal = run_inference(ticker, model, training_dataset, sentiment_score)
        elapsed = time.monotonic() - t_start

        if elapsed > _SLOW_TICKER_THRESHOLD:
            logger.warning(
                "run_single_ticker_safe [%s]: SLOW inference (%.1f s > %.0f s threshold)",
                ticker, elapsed, _SLOW_TICKER_THRESHOLD,
            )
        else:
            logger.debug(
                "run_single_ticker_safe [%s]: completed in %.2f s  action=%s  conf=%.2f",
                ticker, elapsed, signal.action, signal.confidence,
            )

        return {
            "ticker":              ticker,
            "action":              signal.action,
            "confidence":          round(signal.confidence, 4),
            "p10":                 round(signal.p10, 4),
            "p50":                 round(signal.p50, 4),
            "p90":                 round(signal.p90, 4),
            "current_price":       round(signal.current_price, 4),
            "expected_return_pct": round(signal.expected_return_pct, 4),
            "reason":              signal.reason,
            "gate_results":        signal.gate_results,
            "sector":              sector,
            "inference_time_s":    round(elapsed, 2),
            "scanned_at":          datetime.now(timezone.utc).isoformat(),
        }

    except Exception as exc:
        elapsed = time.monotonic() - t_start
        logger.error(
            "run_single_ticker_safe [%s]: ERROR after %.2f s — %s",
            ticker, elapsed, exc,
        )
        return None


# ===========================================================================
# ── FUNCTION: run_screener ───────────────────────────────────────────────────
# ===========================================================================

def run_screener(
    model: Any,
    training_dataset: Any,
    tickers: Optional[List[str]] = None,
    max_workers: int = 8,
    sentiment_cache: Optional[Dict[str, float]] = None,
) -> List[Dict[str, Any]]:
    """Run parallel TFT inference across a universe of tickers.

    Parameters
    ----------
    model : TemporalFusionTransformer
        Trained TFT model in eval mode.
    training_dataset : TimeSeriesDataSet
        Training dataset for normalisation context.
    tickers : list of str, optional
        Tickers to scan.  Defaults to the full S&P 500 list from
        :func:`get_sp500_tickers`.
    max_workers : int, optional
        Number of parallel threads.  Defaults to 8.
        Adjust down if GPU memory is constrained.
    sentiment_cache : dict, optional
        Pre-computed ``{ticker: sentiment_score}`` mapping passed through
        to :func:`run_single_ticker_safe`.

    Returns
    -------
    list of dict
        One dict per successfully scanned ticker (``None`` results are
        filtered out).  Each dict contains all :class:`SignalOutput` fields
        plus ``'ticker'``, ``'sector'``, ``'inference_time_s'``, and
        ``'scanned_at'``.

    Notes
    -----
    * A ``tqdm`` progress bar is shown on stderr during the scan.
    * Errors for individual tickers are logged and skipped silently.
    * Thread-safety: the TFT model is used in inference mode (``no_grad``),
      which is thread-safe for CPU.  For GPU, set ``max_workers=1`` or use
      model-level locking.
    """
    try:
        from tqdm import tqdm
    except ImportError:
        # Fallback: no-op progress bar if tqdm not installed
        class tqdm:  # type: ignore[no-redef]
            def __init__(self, total=None, desc="", unit=""):
                self.n = 0
                logger.info("%s — %d total", desc, total or 0)
            def update(self, n=1): self.n += n
            def close(self): pass
            def __enter__(self): return self
            def __exit__(self, *a): pass

    if tickers is None:
        tickers = get_sp500_tickers()

    sector_map = _get_sector_map()

    total = len(tickers)
    logger.info("run_screener: starting scan of %d tickers with %d workers", total, max_workers)
    t_run_start = time.monotonic()

    results: List[Dict[str, Any]] = []
    errors: int  = 0
    skipped: int = 0

    with tqdm(total=total, desc=f"Scanning {total} stocks", unit="ticker") as pbar:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_ticker = {
                executor.submit(
                    run_single_ticker_safe,
                    ticker,
                    model,
                    training_dataset,
                    sentiment_cache,
                    sector_map,
                ): ticker
                for ticker in tickers
            }

            for future in as_completed(future_to_ticker):
                ticker = future_to_ticker[future]
                try:
                    result = future.result()
                    if result is not None:
                        results.append(result)
                    else:
                        skipped += 1
                except Exception as exc:
                    errors += 1
                    logger.error(
                        "run_screener [%s]: unhandled future exception — %s", ticker, exc
                    )
                finally:
                    pbar.update(1)

    elapsed = time.monotonic() - t_run_start
    logger.info(
        "run_screener: DONE in %.1f s — %d succeeded / %d skipped / %d errors / %d total",
        elapsed, len(results), skipped, errors, total,
    )
    return results


# ===========================================================================
# ── FUNCTION: filter_signals ─────────────────────────────────────────────────
# ===========================================================================

def filter_signals(
    results: List[Dict[str, Any]],
    action: Optional[str] = None,
    min_confidence: float = 0.65,
    sector: Optional[str] = None,
    min_expected_return: float = 2.0,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """Filter and rank screener results.

    Parameters
    ----------
    results : list of dict
        Raw output from :func:`run_screener`.
    action : str, optional
        If provided, only return signals matching this action (``'BUY'``,
        ``'SELL'``, or ``'HOLD'``).  Case-insensitive.
    min_confidence : float, optional
        Minimum confidence score (0–1).  Defaults to 0.65.
    sector : str, optional
        If provided, only return tickers in this GICS sector.
        Partial, case-insensitive match (e.g. ``"tech"`` matches
        ``"Information Technology"``).
    min_expected_return : float, optional
        Minimum absolute expected return percentage.  Defaults to 2.0.
        Applied to the absolute value so ``-4.5%`` SELL signals are not
        filtered out when scanning for SELL opportunities.
    limit : int, optional
        Maximum number of results to return.  Defaults to 20.

    Returns
    -------
    list of dict
        Filtered and sorted results (highest confidence first).
    """
    filtered = results

    if action:
        target = action.upper()
        filtered = [r for r in filtered if r.get("action") == target]

    filtered = [r for r in filtered if r.get("confidence", 0) >= min_confidence]

    filtered = [
        r for r in filtered
        if abs(r.get("expected_return_pct", 0)) >= min_expected_return
    ]

    if sector:
        sector_lower = sector.lower()
        filtered = [
            r for r in filtered
            if sector_lower in r.get("sector", "").lower()
        ]

    # Sort by confidence descending, then by |expected_return| descending
    filtered.sort(
        key=lambda r: (r.get("confidence", 0), abs(r.get("expected_return_pct", 0))),
        reverse=True,
    )

    return filtered[:limit]


# ===========================================================================
# ── FUNCTION: build_screener_dataframe ──────────────────────────────────────
# ===========================================================================

def build_screener_dataframe(filtered_results: List[Dict[str, Any]]) -> pd.DataFrame:
    """Convert filtered screener results into a display-ready DataFrame.

    Parameters
    ----------
    filtered_results : list of dict
        Output from :func:`filter_signals`.

    Returns
    -------
    pd.DataFrame
        Columns: Ticker | Action | Confidence | P50 Forecast ($) |
                 Expected Return % | Sector | Why (short)
        Confidence displayed as percentage string (e.g. ``'82%'``).
        Expected Return formatted with sign (e.g. ``'+3.2%'``).

    Examples
    --------
    >>> df = build_screener_dataframe(filter_signals(results, action='BUY'))
    >>> print(df.to_string(index=False))
    """
    if not filtered_results:
        logger.warning("build_screener_dataframe: no results to display")
        return pd.DataFrame(columns=[
            "Ticker", "Action", "Confidence", "P50 Forecast ($)",
            "Expected Return %", "Sector", "Why (short)",
        ])

    rows = []
    for r in filtered_results:
        ret = r.get("expected_return_pct", 0.0)
        ret_str = f"{'+' if ret >= 0 else ''}{ret:.1f}%"
        conf_str = f"{r.get('confidence', 0) * 100:.0f}%"

        # Shorten the reason to ≤ 80 chars for table display
        why_full = r.get("reason", "")
        why_short = why_full[:77] + "…" if len(why_full) > 80 else why_full

        rows.append({
            "Ticker":            r.get("ticker", ""),
            "Action":            r.get("action", ""),
            "Confidence":        conf_str,
            "P50 Forecast ($)":  f"{r.get('p50', 0):.2f}",
            "Expected Return %": ret_str,
            "Sector":            r.get("sector", "Unknown"),
            "Why (short)":       why_short,
        })

    df = pd.DataFrame(rows)
    return df


# ===========================================================================
# ── SECTION: Redis helpers ───────────────────────────────────────────────────
# ===========================================================================

def _redis_client() -> Any:
    """Return a live Redis client or None if unavailable."""
    try:
        import redis as redis_lib
        client = redis_lib.from_url(_REDIS_URL, decode_responses=True)
        client.ping()
        return client
    except Exception as exc:
        logger.warning("_redis_client: Redis unavailable — %s", exc)
        return None


def store_screener_results(results: List[Dict[str, Any]]) -> bool:
    """Serialise screener results into Redis with a 6-hour TTL.

    Parameters
    ----------
    results : list of dict
        Output of :func:`run_screener`.

    Returns
    -------
    bool
        ``True`` if successfully stored, ``False`` otherwise.
    """
    rc = _redis_client()
    if rc is None:
        return False
    payload = json.dumps({
        "results":    results,
        "cached_at":  datetime.now(timezone.utc).isoformat(),
        "count":      len(results),
    })
    rc.set(_SCREENER_REDIS_KEY, payload, ex=_SCREENER_REDIS_TTL)
    logger.info("store_screener_results: stored %d results in Redis (TTL %d s)",
                len(results), _SCREENER_REDIS_TTL)
    return True


def load_screener_results() -> Optional[List[Dict[str, Any]]]:
    """Load cached screener results from Redis.

    Returns
    -------
    list of dict or None
        Cached results, or ``None`` if the key doesn't exist or Redis is down.
    """
    rc = _redis_client()
    if rc is None:
        return None
    raw = rc.get(_SCREENER_REDIS_KEY)
    if raw is None:
        return None
    try:
        data = json.loads(raw)
        results = data.get("results", [])
        cached_at = data.get("cached_at", "unknown")
        logger.info(
            "load_screener_results: loaded %d results (cached at %s)",
            len(results), cached_at,
        )
        return results
    except (json.JSONDecodeError, KeyError) as exc:
        logger.error("load_screener_results: deserialization error — %s", exc)
        return None


# ===========================================================================
# ── SECTION: Celery app ──────────────────────────────────────────────────────
# ===========================================================================

def _make_celery_app():
    """Create and configure the Celery app instance."""
    from celery import Celery
    app = Celery("apex_ai_screener", broker=_REDIS_URL, backend=_REDIS_URL)
    app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
        beat_schedule={
            "refresh-screener-every-6h": {
                "task":     "screener.refresh_screener_cache",
                "schedule": 6 * 3600,
                "options":  {"expires": 5 * 3600},
            },
        },
    )
    return app


try:
    celery_app = _make_celery_app()
except ImportError:
    celery_app = None  # type: ignore[assignment]
    logger.warning(
        "Celery not installed — refresh_screener_cache task unavailable. "
        "Run: pip install celery[redis]"
    )


# ===========================================================================
# ── CELERY TASK: refresh_screener_cache ─────────────────────────────────────
# ===========================================================================

def _refresh_screener_cache_impl() -> Dict[str, Any]:
    """Implementation of the Celery screener refresh task.

    Runs every 6 hours (configured in beat_schedule).

    Workflow
    --------
    1. Load TFT model + training dataset.
    2. Fetch S&P 500 ticker list.
    3. Run :func:`run_screener` across all tickers.
    4. Store results in Redis via :func:`store_screener_results`.
    5. Return a summary dict.

    Returns
    -------
    dict
        ``{'tickers_scanned': int, 'results_stored': int, 'elapsed_s': float}``
    """
    logger.info("refresh_screener_cache: task started")
    t0 = time.monotonic()

    try:
        model, training_dataset = _load_model_cached()
    except Exception as exc:
        logger.error("refresh_screener_cache: model load failed — %s", exc)
        return {"error": str(exc)}

    tickers = get_sp500_tickers()
    results = run_screener(model, training_dataset, tickers=tickers)
    store_screener_results(results)

    elapsed = time.monotonic() - t0
    summary = {
        "tickers_scanned": len(tickers),
        "results_stored":  len(results),
        "elapsed_s":       round(elapsed, 1),
    }
    logger.info("refresh_screener_cache: DONE — %s", summary)
    return summary


def refresh_screener_cache() -> Dict[str, Any]:
    """Celery Beat task entrypoint (decorated at module bottom if Celery available)."""
    return _refresh_screener_cache_impl()


if celery_app is not None:
    refresh_screener_cache = celery_app.task(
        name="screener.refresh_screener_cache",
        bind=False,
        max_retries=0,
    )(_refresh_screener_cache_impl)


# ===========================================================================
# ── STUB: Model loader ───────────────────────────────────────────────────────
# ===========================================================================

def _load_model_cached():
    """Load TFT model + training dataset from checkpoint.

    Replace this stub with your production loader if needed.
    The model loader in ``alerts.py`` can be shared/reused here.

    Returns
    -------
    tuple[TemporalFusionTransformer, TimeSeriesDataSet]
    """
    model_path = os.environ.get("MODEL_PATH", "models/tft_model.ckpt")
    try:
        from pytorch_forecasting import TemporalFusionTransformer
        import pickle
        model = TemporalFusionTransformer.load_from_checkpoint(model_path)
        model.eval()
        dataset_path = model_path.replace(".ckpt", "_dataset.pkl")
        with open(dataset_path, "rb") as fh:
            training_dataset = pickle.load(fh)
        return model, training_dataset
    except Exception as exc:
        logger.error("_load_model_cached: %s", exc)
        raise


# ===========================================================================
# ── CLI entry point ──────────────────────────────────────────────────────────
# ===========================================================================

def _build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Apex AI Screener — scan S&P 500 for TFT trading signals",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only scan the first 10 tickers (fast smoke test).",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=8,
        metavar="N",
        help="Number of parallel inference threads.",
    )
    parser.add_argument(
        "--action",
        choices=["BUY", "SELL", "HOLD"],
        default=None,
        help="Filter output to a specific signal action.",
    )
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=0.65,
        metavar="FLOAT",
        help="Minimum confidence score (0–1) to include in output.",
    )
    parser.add_argument(
        "--min-return",
        type=float,
        default=2.0,
        metavar="PCT",
        help="Minimum absolute expected return %% to include.",
    )
    parser.add_argument(
        "--sector",
        type=str,
        default=None,
        help="GICS sector filter (partial match, case-insensitive).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Maximum number of results to display.",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        metavar="PATH",
        help="Optional CSV output path for the screener results.",
    )
    parser.add_argument(
        "--force-refresh-tickers",
        action="store_true",
        help="Bypass the 24-h ticker cache and re-scrape Wikipedia.",
    )
    return parser


if __name__ == "__main__":
    import sys

    parser = _build_cli_parser()
    args   = parser.parse_args()

    # ── 1. Fetch tickers ─────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  Apex AI Screener")
    print("=" * 60)

    tickers = get_sp500_tickers(force_refresh=args.force_refresh_tickers)

    if args.dry_run:
        tickers = tickers[:10]
        print(f"\n  ⚡ DRY-RUN mode — scanning first {len(tickers)} tickers only\n")
    else:
        print(f"\n  📊 Scanning {len(tickers)} S&P 500 tickers "
              f"({args.workers} threads)\n")

    # ── 2. Load model ────────────────────────────────────────────────────────
    try:
        model, training_dataset = _load_model_cached()
    except Exception as exc:
        print(f"\n  ❌ Model load failed: {exc}")
        print(
            "  ℹ️  Set MODEL_PATH env var to your .ckpt file and ensure\n"
            "      models/tft_model_dataset.pkl exists alongside it.\n"
        )
        sys.exit(1)

    # ── 3. Run screener ──────────────────────────────────────────────────────
    raw_results = run_screener(
        model=model,
        training_dataset=training_dataset,
        tickers=tickers,
        max_workers=args.workers,
    )

    # ── 4. Filter & display ───────────────────────────────────────────────────
    filtered = filter_signals(
        raw_results,
        action=args.action,
        min_confidence=args.min_confidence,
        sector=args.sector,
        min_expected_return=args.min_return,
        limit=args.limit,
    )

    df = build_screener_dataframe(filtered)

    print(f"\n  Results: {len(filtered)} signal(s) found\n")
    if df.empty:
        print("  No signals matched the current filters.")
    else:
        try:
            print(df.to_string(index=False))
        except UnicodeEncodeError:
            sys.stdout.buffer.write(df.to_string(index=False).encode("utf-8"))

    # ── 5. Optional CSV export ───────────────────────────────────────────────
    if args.output:
        df.to_csv(args.output, index=False)
        print(f"\n  ✅ Results saved to: {args.output}")

    # ── 6. Store in Redis ─────────────────────────────────────────────────────
    if not args.dry_run:
        stored = store_screener_results(raw_results)
        if stored:
            print("\n  ✅ Results cached in Redis for API serving")

    print("\n" + "=" * 60 + "\n")
