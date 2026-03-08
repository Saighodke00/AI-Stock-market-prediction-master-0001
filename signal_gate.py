"""
signal_gate.py
==============
Apex AI — Signal Gatekeeper Engine
------------------------------------
After the TFT model produces quantile forecasts, this module decides whether
to emit a BUY, SELL, or HOLD signal.  No signal reaches users unless it
passes **all three confidence gates**:

    Gate 1 — Attention score (model self-confidence)  ≥ min_confidence
    Gate 2 — Cone width (forecast uncertainty)        ≤ max_cone_width
    Gate 3 — Sentiment agreement (news/social score)  within [min_sentiment, max_sentiment]
                 (skipped for HOLD direction)

API
---
    extract_attention_score(model, batch)           → float
    calculate_cone_width(p10, p50, p90)             → float
    gate_signal(prediction_dict, ...)               → SignalOutput
    run_inference(ticker, model, training_dataset)  → SignalOutput

Author : Apex AI Team
Requires: pytorch-forecasting, torch, pandas, numpy, yfinance
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
from rich.logging import RichHandler

logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(rich_tracebacks=True, show_path=False)]
)
logger = logging.getLogger("apex_ai.signal_gate")

# ===========================================================================
# ── TUNABLE CONFIG — change thresholds here, not inside functions ───────────
# ===========================================================================
CONFIG: Dict[str, Any] = {
    # Gate 1: minimum TFT attention score (0-1) to allow a signal through
    "min_confidence": 0.65,

    # Gate 2: maximum relative forecast cone width = (p90-p10)/p50
    # 0.15 ≈ 15% spread — tighter spreads are more actionable
    "max_cone_width": 0.15,

    # Gate 3: sentiment bounds.  BUY blocked if sentiment < min (bearish).
    # SELL blocked if sentiment > max (bullish).  Range: [-1, +1].
    "min_sentiment": -0.3,
    "max_sentiment":  0.3,

    # Direction thresholds: BUY if p50 > current * (1 + buy_thresh)
    #                       SELL if p50 < current * (1 - sell_thresh)
    "buy_threshold":  0.005,   # 0.5 % upside minimum
    "sell_threshold": 0.005,   # 0.5 % downside minimum

    # Fetch window (trading days) for run_inference
    "inference_lookback_days": 120,
}


# ===========================================================================
# ── DATACLASS: SignalOutput ──────────────────────────────────────────────────
# ===========================================================================
@dataclass
class SignalOutput:
    """Structured output produced by :func:`gate_signal`.

    Attributes
    ----------
    action : str
        ``'BUY'``, ``'SELL'``, or ``'HOLD'``.
    confidence : float
        Normalised attention score (0–1).  Reflects how certain the model
        is about *the input*, not the direction.
    reason : str
        Human-readable explanation of which gate passed or caused a HOLD.
    p10 : float
        10th-percentile 7-day price forecast.
    p50 : float
        Median (50th-percentile) 7-day price forecast.
    p90 : float
        90th-percentile 7-day price forecast.
    current_price : float
        Most recent known price used as the baseline.
    expected_return_pct : float
        ``(p50 - current_price) / current_price * 100``.
    gate_results : dict
        Detailed pass/fail breakdown for every gate (useful for debugging
        and dashboards).
    """

    action: str                              # 'BUY' | 'SELL' | 'HOLD'
    confidence: float                        # 0.0 – 1.0
    reason: str                              # human-readable gate verdict
    p10: float                               # 10th-percentile price forecast
    p50: float                               # median price forecast
    p90: float                               # 90th-percentile price forecast
    current_price: float
    expected_return_pct: float               # (p50 - current) / current * 100
    pattern_summary: str = "None"
    pattern_best: Any = None
    gate_results: Dict[str, Any] = field(default_factory=dict)

    def __repr__(self) -> str:
        return (
            f"SignalOutput(action={self.action!r}, confidence={self.confidence:.3f}, "
            f"expected_return={self.expected_return_pct:+.2f}%, "
            f"p10={self.p10:.2f}, p50={self.p50:.2f}, p90={self.p90:.2f}, "
            f"reason={self.reason!r})"
        )


# ===========================================================================
# ── FUNCTION: extract_attention_score ───────────────────────────────────────
# ===========================================================================
def extract_attention_score(model: Any, batch: Any) -> float:
    """Derive a scalar attention-confidence score from a single TFT batch.

    Uses :meth:`TemporalFusionTransformer.interpret_output` to obtain the
    encoder self-attention weights, then averages across all heads and time
    steps, and finally normalises the result to the [0, 1] range using a
    min-max heuristic.

    Parameters
    ----------
    model : TemporalFusionTransformer
        A trained TFT instance in eval mode.
    batch : tuple
        A single ``(x, y)`` batch from a pytorch-forecasting DataLoader.

    Returns
    -------
    float
        Normalised attention score in [0, 1].  Higher is more confident.

    Notes
    -----
    * The function runs inside ``torch.no_grad()`` for efficiency.
    * If attention weights are unavailable (model variant without attention),
      a neutral score of 0.5 is returned with a warning.
    """
    try:
        import torch

        x, _ = batch
        model.eval()

        with torch.no_grad():
            # forward pass to obtain output object
            out = model(x)

        # interpret_output returns a dict with 'attention' key
        interpretation = model.interpret_output(out, reduction="sum")

        # 'encoder_attention' shape: (batch, heads, time, time)  — or varies
        attn = None
        for key in ("encoder_attention", "attention", "attn"):
            if key in interpretation:
                attn = interpretation[key]
                break

        if attn is None:
            logger.warning(
                "extract_attention_score: no attention key found in interpretation. "
                "Returning neutral score 0.5."
            )
            return 0.5

        # Flatten and take mean across all dimensions
        attn_tensor = attn.float()
        mean_attn = float(attn_tensor.mean().item())

        # Min-max normalisation: typical raw attention values sit in [0, 1/n_heads]
        # We clamp to [0, 1] after scaling by number of heads if detectable.
        n_heads: int = attn_tensor.shape[1] if attn_tensor.dim() >= 2 else 1
        scaled = mean_attn * n_heads          # pull into ~[0, 1] range

        # Robust clamp to strict [0, 1]
        normalised = max(0.0, min(1.0, scaled))
        logger.debug("extract_attention_score: raw=%.6f  n_heads=%d  normalised=%.4f",
                     mean_attn, n_heads, normalised)
        return normalised

    except Exception as exc:
        logger.warning(
            "extract_attention_score: unexpected error (%s). Returning 0.5.", exc
        )
        return 0.5


# ===========================================================================
# ── FUNCTION: calculate_cone_width ──────────────────────────────────────────
# ===========================================================================
def calculate_cone_width(p10: float, p50: float, p90: float) -> float:
    """Compute the relative width of the forecast probability cone.

    A wider cone means the model is less certain about the outcome, which
    makes a signal less actionable.

    Parameters
    ----------
    p10 : float
        10th-percentile price forecast.
    p50 : float
        Median price forecast (used as denominator / reference).
    p90 : float
        90th-percentile price forecast.

    Returns
    -------
    float
        Relative cone width ``(p90 - p10) / p50``.

    Raises
    ------
    ValueError
        If ``p50 <= 0`` (prevents division by zero or nonsensical results).
    """
    if p50 <= 0:
        raise ValueError(
            f"calculate_cone_width: p50 must be > 0, got {p50!r}."
        )
    return (p90 - p10) / p50


# ===========================================================================
# ── FUNCTION: gate_signal ────────────────────────────────────────────────────
# ===========================================================================
def gate_signal(
    prediction_dict: Dict[str, float],
    attention_score: float,
    sentiment_score: float,
    current_price: float,
    *,
    min_confidence: float  = CONFIG["min_confidence"],
    max_cone_width: float  = CONFIG["max_cone_width"],
    min_sentiment: float   = CONFIG["min_sentiment"],
    max_sentiment: float   = CONFIG["max_sentiment"],
) -> SignalOutput:
    """Run the three-gate signal validation pipeline.

    Parameters
    ----------
    prediction_dict : dict
        Quantile forecasts from the TFT model with keys
        ``'q0.1'``, ``'q0.5'``, ``'q0.9'``.
    attention_score : float
        Model attention confidence in [0, 1].  Use
        :func:`extract_attention_score` to compute this.
    sentiment_score : float
        Aggregate sentiment score in [-1, +1].  Positive = bullish,
        negative = bearish.
    current_price : float
        Most recent known stock price (used for direction determination and
        expected-return calculation).
    min_confidence : float, optional
        Gate 1 threshold.  Signals with attention below this → HOLD.
        Defaults to ``CONFIG['min_confidence']`` (0.65).
    max_cone_width : float, optional
        Gate 2 threshold.  Signals with cone width above this → HOLD.
        Defaults to ``CONFIG['max_cone_width']`` (0.15).
    min_sentiment : float, optional
        Gate 3 lower bound.  A BUY signal is overridden if sentiment is
        below this value.  Defaults to ``CONFIG['min_sentiment']`` (-0.3).
    max_sentiment : float, optional
        Gate 3 upper bound.  A SELL signal is overridden if sentiment is
        above this value.  Defaults to ``CONFIG['max_sentiment']`` (0.3).

    Returns
    -------
    SignalOutput
        Fully populated signal with action, confidence, reason, quantile
        forecasts, expected return, and gate debug information.

    Gate Logic
    ----------
    1. **Direction** — Compare p50 to current_price with ±0.5 % threshold.
    2. **Gate 1** — Reject if attention_score < min_confidence.
    3. **Gate 2** — Reject if relative cone width > max_cone_width.
    4. **Gate 3a** — Override BUY→HOLD if sentiment_score < min_sentiment.
    5. **Gate 3b** — Override SELL→HOLD if sentiment_score > max_sentiment.
    6. All gates passed → emit direction with full confidence.
    """
    if current_price <= 0:
        raise ValueError(
            f"gate_signal: current_price must be > 0, got {current_price!r}."
        )

    # ── Step 1: Extract quantile forecasts ──────────────────────────────────
    p10: float = float(prediction_dict["q0.1"])
    p50: float = float(prediction_dict["q0.5"])
    p90: float = float(prediction_dict["q0.9"])

    # ── Step 2: Determine raw direction ─────────────────────────────────────
    buy_thresh  = CONFIG["buy_threshold"]
    sell_thresh = CONFIG["sell_threshold"]

    if p50 > current_price * (1.0 + buy_thresh):
        direction = "BUY"
    elif p50 < current_price * (1.0 - sell_thresh):
        direction = "SELL"
    else:
        direction = "HOLD"

    expected_return_pct = (p50 - current_price) / current_price * 100.0
    cone_width = calculate_cone_width(p10, p50, p90)

    # ── gate_results accumulator (initialised with values, updated per gate) -
    gate_results: Dict[str, Any] = {
        "direction_raw": direction,
        "p10": p10,
        "p50": p50,
        "p90": p90,
        "current_price": current_price,
        "expected_return_pct": round(expected_return_pct, 4),
        "attention_score": round(attention_score, 4),
        "cone_width": round(cone_width, 6),
        "sentiment_score": round(sentiment_score, 4),
        "gate1_passed": None,
        "gate2_passed": None,
        "gate3_passed": None,
    }

    # ── Gate 1: Attention / model confidence ────────────────────────────────
    if attention_score < min_confidence:
        gate_results["gate1_passed"] = False
        gate_results["gate2_passed"] = "skipped"
        gate_results["gate3_passed"] = "skipped"
        reason = f"Low model confidence ({attention_score:.2f})"
        logger.info(
            "gate_signal [%s]: GATE 1 FAILED — %s < min_confidence=%.2f → HOLD",
            direction, attention_score, min_confidence,
        )
        return SignalOutput(
            action="HOLD",
            confidence=attention_score,
            reason=reason,
            p10=p10, p50=p50, p90=p90,
            current_price=current_price,
            expected_return_pct=expected_return_pct,
            gate_results=gate_results,
        )

    gate_results["gate1_passed"] = True

    # ── Gate 2: Forecast cone width (uncertainty) ────────────────────────────
    if cone_width > max_cone_width:
        gate_results["gate2_passed"] = False
        gate_results["gate3_passed"] = "skipped"
        reason = f"High uncertainty cone ({cone_width:.1%})"
        logger.info(
            "gate_signal [%s]: GATE 2 FAILED — cone=%.4f > max_cone_width=%.4f → HOLD",
            direction, cone_width, max_cone_width,
        )
        return SignalOutput(
            action="HOLD",
            confidence=attention_score,
            reason=reason,
            p10=p10, p50=p50, p90=p90,
            current_price=current_price,
            expected_return_pct=expected_return_pct,
            gate_results=gate_results,
        )

    gate_results["gate2_passed"] = True

    # ── Gate 3: Sentiment alignment ─────────────────────────────────────────
    gate3_reason: Optional[str] = None

    if direction == "BUY" and sentiment_score < min_sentiment:
        gate_results["gate3_passed"] = False
        gate3_reason = f"Bearish sentiment override ({sentiment_score:.2f})"
    elif direction == "SELL" and sentiment_score > max_sentiment:
        gate_results["gate3_passed"] = False
        gate3_reason = f"Bullish sentiment override ({sentiment_score:.2f})"
    else:
        gate_results["gate3_passed"] = True

    if gate3_reason is not None:
        logger.info(
            "gate_signal [%s]: GATE 3 FAILED — %s → HOLD",
            direction, gate3_reason,
        )
        return SignalOutput(
            action="HOLD",
            confidence=attention_score,
            reason=gate3_reason,
            p10=p10, p50=p50, p90=p90,
            current_price=current_price,
            expected_return_pct=expected_return_pct,
            gate_results=gate_results,
        )

    # ── Gate 4 (NEW): PATTERN CONFLUENCE ──
    # Note: For efficiency in full pipeline, we might pass pre-detected patterns.
    # If not passed, we skip or detect here.
    from utils.pattern_recognition import detect_all_patterns, get_confluence_message
    
    # We need a DataFrame here. For now, we assume we want to integrate it into the evaluate logic.
    # Since gate_signal doesn't have the DF, we might need a wrapper or handle it in run_inference.
    pattern_summary = "No pattern data provided to gate"
    pattern_best = None
    
    # Check if df is available in context (it's not here, so we update the signature or handle in run_inference)
    gate_results["gate4_passed"] = "NEUTRAL — background check only"

    # ── All gates passed ─────────────────────────────────────────────────────
    reason = (
        f"All gates passed — direction={direction}, "
        f"confidence={attention_score:.2f}, "
        f"cone={cone_width:.1%}, "
        f"sentiment={sentiment_score:.2f}"
    )
    logger.info(
        "gate_signal: ALL GATES PASSED -> %s | return=%.2f%% | confidence=%.2f",
        direction, expected_return_pct, attention_score,
    )
    return SignalOutput(
        action=direction,
        confidence=attention_score,
        reason=reason,
        p10=p10, p50=p50, p90=p90,
        current_price=current_price,
        expected_return_pct=expected_return_pct,
        gate_results=gate_results,
    )


# ===========================================================================
# ── FUNCTION: run_inference ──────────────────────────────────────────────────
# ===========================================================================
def run_inference(
    ticker: str,
    model: Any,
    training_dataset: Any,
    sentiment_score: float = 0.0,
) -> SignalOutput:
    """End-to-end inference pipeline: fetch → predict → gate → signal.

    Fetches the latest ``CONFIG['inference_lookback_days']`` trading days of
    data, runs the full data pipeline (denoising, frac_diff, features), calls
    the TFT model for quantile predictions, extracts the attention score, and
    passes everything through :func:`gate_signal`.

    Parameters
    ----------
    ticker : str
        Yahoo Finance ticker, e.g. ``'AAPL'`` or ``'RELIANCE.NS'``.
    model : TemporalFusionTransformer
        Trained TFT in eval mode.
    training_dataset : TimeSeriesDataSet
        Training dataset (carries normalisation statistics used to build the
        inference dataset).
    sentiment_score : float, optional
        Pre-computed sentiment score in [-1, +1].  Defaults to 0.0 (neutral).

    Returns
    -------
    SignalOutput
        Validated signal ready for display / downstream consumption.

    Notes
    -----
    * Heavy imports (torch, pytorch-forecasting, pipeline utils) are lazy so
      the module can be imported in test environments without GPU packages.
    * The function uses :func:`train_tft.fast_predict` for optimised
      single-ticker inference and reuses ``get_quantile_prices`` for quantile
      extraction.
    """
    logger.info("run_inference: starting for ticker=%s", ticker)

    # Lazy imports — avoids hard dependency at module load time
    try:
        import torch
        from utils.data_pipeline import fetch_multi_modal, add_static_metadata
        from utils.denoising     import apply_denoising_to_dataframe
        from utils.frac_diff     import apply_to_dataframe as frac_diff_apply
        from utils.features      import build_all_features
        from utils.tft_dataset   import create_inference_dataset
        _has_stack = True
    except ImportError as exc:
        logger.error("run_inference: missing dependency — %s", exc)
        raise

    # ── Step 1: Fetch latest N days of OHLCV + macro data ───────────────────
    lookback_days = CONFIG["inference_lookback_days"]
    # Convert approximate trading days to calendar days for yfinance period
    period = f"{int(lookback_days * 1.5)}d"
    logger.info("run_inference: fetching %s (period=%s)…", ticker, period)

    df = fetch_multi_modal(ticker, period=period)
    df = add_static_metadata(df, ticker)

    # ── Step 2: Data pipeline (mirrors train() pipeline) ────────────────────
    df = apply_denoising_to_dataframe(df)
    df = frac_diff_apply(df, d=0.4)
    df = build_all_features(df, ticker=ticker)

    # ── Step 3: Create inference dataset & run fast_predict ─────────────────
    from train_tft import fast_predict, get_quantile_prices, QUANTILES

    raw_output = fast_predict(
        model=model,
        ticker_df=df,
        training_dataset=training_dataset,
        tail_rows=min(90, len(df)),
    )

    # ── Step 4: Extract quantile prices ─────────────────────────────────────
    quant_prices = get_quantile_prices(raw_output, quantiles=[0.1, 0.5, 0.9])
    prediction_dict = {
        "q0.1": quant_prices["p10"],
        "q0.5": quant_prices["p50"],
        "q0.9": quant_prices["p90"],
    }

    # ── Step 5: Extract attention score ─────────────────────────────────────
    inference_ds = create_inference_dataset(df, training_dataset, tail_rows=90)
    loader = inference_ds.to_dataloader(train=False, batch_size=1, num_workers=0)
    batch = next(iter(loader))
    attention_score = extract_attention_score(model, batch)

    # ── Step 6: Determine current price ─────────────────────────────────────
    current_price = float(df["Close"].dropna().iloc[-1])

    # ── Step 7: Pattern Confluence ──
    from utils.pattern_recognition import detect_all_patterns, get_confluence_message
    pattern_result = detect_all_patterns(df, lookback_bars=120)
    
    # ── Step 8: Gate the signal ──────────────────────────────────────────────
    signal = gate_signal(
        prediction_dict=prediction_dict,
        attention_score=attention_score,
        sentiment_score=sentiment_score,
        current_price=current_price,
    )
    
    # Apply confluence to the signal object
    confluence = get_confluence_message(signal.action, signal.confidence, pattern_result)
    signal.action = confluence["final_action"]
    signal.confidence = confluence["confluence_score"]
    signal.reason += f" | Pattern: {pattern_result['summary']}"
    signal.pattern_summary = pattern_result["summary"]
    signal.pattern_best = pattern_result["best"]

    logger.info(
        "run_inference [%s]: %s | confidence=%.2f | return=%.2f%%",
        ticker, signal.action, signal.confidence, signal.expected_return_pct,
    )
    return signal


# ===========================================================================
# ── __main__ — quick smoke test ──────────────────────────────────────────────
# ===========================================================================
if __name__ == "__main__":
    """Minimal self-test using only pure-Python mocks (no GPU required)."""
    print("\n" + "=" * 60)
    print("  Apex AI — signal_gate.py smoke test (no model needed)")
    print("=" * 60 + "\n")

    # -- test calculate_cone_width -------------------------------------------
    cw = calculate_cone_width(p10=95.0, p50=100.0, p90=110.0)
    assert abs(cw - 0.15) < 1e-9, f"cone_width mismatch: {cw}"
    print(f"  ✅ calculate_cone_width(95, 100, 110) = {cw:.4f}  (expected 0.1500)")

    # -- test gate_signal: Gate 1 failure -----------------------------------
    pred = {"q0.1": 95.0, "q0.5": 101.0, "q0.9": 110.0}
    sig = gate_signal(pred, attention_score=0.50, sentiment_score=0.1,
                      current_price=100.0)
    assert sig.action == "HOLD", f"Expected HOLD, got {sig.action}"
    print(f"  ✅ Gate 1 failure → HOLD  |  reason: {sig.reason}")

    # -- test gate_signal: Gate 2 failure -----------------------------------
    pred_wide = {"q0.1": 80.0, "q0.5": 101.0, "q0.9": 125.0}
    sig2 = gate_signal(pred_wide, attention_score=0.80, sentiment_score=0.1,
                       current_price=100.0)
    assert sig2.action == "HOLD", f"Expected HOLD, got {sig2.action}"
    print(f"  ✅ Gate 2 failure → HOLD  |  reason: {sig2.reason}")

    # -- test gate_signal: Gate 3a failure (bearish sentiment on BUY) --------
    sig3a = gate_signal(pred, attention_score=0.80, sentiment_score=-0.5,
                        current_price=100.0)
    assert sig3a.action == "HOLD"
    print(f"  ✅ Gate 3a failure → HOLD  |  reason: {sig3a.reason}")

    # -- test gate_signal: Gate 3b failure (bullish sentiment on SELL) --------
    pred_sell = {"q0.1": 85.0, "q0.5": 98.0, "q0.9": 105.0}
    sig3b = gate_signal(pred_sell, attention_score=0.80, sentiment_score=0.5,
                        current_price=100.0, max_cone_width=0.25)
    assert sig3b.action == "HOLD"
    print(f"  ✅ Gate 3b failure → HOLD  |  reason: {sig3b.reason}")

    # -- test gate_signal: all gates pass → BUY -----------------------------
    pred_buy = {"q0.1": 99.0, "q0.5": 102.0, "q0.9": 104.0}
    sig_buy = gate_signal(pred_buy, attention_score=0.80, sentiment_score=0.1,
                          current_price=100.0)
    assert sig_buy.action == "BUY", f"Expected BUY, got {sig_buy.action}"
    print(f"  ✅ All gates pass → {sig_buy.action}  |  return: {sig_buy.expected_return_pct:+.2f}%")
    print(f"     {sig_buy!r}")

    print("\n  All smoke tests passed.\n" + "=" * 60 + "\n")
