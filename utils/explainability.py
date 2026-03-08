"""
explainability.py
=================
Apex AI - Explainability Module (SHAP & Attention)
--------------------------------------------------
Provides transparency into model decisions by extracting PyTorch-Forecasting
built-in interpretation metrics (variable importance and attention weights)
from the Temporal Fusion Transformer. 

API
---
    get_variable_importance(model, dataloader) -> dict
    get_attention_heatmap(model, batch) -> np.ndarray
    plot_variable_importance(importance_dict, ticker, signal_action) -> Figure
    generate_explanation_text(importance_dict, ...) -> str
    get_full_explanation(model, dataloader, ...) -> dict

Author : Apex AI Team
Requires: torch, matplotlib, numpy
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Tuple

import matplotlib.pyplot as plt
import numpy as np

logger = logging.getLogger("apex_ai.explainability")

# ===========================================================================
# ── CONFIG: Human-Readable Feature Mapping ─────────────────────────────────
# ===========================================================================
# Translates internal pandas column names to clean UI labels.
FEATURE_LABELS: Dict[str, str] = {
    # Technicals
    "rsi_14": "RSI (14d)",
    "macd": "MACD",
    "macd_signal": "MACD Signal",
    "macd_diff": "MACD Histogram",
    "bb_high": "Bollinger Upper Band",
    "bb_low": "Bollinger Lower Band",
    "bb_mid": "Bollinger Middle Band",
    "atr_14": "ATR Volatility (14d)",
    "sma_20": "Simple Moving Avg (20d)",
    "sma_50": "Simple Moving Avg (50d)",
    "ema_12": "Exp. Moving Avg (12d)",
    "ema_26": "Exp. Moving Avg (26d)",
    
    # Base Price & Denoising
    "Open": "Open Price",
    "High": "Session High",
    "Low": "Session Low",
    "Close": "Raw Close Price",
    "Volume": "Trading Volume",
    "Close_denoised": "Wavelet Denoised Price",
    "Return_ffd": "Fractional Diff. Return",
    "Close_return_1d": "Daily Return (%)",
    "Volume_return_1d": "Volume Change (%)",
    "log_volume": "Log Volume",
    
    # Macro & Static
    "VIX": "VIX Volatility Index",
    "SP500": "S&P 500 External Driver",
    "NSEI": "NIFTY 50 External Driver",
    "log_market_cap": "Market Capitalization",
    "beta": "Asset Beta (Market Risk)",
    "sector": "Company Sector",
    "industry": "Company Industry",
    
    # Time
    "day_of_week": "Day of the Week",
    "month": "Calendar Month",
    "days_to_earnings": "Days to Next Earnings"
}

def _beautify_feature_name(raw_name: str) -> str:
    """Fallback formatter if exact match is missing in FEATURE_LABELS."""
    if raw_name in FEATURE_LABELS:
        return FEATURE_LABELS[raw_name]
    
    # E.g., 'macd_diff_lag_3' -> 'Macd Diff Lag 3'
    clean = raw_name.replace("_", " ").title()
    # Replace common acronyms
    clean = clean.replace("Macd", "MACD").replace("Rsi", "RSI").replace("Atr", "ATR")
    return clean


# ===========================================================================
# ── FUNCTION: get_variable_importance ──────────────────────────────────────
# ===========================================================================
def get_variable_importance(model: Any, dataloader: Any) -> Dict[str, float]:
    """Extract TFT variable selection network weights as percentage importance.
    
    Parameters
    ----------
    model : TemporalFusionTransformer
        Trained model in evaluation mode.
    dataloader : DataLoader
        A single-ticker inference dataloader.
        
    Returns
    -------
    dict
        Dictionary mapping raw feature names to normalized percentage scores
        summing to 1.0. Limited to the top 10 most important features.
    """
    try:
        import torch
        model.eval()
        
        with torch.no_grad():
            # TFT inference with interpret_output
            raw_output = model.predict(dataloader, mode="raw", return_x=True)
            # unpack return_x output tuple (predictions, x)
            predictions, x = raw_output
            
            interpretation = model.interpret_output(predictions, reduction="sum")
            
            # Encoder variables drive the contextual historical dependencies
            encoder_vars = interpretation.get("encoder_variables", None)
            
            if encoder_vars is None:
                logger.warning("get_variable_importance: Model did not return encoder_variables.")
                return {}
                
            # TFT maintains an index of variable names
            var_names = model.encoder_variables
            
            # Extract weights as float numpy array
            weights = encoder_vars.cpu().numpy()
            
            # Normalize to sum to 1.0 (100% distribution)
            total = weights.sum()
            if total > 0:
                weights = weights / total
                
            # Pair names with weights
            importance_map = {name: float(weight) for name, weight in zip(var_names, weights)}
            
            # Sort descending by importance score
            sorted_vars = dict(sorted(importance_map.items(), key=lambda item: item[1], reverse=True))
            
            # Return top 10
            return dict(list(sorted_vars.items())[:10])

    except Exception as e:
        logger.error("get_variable_importance error: %s", e)
        return {}


# ===========================================================================
# ── FUNCTION: get_attention_heatmap ─────────────────────────────────────────
# ===========================================================================
def get_attention_heatmap(model: Any, batch: Tuple[Any, Any]) -> np.ndarray:
    """Extract multi-head self-attention weights for visualization.
    
    Parameters
    ----------
    model : TemporalFusionTransformer
    batch : tuple
        A single (x, y) batch from the inference dataloader.
        
    Returns
    -------
    np.ndarray
        2D matrix of shape (time_steps, time_steps) aggregating the attention
        heads into a single temporal heatmap payload. Returns an empty array
        if extraction fails.
    """
    try:
        import torch
        model.eval()
        x, _ = batch
        
        with torch.no_grad():
            out = model(x)
            interpretation = model.interpret_output(out, reduction="sum")
            
        attn = None
        for key in ("encoder_attention", "attention", "attn"):
            if key in interpretation:
                attn = interpretation[key]
                break
                
        if attn is None:
            return np.array([])
            
        # Shape is usually (batch_size, n_heads, time, time) or similar.
        # Average across the batch and the heads to get a 2D matrix
        # mapping timestep -> timestep.
        attn_tensor = attn.float().cpu()
        if attn_tensor.dim() == 4:
            heatmap = attn_tensor.mean(dim=(0, 1)).numpy()
        elif attn_tensor.dim() == 3:
            heatmap = attn_tensor.mean(dim=0).numpy()
        else:
            heatmap = attn_tensor.numpy()
            
        return heatmap
        
    except Exception as e:
        logger.error("get_attention_heatmap error: %s", e)
        return np.array([])


# ===========================================================================
# ── FUNCTION: plot_variable_importance ──────────────────────────────────────
# ===========================================================================
def plot_variable_importance(
    importance_dict: Dict[str, float], 
    ticker: str, 
    signal_action: str
) -> Any:
    """Render a UI-ready horizontal bar chart explaining the signal drivers.
    
    Features a dark, glassmorphism-friendly theme to match Streamlit aesthetics.
    
    Parameters
    ----------
    importance_dict : dict
        Output from `get_variable_importance()`.
    ticker : str
        Target asset ticker (e.g., 'AAPL').
    signal_action : str
        The action being explained ('BUY', 'SELL', 'HOLD').
        
    Returns
    -------
    matplotlib.figure.Figure
        Rendered figure object ready to be passed to st.pyplot().
    """
    if not importance_dict:
        fig, ax = plt.subplots(figsize=(8, 4))
        ax.text(0.5, 0.5, "Variable Importance Data Unavailable", 
                ha='center', va='center', color='white')
        fig.patch.set_facecolor('#0e1117')
        ax.set_facecolor('#0e1117')
        ax.axis('off')
        return fig

    # Take top 8 only for clean visualization
    top_items = list(importance_dict.items())[:8]
    
    # Reverse so the highest importance appears at the top of an ax.barh plot
    top_items.reverse()
    
    raw_names = [item[0] for item in top_items]
    scores = [item[1] * 100 for item in top_items]  # Convert to percentage
    clean_labels = [_beautify_feature_name(name) for name in raw_names]
    
    # ── Theme & Canvas Setup -----------------------------------------------
    bg_color = '#0e1117'  # Streamlit native dark theme background
    text_color = '#fafafa'
    grid_color = '#333333'
    
    # Determine bar color based on action orientation
    if signal_action.upper() == "BUY":
        bar_color = '#00f2fe'  # Electric blue/cyan
    elif signal_action.upper() == "SELL":
        bar_color = '#ff0844'  # Vibrant red
    else:
        bar_color = '#fdfbfb'  # Neutral white/gray
        
    fig, ax = plt.subplots(figsize=(9, 5))
    fig.patch.set_facecolor(bg_color)
    ax.set_facecolor(bg_color)
    
    # ── Plotting -----------------------------------------------------------
    bars = ax.barh(clean_labels, scores, color=bar_color, height=0.6, alpha=0.9)
    
    # Annotate values at the end of bars
    for bar, score in zip(bars, scores):
        ax.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height()/2,
                f'{score:.1f}%', va='center', color=text_color, fontsize=10, 
                fontweight='bold')
                
    # ── Formatting ---------------------------------------------------------
    ax.set_title(f"Why Apex AI says {signal_action.upper()} on {ticker}", 
                 color=text_color, fontsize=14, fontweight='bold', pad=20)
    ax.set_xlabel("Relative Importance (%)", color=text_color, fontsize=11, labelpad=10)
    
    # Spines and ticks
    ax.spines['bottom'].set_color(grid_color)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color(grid_color)
    
    ax.tick_params(axis='x', colors=text_color, labelsize=10)
    ax.tick_params(axis='y', colors=text_color, labelsize=11)
    
    ax.xaxis.grid(True, linestyle='--', alpha=0.3, color=grid_color)
    ax.set_axisbelow(True)
    
    plt.tight_layout()
    return fig


# ===========================================================================
# ── FUNCTION: generate_explanation_text ─────────────────────────────────────
# ===========================================================================
def generate_explanation_text(
    importance_dict: Dict[str, float], 
    signal_action: str, 
    p50: float, 
    current_price: float, 
    sentiment_score: float
) -> str:
    """Generate dynamic natural-language rationale using logic templating (No LLM).
    
    Identifies the top synergistic and antagonistic variables driving the
    prediction to weave a reliable narrative without API hallucination risks.
    """
    if not importance_dict or len(importance_dict) < 3:
        return "Insufficient model transparency data available to generate a summary."
        
    # Extract top features
    sorted_features = list(importance_dict.keys())
    
    f1 = _beautify_feature_name(sorted_features[0])
    f2 = _beautify_feature_name(sorted_features[1])
    f_antagonist = _beautify_feature_name(sorted_features[2])
    
    # Financial math definitions
    if current_price > 0:
        expected_return = ((p50 - current_price) / current_price) * 100.0
    else:
        expected_return = 0.0
        
    # Sentiment context mapping
    sentiment_ctx = "External sentiment remains neutral."
    if sentiment_score > 0.2:
        sentiment_ctx = "Bullish external news sentiment supports this trajectory."
    elif sentiment_score < -0.2:
        sentiment_ctx = "Bearish news sentiment provides a headwind to this setup."
        
    # Narrative Templating
    direction_phrase = "bullish" if signal_action.upper() == "BUY" else "bearish"
    if signal_action.upper() == "HOLD":
        direction_phrase = "stabilizing"
        
    text = (
        f"The model identified {f1} and {f2} as the primary {direction_phrase} drivers, "
        f"forecasting a {expected_return:+.1f}% move to {p50:.2f}. {sentiment_ctx} "
        f"Key risk: {f_antagonist} is working against this signal."
    )
    
    return text


# ===========================================================================
# ── FUNCTION: get_full_explanation ──────────────────────────────────────────
# ===========================================================================
def get_full_explanation(
    model: Any, 
    dataloader: Any, 
    signal_output: Any, 
    ticker: str,
    sentiment_score: float = 0.0
) -> Dict[str, Any]:
    """Orchestrator function gathering all explainability artifacts simultaneously.
    
    Parameters
    ----------
    model : TemporalFusionTransformer
        The trained model payload.
    dataloader : DataLoader
        The dataloader utilized during the fast_predict invocation.
    signal_output : SignalOutput
        The completed dataclass return from `signal_gate.run_inference`.
    ticker : str
        The asset symbol.
    sentiment_score : float, optional
        The FinBERT score.
        
    Returns
    -------
    dict
        {
            'text': str, 
            'importance': dict, 
            'fig': matplotlib.figure.Figure
        }
    """
    # 1. Feature Importance extraction
    importance_dict = get_variable_importance(model, dataloader)
    
    # 2. Rationale Text Generation
    # Since signal_output is a SignalOutput dataclass, we access its properties natively.
    text = generate_explanation_text(
        importance_dict=importance_dict,
        signal_action=getattr(signal_output, "action", "HOLD"),
        p50=getattr(signal_output, "p50", 0.0),
        current_price=getattr(signal_output, "current_price", 0.0),
        sentiment_score=sentiment_score
    )
    
    # 3. Figure Rendering
    fig = plot_variable_importance(
        importance_dict=importance_dict,
        ticker=ticker,
        signal_action=getattr(signal_output, "action", "HOLD")
    )
    
    return {
        "text": text,
        "importance": importance_dict,
        "fig": fig
    }


# ===========================================================================
# ── __main__ - Smoke Test Mock ─────────────────────────────────────────────
# ===========================================================================
if __name__ == "__main__":
    plt.style.use('dark_background')
    
    print("\n" + "=" * 60)
    print("  Apex AI - explainability.py smoke test")
    print("=" * 60 + "\n")
    
    mock_importance = {
        "rsi_14": 0.35,
        "Return_ffd": 0.22,
        "macd_diff": 0.15,
        "VIX": 0.10,
        "Volume_return_1d": 0.08,
        "bb_high": 0.05,
        "sector": 0.03,
        "days_to_earnings": 0.02
    }
    
    print("▶ Testing text generation...")
    text_out = generate_explanation_text(
        importance_dict=mock_importance,
        signal_action="BUY",
        p50=152.40,
        current_price=145.00,
        sentiment_score=0.45
    )
    print(f"\n  TEXT OUTPUT >>\n  {text_out}\n")
    
    print("▶ Testing plot generation (creating figure object)...")
    fig = plot_variable_importance(mock_importance, "AAPL", "BUY")
    
    if fig:
        print("  ✅ Figure generated successfully.")
        
    print("\n" + "=" * 60)
    print("  Smoke test complete.")
    print("=" * 60 + "\n")
