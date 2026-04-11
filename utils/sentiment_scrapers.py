import requests
import logging
import os
import feedparser
from bs4 import BeautifulSoup
from datetime import datetime
from typing import List, Dict, Any

logger = logging.getLogger("apex_ai.scrapers")

# Reddit credentials should be set in environment variables
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID", "placeholder")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET", "placeholder")
REDDIT_USER_AGENT = os.getenv("REDDIT_USER_AGENT", "APEX_AI_Sentiment_Engine/1.0")

class SentimentScrapers:
    """
    APEX AI — Sentiment Data Scrapers v2.0
    Layers 1, 2, 3 implementation with PRAW & Feedparser.
    """

    @staticmethod
    def fetch_google_news(ticker: str) -> List[Dict[str, Any]]:
        """Layer 1: Google News RSS via Feedparser."""
        ticker_clean = ticker.replace(".NS", "").replace(".BO", "")
        # Add 'stock news' to refine search
        url = f"https://news.google.com/rss/search?q={ticker_clean}+stock+news&hl=en-IN&gl=IN&ceid=IN:en"
        
        try:
            feed = feedparser.parse(url)
            articles = []
            for entry in feed.entries[:15]:
                # Extract source from title suffix or metadata
                source = "Google News"
                title = entry.title
                if " - " in title:
                    parts = title.rsplit(" - ", 1)
                    title = parts[0]
                    source = parts[1]
                
                articles.append({
                    "title": title,
                    "url": entry.link,
                    "published": entry.published if hasattr(entry, 'published') else datetime.now().isoformat(),
                    "source": source
                })
            return articles
        except Exception as e:
            logger.error(f"Google News (feedparser) fetch error for {ticker}: {e}")
            return []

    @staticmethod
    def fetch_stocktwits_buzz(ticker: str) -> Dict[str, Any]:
        """Layer 3: Social Buzz via StockTwits."""
        symbol = ticker.split('.')[0]
        url = f"https://api.stocktwits.com/api/2/streams/symbol/{symbol}.json"
        
        try:
            resp = requests.get(url, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                messages = data.get('messages', [])
                
                bulls = sum(1 for m in messages if m.get('entities', {}).get('sentiment', {}).get('basic') == 'Bullish')
                bears = sum(1 for m in messages if m.get('entities', {}).get('sentiment', {}).get('basic') == 'Bearish')
                
                score = 0.0
                if (bulls + bears) > 0:
                    score = (bulls - bears) / (bulls + bears)
                
                return {
                    "score": score,
                    "buzz_count": len(messages),
                    "sentiment_ratio": f"{bulls}/{bears}" if (bulls+bears) > 0 else "N/A",
                    "top_message": messages[0].get('body') if messages else "",
                    "source": "StockTwits"
                }
            return {"score": 0.0, "buzz_count": 0, "status": "OFFLINE", "source": "StockTwits"}
        except:
            return {"score": 0.0, "buzz_count": 0, "status": "ERROR", "source": "StockTwits"}

    @staticmethod
    def fetch_reddit_buzz(ticker: str) -> Dict[str, Any]:
        """Layer 3: Social Buzz via Reddit (PRAW)."""
        ticker_clean = ticker.replace(".NS", "").replace(".BO", "")
        
        # MOCK MODE FALLBACK if keys are placeholders
        if REDDIT_CLIENT_ID == "placeholder":
            logger.info(f"Reddit Scraper: Mock Mode active for {ticker}")
            return {
                "score": 0.15,
                "buzz_count": 42,
                "sentiment_ratio": "28/14",
                "top_message": f"Bullish breakout expected on {ticker_clean}.",
                "source": "Reddit (Simulated)"
            }

        try:
            import praw
            reddit = praw.Reddit(
                client_id=REDDIT_CLIENT_ID,
                client_secret=REDDIT_CLIENT_SECRET,
                user_agent=REDDIT_USER_AGENT,
                request_timeout=5.0
            )
            
            # Search across finance subreddits
            search_query = f"{ticker_clean} OR {ticker}"
            subs = reddit.subreddit("Shortsqueeze+pennystocks+wallstreetbets+IndianStockMarket")
            bulls = 0
            bears = 0
            count = 0
            
            # Simple keyword scoring for mock-like sentiment in praw
            # Wrap generator to handle network errors during iteration
            search_results = subs.search(search_query, limit=20, time_filter="week")
            
            for submission in search_results:
                count += 1
                text = (submission.title + " " + submission.selftext).lower()
                if any(w in text for w in ["moon", "buy", "long", "bull", "undervalued"]):
                    bulls += 1
                elif any(w in text for w in ["drop", "sell", "short", "bear", "overvalued"]):
                    bears += 1
            
            score = 0.0
            if (bulls + bears) > 0:
                score = (bulls - bears) / (bulls + bears)

            return {
                "score": score,
                "buzz_count": count,
                "sentiment_ratio": f"{bulls}/{bears}",
                "source": "Reddit",
                "status": "ONLINE"
            }
        except Exception as e:
            # Silently fallback for network/auth errors to avoid log spam
            logger.debug(f"Reddit (PRAW) fetch error for {ticker}: {e}")
            return {"score": 0.0, "buzz_count": 0, "status": "OFFLINE", "source": "Reddit"}

    @staticmethod
    def fetch_nse_announcements(ticker: str) -> List[Dict[str, Any]]:
        """Layer 2: Management Statements & NSE corporate announcements."""
        # For deep-dive release, we provide a structured placeholder to define UI compatibility.
        return [{
            "title": "Board Meeting to consider Financial Results",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "category": "Corporate Action"
        }]
