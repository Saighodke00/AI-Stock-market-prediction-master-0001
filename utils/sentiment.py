"""
sentiment.py
============
Apex AI — FinBERT Sentiment Engine
----------------------------------
Financial news sentiment module powered by HuggingFace `ProsusAI/finbert`.
Fetches the latest news articles for a given ticker via `yfinance`, scores
their aggregated titles and summaries, and caches the result for 4 hours
using Redis to avoid redundant API/inference calls.

API
---
    get_pipeline()                           → transformers.Pipeline
    score_text(text)                         → dict
    score_headlines(headlines_list)          → tuple[list[dict], float]
    fetch_and_score_ticker(ticker)           → dict
    sentiment_label(score)                   → tuple[str, str]  # (Label, Emoji)

Author : Apex AI Team
Requires: transformers, torch, yfinance, redis
"""

import json
import logging
import os
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

# ── SILENCE TENSORFLOW ────────────────────────────────────────────────────────
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"      # 0=all, 1=no INFO, 2=no INFO/WARN, 3=no INFO/WARN/ERROR
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"     # Disable oneDNN custom operations warnings
try:
    import tensorflow as tf
    tf.get_logger().setLevel("ERROR")            # Suppress Python-level deprecation warnings
except Exception:
    pass
# ──────────────────────────────────────────────────────────────────────────────

import redis
import yfinance as yf

# Force legacy Keras for Transformers (prevents some TF warnings)
os.environ["TF_USE_LEGACY_KERAS"] = "1"
from transformers import pipeline

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("apex_ai.sentiment")

# ---------------------------------------------------------------------------
# Module-level singletons & constants
# ---------------------------------------------------------------------------
_PIPELINE: Optional[Any] = None
_REDIS_CLIENT: Optional[redis.Redis] = None

# Redis cache TTL: 4 hours = 14400 seconds
CACHE_TTL = 4 * 3600

def _get_redis() -> Optional[redis.Redis]:
    """Lazy initialize the Redis client with a graceful fallback."""
    global _REDIS_CLIENT
    if _REDIS_CLIENT is None:
        try:
            # Decode responses to get strings instead of bytes
            client = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)
            # Ping to verify connection
            client.ping()
            _REDIS_CLIENT = client
            logger.info("Connected to Redis cache at localhost:6379")
        except redis.ConnectionError:
            logger.debug("Redis unavailable at localhost:6379 — running without cache (expected in local dev).")
            _REDIS_CLIENT = False  # Use False to mark as explicitly failed to avoid reconnect loops
        except Exception as e:
            logger.error("Unexpected Redis error: %s. Caching disabled.", e)
            _REDIS_CLIENT = False
    return _REDIS_CLIENT if _REDIS_CLIENT is not False else None


# ===========================================================================
# ── FUNCTION: get_pipeline ──────────────────────────────────────────────────
# ===========================================================================
def get_pipeline() -> Any:
    """Lazy-load the FinBERT pipeline as a module-level singleton.
    
    Determines the best available hardware accelerator (MPS for Apple Silicon,
    CUDA for NVIDIA, or CPU) and loads `ProsusAI/finbert`.

    Returns
    -------
    transformers.Pipeline
        The loaded sentiment-analysis pipeline.
    """
    global _PIPELINE
    if _PIPELINE is not None:
        return _PIPELINE

    import torch

    device = -1  # Default to CPU for HuggingFace pipeline
    device_name = "cpu"

    if torch.cuda.is_available():
        device = 0
        device_name = "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = "mps"
        device_name = "mps"

    logger.info("Loading ProsusAI/finbert model on device: %s...", device_name)
    
    try:
        # Load the pipeline. 
        # top_k=None ensures we get scores for all 3 labels (positive, negative, neutral)
        _PIPELINE = pipeline(
            "sentiment-analysis", 
            model="ProsusAI/finbert", 
            device=device,
            top_k=None 
        )
        logger.info("FinBERT pipeline loaded successfully.")
    except Exception as e:
        logger.error("Error loading FinBERT: %s. Returning None.", e)
        raise RuntimeError(f"Failed to load FinBERT: {e}")

    return _PIPELINE


# ===========================================================================
# ── FUNCTION: score_text ────────────────────────────────────────────────────
# ===========================================================================
def score_text(text: str) -> Dict[str, float]:
    """Run a single text string through FinBERT and extract structured scores.

    Parameters
    ----------
    text : str
        The input text (e.g., a news headline or summary).

    Returns
    -------
    dict
        Structured sentiment scores:
        {'positive': float, 'negative': float, 'neutral': float, 'score': float}
        where 'score' = positive - negative (range: -1.0 to +1.0).
    """
    nlp = get_pipeline()
    
    # max_length=512 is the BERT maximum sequence length
    # truncation=True ensures we don't crash on long articles
    results = nlp(text, truncation=True, max_length=512)
    
    # results is a list of lists because we passed a single string.
    # Since top_k=None, we get all labels natively.
    labels_list = results[0] if isinstance(results[0], list) else results
    
    score_dict = {"positive": 0.0, "negative": 0.0, "neutral": 0.0}
    
    for item in labels_list:
        label = item["label"]
        score_dict[label] = item["score"]
        
    # Aggregate score logic: positive probability minus negative probability.
    # Yields a continuous range between -1.0 and +1.0
    agg_score = score_dict["positive"] - score_dict["negative"]
    score_dict["score"] = agg_score
    
    return score_dict


# ===========================================================================
# ── FUNCTION: score_headlines ───────────────────────────────────────────────
# ===========================================================================
def score_headlines(headlines_list: List[str]) -> Tuple[List[Dict[str, float]], float]:
    """Batch process a list of headline strings through FinBERT.

    Parameters
    ----------
    headlines_list : list[str]
        A list of textual headlines or combined title+summary strings.

    Returns
    -------
    tuple
        (individual_scores, aggregate_score)
        individual_scores is a list of score dictionaries.
        aggregate_score is the mean 'score' across all strings (-1.0 to 1.0).
        If the input list is empty, returns ([], 0.0).
    """
    if not headlines_list:
        return [], 0.0

    individual_scores = []
    
    # While the pipeline can accept a list directly, looping allows us to
    # cleanly extract out the individual dicts and is generally fast enough
    # for 10 headlines.
    for text in headlines_list:
        if not text.strip():
            continue
        try:
            score_data = score_text(text)
            individual_scores.append(score_data)
        except Exception as e:
            logger.warning("Failed to score text chunk: %s", e)
            
    if not individual_scores:
        return [], 0.0
        
    aggregate_score = sum(s["score"] for s in individual_scores) / len(individual_scores)
    
    return individual_scores, float(aggregate_score)


# ===========================================================================
# ── FUNCTION: sentiment_label ───────────────────────────────────────────────
# ===========================================================================
def sentiment_label(score: float) -> Tuple[str, str]:
    """Convert a continuous sentiment score into a categorical label and emoji.

    Parameters
    ----------
    score : float
        The bounded sentiment score (-1.0 to +1.0).

    Returns
    -------
    tuple[str, str]
        (Label, Emoji) e.g., ("BULLISH", "🟢").
    """
    if score > 0.2:
        return "BULLISH", "🟢"
    elif score < -0.2:
        return "BEARISH", "🔴"
    else:
        return "NEUTRAL", "🟡"


# ===========================================================================
# ── FUNCTION: fetch_and_score_ticker ──────────────────────────────────────
# ===========================================================================
def fetch_and_score_ticker(ticker: str) -> Dict[str, Any]:
    """Fetch recent news via yfinance, score it, and cache the result.

    Combines the title and summary of up to 10 recent news articles for the
    provided ticker, evaluates average FinBERT sentiment, and caches the full 
    response in Redis for 4 hours to prevent redundant compute.

    Parameters
    ----------
    ticker : str
        Yahoo Finance ticker symbol (e.g., 'AAPL').

    Returns
    -------
    dict
        Comprehensive sentiment report containing:
        {
            'ticker': str,
            'aggregate_score': float,
            'label': str,
            'emoji': str,
            'article_count': int,
            'articles': [
                {'title': str, 'score': float, 'published': ISO date str}, ...
            ],
            'cached': bool
        }
    """
    cache_key = f"apex:sentiment:{ticker}"
    redis_client = _get_redis()
    
    # ── 1. Check Cache ────────────────────────────────────────────────────────
    if redis_client:
        cached_data = redis_client.get(cache_key)
        if cached_data:
            try:
                parsed = json.loads(cached_data)
                parsed["cached"] = True
                logger.debug("Cache hit for %s sentiment", ticker)
                return parsed
            except json.JSONDecodeError:
                logger.warning("Corrupted cache payload for %s; re-fetching.", ticker)

    # ── 2. Fetch News from yfinance ───────────────────────────────────────────
    # ApexAI Sentiment Engine v1.1
    logger.info("ApexAI Sentiment Engine v1.1 — Processing %s", ticker)
    _NEUTRAL_FALLBACK = {
        "ticker": ticker,
        "aggregate_score": 0.0,
        "label": "NEUTRAL",
        "emoji": "🟡",
        "article_count": 0,
        "articles": [],
        "cached": False,
    }
    try:
        stock = yf.Ticker(ticker)
        news_items = stock.news
    except Exception as _net_err:
        # DNS resolution failure, timeout, Yahoo Finance down, etc.
        logger.warning(
            "fetch_and_score_ticker [%s]: network/DNS error fetching news — %s. "
            "Returning neutral sentiment (HOLD).",
            ticker, _net_err,
        )
        return _NEUTRAL_FALLBACK

    if not news_items:
        logger.info("No news returned for %s", ticker)
        return _NEUTRAL_FALLBACK

    # ── 3. Parse Titles & Summaries (Up to 10) ────────────────────────────────
    headlines_to_score = []
    articles_meta = []
    
    # Sort or parse up to 10 items
    for item in news_items[:10]:
        # yfinance news schema can vary slightly handled gracefully
        content = item.get('content', item)
        title = content.get('title', '').strip()
        summary = content.get('summary', '').strip()
        
        if not title:
            continue
            
        combined_text = f"{title}. {summary}" if summary else title
        headlines_to_score.append(combined_text)
        
        # Determine publisher/time for metadata
        pub_time = None
        if 'providerPublishTime' in content:
            pub_time = datetime.fromtimestamp(content['providerPublishTime']).isoformat()
            
        articles_meta.append({
            "title": title,
            "published": pub_time or datetime.now().isoformat(),
            "url": content.get('url') or content.get('link') or ""
        })

    # ── 4. Score through FinBERT ──────────────────────────────────────────────
    logger.info("Scoring %d articles for %s...", len(headlines_to_score), ticker)
    individual_scores, agg_score = score_headlines(headlines_to_score)
    
    # Pair scores with metadata
    for i, meta in enumerate(articles_meta):
        if i < len(individual_scores):
            meta["score"] = individual_scores[i]["score"]
        else:
            meta["score"] = 0.0
            
    label, emoji = sentiment_label(agg_score)

    result_payload = {
        "ticker": ticker,
        "aggregate_score": round(agg_score, 4),
        "label": label,
        "emoji": emoji,
        "article_count": len(articles_meta),
        "articles": articles_meta,
        "cached": False
    }

    # ── 5. Cache Result ───────────────────────────────────────────────────────
    if redis_client:
        try:
            # Drop the 'cached' flag from the payload we store
            cache_payload = result_payload.copy()
            del cache_payload["cached"]
            
            redis_client.setex(cache_key, CACHE_TTL, json.dumps(cache_payload))
            logger.info("Cached sentiment for %s (TTL: %d s)", ticker, CACHE_TTL)
        except Exception as e:
            logger.error("Failed to cache sentiment for %s: %s", ticker, e)

    return result_payload


# ===========================================================================
# ── BACKWARD COMPATIBILITY WRAPPER ──────────────────────────────────────
# ===========================================================================
def get_market_sentiment(ticker: str) -> Tuple[float, List[Dict[str, Any]]]:
    """Compatibility wrapper for legacy code (e.g., Swing_Trading.py).

    Calls `fetch_and_score_ticker()` and unpacks its structured dict back
    into the original `(avg_score, top_news_list)` tuple format.

    Returns ``(0.0, [])`` on any network or model error so the Streamlit
    page can always continue rendering.
    """
    try:
        result = fetch_and_score_ticker(ticker)
    except Exception as exc:
        logger.warning(
            "get_market_sentiment [%s]: unexpected error — %s. "
            "Returning neutral (0.0, []).",
            ticker, exc,
        )
        return 0.0, []

    # Map back to the expected list of dicts format with 'link' instead of 'url'
    legacy_articles = []
    for art in result.get("articles", []):
        legacy_articles.append({
            "title": art.get("title", ""),
            "link":  art.get("url", ""),
            "publisher": art.get("publisher", "Yahoo Finance"),
            "score": art.get("score", 0.0),
        })

    return result.get("aggregate_score", 0.0), legacy_articles


# ===========================================================================
# ── __main__ — Score AAPL as a smoke test ──────────────────────────────────
# ===========================================================================
if __name__ == "__main__":
    import json
    import time
    
    print("\n" + "=" * 60)
    print("  Apex AI — sentiment.py smoke test (AAPL)")
    print("=" * 60 + "\n")
    
    # 1. Run First Fetch (Likely Cache Miss / Cold Start)
    print("▶ Run 1: First fetch (cold model, API call)...")
    t0 = time.time()
    result1 = fetch_and_score_ticker("AAPL")
    t1 = time.time() - t0
    
    print(f"\n  Result [{t1:.2f}s]:")
    print(f"  Ticker : {result1['ticker']}")
    print(f"  Score  : {result1['aggregate_score']} {result1['emoji']} ({result1['label']})")
    print(f"  Count  : {result1['article_count']} articles")
    print(f"  Cached : {result1.get('cached', False)}")
    
    if result1['articles']:
        print("\n  Top 3 Articles:")
        for idx, art in enumerate(result1['articles'][:3]):
            print(f"    {idx+1}. [{art['score']:+.2f}] {art['title']}")
            
    # 2. Run Second Fetch (Expected Cache Hit)
    print(f"\n{'-' * 60}")
    print("▶ Run 2: Second fetch (should hit Redis cache if running)...")
    t0 = time.time()
    result2 = fetch_and_score_ticker("AAPL")
    t2 = time.time() - t0
    
    print(f"\n  Result [{t2:.4f}s]:")
    print(f"  Score  : {result2['aggregate_score']} {result2['emoji']}")
    print(f"  Cached : {result2.get('cached', False)}")
    
    if result2.get('cached', False):
        print("  ✅ Cache HIT confirmed.")
    else:
        print("  ⚠️  Cache MISS (Redis might not be running locally).")

    print("\n" + "=" * 60)
    print("  Smoke test complete.")
    print("=" * 60 + "\n")
