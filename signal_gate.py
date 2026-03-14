"""
APEX AI — Signal Gate  v2.0
Provides:
  • SignalOutput dataclass (shared return type)
  • Standalone gate evaluation helpers (unit-testable)
  • Confidence formula

The 3 gates are evaluated inline in main.py for performance.
This module supplies the shared types and helpers.
"""

from __future__ import annotations
from dataclasses import dataclass


@dataclass
class SignalOutput:
    """Canonical signal output — passed between inference pipeline and explanation layer."""
    ticker: str
    direction: str              # "BUY" | "SELL" | "HOLD"
    confidence: float           # [0.45, 0.92]
    p10: float
    p50: float
    p90: float
    gate1: bool = False         # Cone Width < 12%
    gate2: bool = False         # Sentiment aligns
    gate3: bool = False         # RSI confluence
    sentiment_score: float = 0.0
    rsi: float = 50.0
    atr: float = 0.0
    cone_width: float = 0.0
    gru_prob: float = 0.5
    tcn_prob: float = 0.5
    explanation: str = ""
    regime: str = "UNKNOWN"
    used_atr_fallback: bool = False

    @property
    def gates_passed(self) -> bool:
        return self.gate1 and self.gate2 and self.gate3

    @property
    def final_action(self) -> str:
        return self.direction if self.gates_passed else "HOLD"

    def to_dict(self) -> dict:
        return {
            "ticker": self.ticker,
            "direction": self.direction,
            "final_action": self.final_action,
            "confidence": round(self.confidence, 3),
            "p10": round(self.p10, 2),
            "p50": round(self.p50, 2),
            "p90": round(self.p90, 2),
            "cone_width": round(self.cone_width, 4),
            "rsi": round(self.rsi, 2),
            "sentiment_score": round(self.sentiment_score, 4),
            "gate_results": {
                "gate1_cone": self.gate1,
                "gate2_sentiment": self.gate2,
                "gate3_technical": self.gate3,
                "gates_passed": self.gates_passed,
            },
            "explanation": self.explanation,
            "regime": self.regime,
        }


# ── Standalone helpers (unit-testable) ───────────────────────────────────────

def evaluate_gate1_cone(p10: float, p50: float, p90: float, threshold: float = 0.12) -> bool:
    """(P90 - P10) / P50 < threshold. Tight cone = more actionable."""
    if p50 <= 0:
        return False
    return bool((p90 - p10) / p50 < threshold)


def evaluate_gate2_sentiment(direction: str, sentiment_score: float) -> bool:
    """FinBERT score must align with direction. BUY≥0, SELL≤0, HOLD always True."""
    if direction == "BUY":
        return bool(sentiment_score >= 0.0)
    if direction == "SELL":
        return bool(sentiment_score <= 0.0)
    return True


def evaluate_gate3_technical(direction: str, rsi: float) -> bool:
    """RSI 40–70 for BUY (not overbought), RSI < 55 for SELL (downward momentum)."""
    if direction == "BUY":
        return bool(40 <= rsi <= 70)
    if direction == "SELL":
        return bool(rsi < 55)
    return True


def compute_confidence(
    cone_width: float, avg_dir_prob: float, sentiment_score: float,
    gate1: bool, gate2: bool, gate3: bool,
) -> float:
    """
    Confidence ∈ [0.45, 0.92]
    = 0.45 base
    + cone_score      (max 0.35)  — tighter cone → higher
    + conviction      (max 0.25)  — stronger directional prob → higher
    + sentiment       (max 0.10)  — strong FinBERT → small boost
    + gate_bonus      (max 0.07)  — # gates passed / 3
    """
    import numpy as np
    cone_score        = max(0.0, 1.0 - cone_width) * 0.35
    conviction_score  = abs(avg_dir_prob - 0.5) * 2.0 * 0.25
    sentiment_contrib = abs(sentiment_score) * 0.10
    gate_bonus        = sum([gate1, gate2, gate3]) / 3.0 * 0.07
    return round(float(np.clip(0.45 + cone_score + conviction_score + sentiment_contrib + gate_bonus, 0.45, 0.92)), 3)


if __name__ == "__main__":
    p10, p50, p90 = 2380.0, 2450.0, 2510.0
    direction, rsi, sentiment, avg_dir_prob = "BUY", 55.0, 0.35, 0.72
    g1 = evaluate_gate1_cone(p10, p50, p90)
    g2 = evaluate_gate2_sentiment(direction, sentiment)
    g3 = evaluate_gate3_technical(direction, rsi)
    conf = compute_confidence((p90 - p10) / p50, avg_dir_prob, sentiment, g1, g2, g3)
    print(f"Gate1: {'✅' if g1 else '❌'}  Gate2: {'✅' if g2 else '❌'}  Gate3: {'✅' if g3 else '❌'}")
    print(f"Confidence: {conf:.1%}  Action: {'BUY' if g1 and g2 and g3 else 'HOLD'}")
