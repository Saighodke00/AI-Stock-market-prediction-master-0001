from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import logging
import random

# Note: Weights should add up to 1.0 ideally
# News: Primary sentiment driver
# Social: Consensus and buzz
# Deals: Institutional institutional buy-in
WEIGHTS = {
    "NEWS": 0.50,
    "SOCIAL": 0.25,
    "DEALS": 0.25
}

class SentimentAggregator:
    WEIGHTS = WEIGHTS

    @staticmethod
    def get_label(score: float):
        if score >= 0.25: return "BULLISH", "🟢"
        if score <= -0.25: return "BEARISH", "🔴"
        return "NEUTRAL", "🟡"

    @staticmethod
    def get_matrix_v3(ticker: str) -> Dict[str, Any]:
        """
        APEX AI — Sentiment Matrix Intelligence v3.1
        Aggregates news, corporate statements, social sentiment, and bulk deals.
        """
        from utils.sentiment import get_sentiment, score_headlines
        from utils.sebi_bulk_deals import get_deal_summary
        from utils.sentiment_scrapers import SentimentScrapers

        # Layer 1: Global News (Yahoo + Google)
        primary_score, primary_articles = get_sentiment(ticker)
        rss_articles = SentimentScrapers.fetch_google_news(ticker)
        
        # If primary news yielded 0 score or empty articles, try to score the RSS articles
        final_news_score = primary_score
        scored_rss_articles = []
        
        if rss_articles:
            # Add placeholders for scoring
            headlines = [a['title'] for a in rss_articles]
            individual_scores, rss_agg_score = score_headlines(headlines)
            
            for i, art in enumerate(rss_articles):
                art['score'] = individual_scores[i]['score'] if i < len(individual_scores) else 0.0
                scored_rss_articles.append(art)
            
            # If primary was empty, RSS score becomes the news score
            if not primary_articles or primary_score == 0:
                final_news_score = rss_agg_score

        # Layer 2: Corporate Statements
        statements = SentimentScrapers.fetch_nse_announcements(ticker)

        # Layer 3: Social Buzz
        st_data = SentimentScrapers.fetch_stocktwits_buzz(ticker)
        rd_data = SentimentScrapers.fetch_reddit_buzz(ticker)
        
        social_score = (st_data["score"] + rd_data["score"]) / 2
        social_buzz  = st_data["buzz_count"] + rd_data["buzz_count"]

        # Layer 5: Institutional High-Volume Alpha
        bulk_data = get_deal_summary(ticker)
        bulk_score = 0.0
        if bulk_data["net_signal"] == "BULLISH": bulk_score = 0.8
        elif bulk_data["net_signal"] == "BEARISH": bulk_score = -0.8
        elif bulk_data["net_signal"] == "MIXED": bulk_score = 0.1

        # AGGREGATE CALCULATION
        agg_score = (
            (final_news_score * SentimentAggregator.WEIGHTS["NEWS"]) +
            (social_score * SentimentAggregator.WEIGHTS["SOCIAL"]) +
            (bulk_score * SentimentAggregator.WEIGHTS["DEALS"])
        )
        
        # Confidence logic based on data availability
        confidence = 0.5
        if (len(primary_articles) + len(scored_rss_articles)) > 5: confidence += 0.2
        if social_buzz > 50: confidence += 0.15
        if len(bulk_data["deals"]) > 0: confidence += 0.1

        final_label, emoji = SentimentAggregator.get_label(agg_score)

        # ── TICKER METADATA (Neural Context) ──────────────────────────────────
        ticker_meta = {"sector": "Unknown", "industry": "Unknown", "market_cap": 0, "beta": 0}
        try:
            from utils.yf_utils import get_ticker
            stock = get_ticker(ticker)
            info = stock.info
            ticker_meta = {
                "sector": info.get("sector", "Financials"),
                "industry": info.get("industry", "Equity"),
                "market_cap": info.get("marketCap") or stock.fast_info.get("marketCap", 0),
                "beta": round(info.get("beta", 1.0), 2)
            }
        except Exception as e:
            logging.debug(f"Metadata fetch failed for {ticker}: {e}")

        return {
            "ticker": ticker,
            "timestamp": datetime.now().isoformat(),
            "ticker_meta": ticker_meta,
            "aggregate": {
                "score": round(agg_score, 2),
                "label": final_label,
                "emoji": emoji,
                "confidence": round(min(confidence, 0.95), 2)
            },
            "layers": {
                "news": {
                    "score": round(final_news_score, 2),
                    "article_count": len(primary_articles) + len(scored_rss_articles),
                    "items": (primary_articles + scored_rss_articles)[:15]
                },
                "bulk_deals": {
                    "score": bulk_score,
                    "signal": bulk_data["net_signal"],
                    "summary": bulk_data["summary"],
                    "deals": bulk_data["deals"][:10]
                },
                "statements": {
                    "score": 0.0,
                    "items": statements,
                    "status": "STABLE (RSS SYNC)"
                },
                "social": {
                    "score": round(social_score, 2),
                    "buzz": social_buzz,
                    "reddit": rd_data,
                    "stocktwits": st_data,
                    "status": "ACTIVE"
                }
            },
            "summary_ai": f"{final_label} market regime identified for {ticker}. News sentiment is {round(final_news_score, 2)} with {bulk_data['net_signal']} institutional activity."
        }

    @staticmethod
    def get_history(ticker: str, days: int = 7) -> List[Dict[str, Any]]:
        """
        Component 3: Simulates/Fetches historical sentiment pulse.
        In a production environment, this pulls from Redis TimeSeries or a DB.
        """
        history = []
        base_score = 0.1 # Neutral-bullish baseline
        
        for i in range(days):
            date = (datetime.now() - timedelta(days=days-i-1)).strftime("%Y-%m-%d")
            # Random walk sentiment simulation
            base_score += random.uniform(-0.15, 0.15)
            base_score = max(-0.9, min(0.9, base_score))
            history.append({
                "date": date,
                "score": round(base_score, 2)
            })
            
        return history
