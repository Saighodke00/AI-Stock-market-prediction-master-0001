"""
reasoning.py
============
Apex AI — Plain English Signal Reasoning
-----------------------------------------
Generates natural-language explanations for trading signals using SHAP 
feature importances, sentiment scores, and market context. 
Supports Anthropic (Claude), OpenAI (GPT-4o), and a robust local fallback.

API
---
    get_explanation(...) -> str
    build_prompt(...) -> str
    generate_with_llm(...) -> str
    generate_template_fallback(...) -> str

Author : Apex AI Team
Requires: anthropic, openai (optional), redis
"""

import os
import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import redis

from rich.logging import RichHandler

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(rich_tracebacks=True, show_path=False)]
)
logger = logging.getLogger("apex_ai.reasoning")

# Redis cache TTL: 30 minutes
CACHE_TTL_REASONING = 30 * 60

# ---------------------------------------------------------------------------
# LLM Provider Setup
# ---------------------------------------------------------------------------
def _get_llm_client(provider: str) -> Any:
    """Lazy initialize the requested LLM client."""
    if provider == 'anthropic':
        try:
            from anthropic import Anthropic
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if not api_key:
                logger.debug("ANTHROPIC_API_KEY not found in environment. LLM reasoning disabled.")
                return None
            return Anthropic(api_key=api_key)
        except ImportError:
            logger.warning("anthropic library not installed.")
            return None
    elif provider == 'openai':
        try:
            from openai import OpenAI
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                logger.debug("OPENAI_API_KEY not found in environment. LLM reasoning disabled.")
                return None
            return OpenAI(api_key=api_key)
        except ImportError:
            logger.warning("openai library not installed.")
            return None
    elif provider == 'ollama':
        try:
            # We use requests for the direct Ollama API (no special library needed)
            import requests
            base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            try:
                # Ping Ollama to ensure it's up
                requests.get(f"{base_url}/api/tags", timeout=2)
                return "ollama_active"
            except:
                logger.debug("Ollama service not found at " + base_url)
                return None
        except ImportError:
            return None
    return None

def _get_redis() -> Optional[redis.Redis]:
    """Graceful Redis initialization."""
    try:
        client = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)
        client.ping()
        return client
    except Exception:
        return None

# ===========================================================================
# ── FUNCTION: build_prompt ─────────────────────────────────────────────────
# ===========================================================================
def build_prompt(
    signal_output: Any, 
    top_features: Dict[str, float], 
    sentiment_score: float, 
    ticker: str, 
    market_regime: str
) -> str:
    """Construct the LLM prompt for the trading signal explanation."""
    
    # Extract data from SignalOutput (handling both dataclass and dict)
    action = getattr(signal_output, 'action', getattr(signal_output, 'action', 'HOLD') if not isinstance(signal_output, dict) else signal_output.get('action', 'HOLD'))
    confidence = getattr(signal_output, 'confidence', getattr(signal_output, 'confidence', 0.5) if not isinstance(signal_output, dict) else signal_output.get('confidence', 0.5))
    expected_return = getattr(signal_output, 'expected_return_pct', getattr(signal_output, 'expected_return_pct', 0.0) if not isinstance(signal_output, dict) else signal_output.get('expected_return_pct', 0.0))
    current_price = getattr(signal_output, 'current_price', getattr(signal_output, 'current_price', 0.0) if not isinstance(signal_output, dict) else signal_output.get('current_price', 0.0))
    p50 = getattr(signal_output, 'p50', getattr(signal_output, 'p50', 0.0) if not isinstance(signal_output, dict) else signal_output.get('p50', 0.0))
    
    sentiment_label = "BULLISH" if sentiment_score > 0.2 else ("BEARISH" if sentiment_score < -0.2 else "NEUTRAL")
    
    # Sort features by importance
    sorted_feats = sorted(top_features.items(), key=lambda x: x[1], reverse=True)
    
    # Bullish vs Bearish splitting for the prompt
    bullish_feats = []
    bearish_feats = []
    
    # For the prompt, we'll take top 3 as general drivers
    f1_name, f1_val = sorted_feats[0] if len(sorted_feats) > 0 else ("N/A", 0.0)
    f2_name, f2_val = sorted_feats[1] if len(sorted_feats) > 1 else ("N/A", 0.0)
    
    # Identify the most negative/bearish feature (the last one if it's small/negative)
    neg_feat_name, neg_feat_val = sorted_feats[-1] if len(sorted_feats) > 2 else ("N/A", 0.0)

    prompt = f"""You are a concise financial analyst assistant for Apex AI. Generate a 3-sentence explanation for this trading signal.

Signal: {action} {ticker} | Confidence: {confidence:.0%} | Expected return: {expected_return:+.1f}%
Price: ${current_price:.2f} → Forecast: ${p50:.2f} (14-day)

Top bullish drivers: {f1_name} ({f1_val:.0%}), {f2_name} ({f2_val:.0%})
Bearish concern: {neg_feat_name} ({neg_feat_val:.0%})
Sentiment: {sentiment_label} ({sentiment_score:+.2f})
Market regime: {market_regime}

Write in second person ('The model sees...'). Be specific with numbers. End with one sentence on the key risk. Keep total under 80 words."""
    
    return prompt

# ===========================================================================
# ── FUNCTION: generate_with_llm ─────────────────────────────────────────────
# ===========================================================================
def generate_with_llm(prompt: str, provider: Optional[str] = None) -> str:
    """Interface with Anthropic or OpenAI to generate the explanation."""
    
    # Determine provider from env if not specified
    if not provider:
        provider = os.getenv("LLM_PROVIDER", "anthropic").lower()
        
    client = _get_llm_client(provider)
    if not client:
        logger.info(f"LLM Provider '{provider}' not available. Failing over to template-based reasoning.")
        return ""

    try:
        t0 = time.time()
        if provider == 'anthropic':
            response = client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=150,
                messages=[{"role": "user", "content": prompt}]
            )
            text = response.content[0].text
            # Log est. cost (Haiku: $0.25 / 1M input, $1.25 / 1M output)
            cost = (len(prompt) / 4000 * 0.001) + (len(text) / 4000 * 0.005)
        elif provider == 'openai':
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=150,
                messages=[{"role": "user", "content": prompt}]
            )
            text = response.choices[0].message.content
            # Log est. cost (GPT-4o-mini: $0.15 / 1M input, $0.60 / 1M output)
            cost = (len(prompt) / 4000 * 0.0006) + (len(text) / 4000 * 0.0024)
        elif provider == 'ollama':
            import requests
            base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            model = os.getenv("OLLAMA_MODEL", "llama3.2:1b")
            response = requests.post(f"{base_url}/api/generate", json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {"num_ctx": 1024, "temperature": 0.7}
            }, timeout=30)
            response.raise_for_status()
            text = response.json().get("response", "")
            cost = 0.0 # Local usage
        
        latency = time.time() - t0
        logger.info(f"LLM Generation successful ({provider}). Latency: {latency:.2f}s | Est. Cost: ${cost:.6f}")
        return text.strip()

    except Exception as e:
        logger.error(f"LLM Generation failed ({provider}): {e}")
        return ""

# ===========================================================================
# ── FUNCTION: generate_template_fallback ───────────────────────────────────
# ===========================================================================
def generate_template_fallback(
    signal_output: Any, 
    top_features: Dict[str, float], 
    sentiment_label: str
) -> str:
    """Pure Python fallback for signal explanation."""
    
    action = getattr(signal_output, 'action', getattr(signal_output, 'action', 'HOLD') if not isinstance(signal_output, dict) else signal_output.get('action', 'HOLD'))
    expected_return = getattr(signal_output, 'expected_return_pct', getattr(signal_output, 'expected_return_pct', 0.0) if not isinstance(signal_output, dict) else signal_output.get('expected_return_pct', 0.0))
    
    sorted_feats = sorted(top_features.items(), key=lambda x: x[1], reverse=True)
    f1 = sorted_feats[0][0] if len(sorted_feats) > 0 else "technical indicators"
    f2 = sorted_feats[1][0] if len(sorted_feats) > 1 else "momentum"
    f_neg = sorted_feats[-1][0] if len(sorted_feats) > 2 else "volatility"
    
    direction = "bullish" if action == "BUY" else ("bearish" if action == "SELL" else "stabilizing")
    
    # Check if sentiment reinforces or contradicts
    if (action == "BUY" and sentiment_label == "BULLISH") or (action == "SELL" and sentiment_label == "BEARISH"):
        sentiment_context = "reinforcing"
    else:
        sentiment_context = "contradicting"
        
    explanation = (
        f"The model identified {f1} and {f2} as the primary {direction} indicators, "
        f"projecting a {expected_return:+.1f}% move over 14 days. "
        f"Sentiment is {sentiment_label}, {sentiment_context} the technical signal. "
        f"Key risk: {f_neg} adds uncertainty — consider reducing position size."
    )
    
    return explanation

# ===========================================================================
# ── FUNCTION: get_explanation ──────────────────────────────────────────────
# ===========================================================================
def get_explanation(
    signal_output: Any, 
    top_features: Dict[str, float], 
    sentiment_score: float, 
    ticker: str, 
    market_regime: str = 'Unknown', 
    use_llm: bool = True
) -> str:
    """Primary entry point for getting a signal explanation with caching."""
    
    # ── 1. Check Cache ───────────────────────────────────────────────────
    cache_key = f"apex:reasoning:{ticker}:{market_regime}"
    redis_client = _get_redis()
    
    if redis_client:
        cached = redis_client.get(cache_key)
        if cached:
            return cached

    # ── 2. Attempt LLM ───────────────────────────────────────────────────
    sentiment_label = "BULLISH" if sentiment_score > 0.2 else ("BEARISH" if sentiment_score < -0.2 else "NEUTRAL")
    text = ""
    
    if use_llm:
        prompt = build_prompt(signal_output, top_features, sentiment_score, ticker, market_regime)
        text = generate_with_llm(prompt)
        
    # ── 3. Fallback ──────────────────────────────────────────────────────
    if not text:
        logger.info("Using template-based fallback for explanation.")
        text = generate_template_fallback(signal_output, top_features, sentiment_label)
        
    # ── 4. Cache Result ──────────────────────────────────────────────────
    if redis_client and text:
        try:
            redis_client.setex(cache_key, CACHE_TTL_REASONING, text)
        except Exception:
            pass
            
    return text

# ===========================================================================
# ── UNIT TEST ──────────────────────────────────────────────────────────────
# ===========================================================================
if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  Apex AI — reasoning.py unit test")
    print("=" * 60 + "\n")

    # Mock Data
    mock_signal = {
        "action": "BUY",
        "confidence": 0.85,
        "expected_return_pct": 5.2,
        "current_price": 190.0,
        "p50": 199.88
    }
    
    mock_features = {
        "rsi_14": 0.40,
        "macd_diff": 0.25,
        "VIX": 0.10,
        "ATR": 0.05
    }
    
    # Test Fallback
    print(">> Testing generate_template_fallback...")
    fallback_text = generate_template_fallback(mock_signal, mock_features, "BULLISH")
    print(f"  Result: {fallback_text}\n")
    
    assert "rsi_14" in fallback_text
    assert "5.2%" in fallback_text
    assert "BULLISH" in fallback_text
    print("  OK: Fallback template test PASSED.")

    # Test Prompt Construction
    print("\n>> Testing build_prompt...")
    prompt = build_prompt(mock_signal, mock_features, 0.45, "AAPL", "Bull")
    print(f"  Prompt Preview (first 100 chars): {prompt[:100]}...")
    assert "BUY AAPL" in prompt
    assert "85%" in prompt
    print("  OK: Prompt construction test PASSED.")

    print("\n" + "=" * 60)
    print("  Unit tests complete.")
    print("=" * 60 + "\n")
