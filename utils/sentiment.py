"""
sentiment.py
============
Apex AI - FinBERT Sentiment Engine
----------------------------------
Financial news sentiment module powered by HuggingFace `ProsusAI/finbert`.
Fetches the latest news articles for a given ticker via `yfinance`, scores
their aggregated titles and summaries, and caches the result for 4 hours
using Redis to avoid redundant API/inference calls.

API
---
    get_pipeline()                           -> transformers.Pipeline
    score_text(text)                         -> dict
    score_headlines(headlines_list)          -> tuple[list[dict], float]
    fetch_and_score_ticker(ticker)           -> dict
    sentiment_label(score)                   -> tuple[str, str]  # (Label, Emoji)

Author : Apex AI Team
Requires: transformers, torch, yfinance, redis
"""

import json
import logging
import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
import functools
import redis
from utils.yf_utils import get_ticker

# ── SILENCE TENSORFLOW ────────────────────────────────────────────────────────
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"      # 0=all, 1=no INFO, 2=no INFO/WARN, 3=no INFO/WARN/ERROR
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"     # Disable oneDNN custom operations warnings

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
from rich.logging import RichHandler

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(rich_tracebacks=True, show_path=False)]
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
            client = redis.Redis(
                host="localhost", 
                port=6379, 
                db=0, 
                decode_responses=True,
                socket_connect_timeout=1.0,
                socket_timeout=1.0
            )
            client.ping()
            _REDIS_CLIENT = client
            logger.info("Connected to Redis cache at localhost:6379")
        except:
            _REDIS_CLIENT = False
    return _REDIS_CLIENT if _REDIS_CLIENT is not False else None

@functools.lru_cache(maxsize=1)
def get_pipeline() -> Any:
    """Load FinBERT once and cache it."""
    from transformers import pipeline as hf_pipeline
    import torch
    logging.getLogger("transformers").setLevel(logging.ERROR)
    device = 0 if torch.cuda.is_available() else -1
    return hf_pipeline(
        "sentiment-analysis", 
        model="ProsusAI/finbert", 
        device=device,
        top_k=None,
        truncation=True,
        max_length=512
    )

def score_text(text: str) -> Dict[str, float]:
    nlp = get_pipeline()
    results = nlp(text, truncation=True, max_length=512)
    labels_list = results[0] if isinstance(results[0], list) else results
    score_dict = {"positive": 0.0, "negative": 0.0, "neutral": 0.0}
    for item in labels_list:
        score_dict[item["label"]] = item["score"]
    score_dict["score"] = score_dict["positive"] - score_dict["negative"]
    return score_dict

def score_headlines(headlines_list: List[str]) -> Tuple[List[Dict[str, float]], float]:
    if not headlines_list: return [], 0.0
    valid_headlines = [text for text in headlines_list if text.strip()]
    if not valid_headlines: return [], 0.0
    nlp = get_pipeline()
    try:
        results = nlp(valid_headlines)
    except:
        return [], 0.0
    individual_scores = []
    for res_list in results:
        labels_list = res_list if isinstance(res_list, list) else [res_list]
        score_dict = {"positive": 0.0, "negative": 0.0, "neutral": 0.0}
        for item in labels_list:
            score_dict[item["label"]] = item["score"]
        score_dict["score"] = score_dict["positive"] - score_dict["negative"]
        individual_scores.append(score_dict)
    if not individual_scores: return [], 0.0
    aggregate_score = sum(s["score"] for s in individual_scores) / len(individual_scores)
    return individual_scores, float(aggregate_score)

def sentiment_label(score: float) -> Tuple[str, str]:
    if score > 0.2: return "BULLISH", "🟢"
    elif score < -0.2: return "BEARISH", "🔴"
    else: return "NEUTRAL", "🟡"

def fetch_and_score_ticker(ticker: str) -> Dict[str, Any]:
    cache_key = f"apex:sentiment:{ticker}"
    redis_client = _get_redis()
    if redis_client:
        cached_data = redis_client.get(cache_key)
        if cached_data:
            try:
                parsed = json.loads(cached_data)
                parsed["cached"] = True
                return parsed
            except: pass

    _NEUTRAL_FALLBACK = {
        "ticker": ticker, "aggregate_score": 0.0, "label": "NEUTRAL",
        "emoji": "🟡", "article_count": 0, "articles": [], "cached": False,
    }
    try:
        stock = get_ticker(ticker, use_session=True)
        news_items = stock.news
    except Exception as e:
        logger.warning("Error fetching news for %s: %s", ticker, e)
        return _NEUTRAL_FALLBACK

    if not news_items: return _NEUTRAL_FALLBACK

    headlines_to_score = []
    articles_meta = []
    for item in news_items[:10]:
        content = item.get('content', item)
        title = content.get('title', '').strip()
        summary = content.get('summary', '').strip()
        if not title: continue
        combined_text = f"{title}. {summary}" if summary else title
        headlines_to_score.append(combined_text)
        pub_time = datetime.fromtimestamp(content.get('providerPublishTime', time.time())).isoformat()
        articles_meta.append({
            "title": title, "published": pub_time,
            "url": content.get('url') or content.get('link') or ""
        })

    individual_scores, agg_score = score_headlines(headlines_to_score)
    for i, meta in enumerate(articles_meta):
        meta["score"] = individual_scores[i]["score"] if i < len(individual_scores) else 0.0
    label, emoji = sentiment_label(agg_score)

    result_payload = {
        "ticker": ticker, "aggregate_score": round(agg_score, 4),
        "label": label, "emoji": emoji, "article_count": len(articles_meta),
        "articles": articles_meta, "cached": False
    }

    if redis_client:
        try:
            redis_client.setex(cache_key, CACHE_TTL, json.dumps(result_payload))
        except: pass
    return result_payload

def get_market_sentiment(ticker: str) -> Tuple[float, List[Dict[str, Any]]]:
    try:
        result = fetch_and_score_ticker(ticker)
        legacy_articles = [{
            "title": art.get("title", ""), "link": art.get("url", ""),
            "publisher": "Yahoo Finance", "score": art.get("score", 0.0)
        } for art in result.get("articles", [])]
        return result.get("aggregate_score", 0.0), legacy_articles
    except:
        return 0.0, []

def get_sentiment(ticker: str):
    score, articles = get_market_sentiment(ticker)
    return score, articles
