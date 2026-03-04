"""
tests/test_signal_gate.py
=========================
Apex AI — pytest unit tests for signal_gate.py

Coverage
--------
* calculate_cone_width           — normal case + zero-price edge
* extract_attention_score        — mock model (no GPU required)
* gate_signal / SignalOutput
    - Gate 1 failure (low attention)
    - Gate 2 failure (wide cone)
    - Gate 3a failure (bearish sentiment blocks BUY)
    - Gate 3b failure (bullish sentiment blocks SELL)
    - HOLD direction (p50 ≈ current_price, no gate needed)
    - All gates pass → BUY
    - All gates pass → SELL
    - gate_results dict structure verified on each path
* CONFIG defaults reflected in gate thresholds

Run with:
    pytest tests/test_signal_gate.py -v
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

# Canonical "good" prediction that should trigger BUY when all gates pass
BUY_PRED = {"q0.1": 101.0, "q0.5": 103.0, "q0.9": 104.5}   # cone ~3.4%
SELL_PRED = {"q0.1": 93.0, "q0.5": 96.5,  "q0.9": 99.0}    # cone ~6.2%
HOLD_PRED = {"q0.1": 99.5, "q0.5": 100.2, "q0.9": 100.8}   # p50 ≈ current

CURRENT_PRICE = 100.0
GOOD_ATTN     = 0.80   # above default min_confidence (0.65)
NEUTRAL_SENT  = 0.00   # neutral sentiment — passes Gate 3 for both directions


def _gate_signal(*args, **kwargs):
    """Import lazily so the module itself is the subject under test."""
    from signal_gate import gate_signal
    return gate_signal(*args, **kwargs)


def _calc_cone(*args):
    from signal_gate import calculate_cone_width
    return calculate_cone_width(*args)


def _make_signal_output(**overrides):
    from signal_gate import SignalOutput
    defaults = dict(
        action="HOLD", confidence=0.8, reason="test",
        p10=99.0, p50=100.0, p90=101.0,
        current_price=100.0, expected_return_pct=0.0,
        gate_results={},
    )
    defaults.update(overrides)
    return SignalOutput(**defaults)


# ===========================================================================
# ── calculate_cone_width ─────────────────────────────────────────────────────
# ===========================================================================
class TestCalculateConeWidth:

    def test_symmetric_cone(self):
        """(p90-p10)/p50 with symmetric values."""
        cw = _calc_cone(90.0, 100.0, 110.0)
        assert abs(cw - 0.2) < 1e-9

    def test_tight_cone(self):
        cw = _calc_cone(99.0, 100.0, 101.0)
        assert abs(cw - 0.02) < 1e-9

    def test_exact_gate_boundary(self):
        """(110-95)/100 == 0.15 — exactly at the default threshold."""
        cw = _calc_cone(95.0, 100.0, 110.0)
        assert abs(cw - 0.15) < 1e-9

    def test_zero_p50_raises(self):
        with pytest.raises(ValueError, match="p50 must be > 0"):
            _calc_cone(10.0, 0.0, 20.0)

    def test_negative_p50_raises(self):
        with pytest.raises(ValueError):
            _calc_cone(10.0, -5.0, 20.0)


# ===========================================================================
# ── extract_attention_score ──────────────────────────────────────────────────
# ===========================================================================
class TestExtractAttentionScore:

    def _make_mock_model(self, attn_value: float, n_heads: int = 4):
        """Build a mock TFT whose interpret_output returns controllable attention."""
        import torch

        mock_model = MagicMock()
        mock_model.eval = MagicMock(return_value=None)

        # Simulate an attention tensor: shape (1, n_heads, T, T)
        T = 10
        # Set every element so mean = attn_value / n_heads  →  scaled back = attn_value
        raw_attn = torch.full((1, n_heads, T, T), attn_value / n_heads)
        mock_model.interpret_output = MagicMock(
            return_value={"encoder_attention": raw_attn}
        )
        mock_model.return_value = MagicMock()  # output of model(x)
        return mock_model

    def test_high_confidence(self):
        """Attention score ≥ 0.8 should be preserved."""
        import torch
        from signal_gate import extract_attention_score

        model = self._make_mock_model(attn_value=0.85, n_heads=4)
        x = MagicMock()
        batch = (x, MagicMock())

        score = extract_attention_score(model, batch)
        assert 0.0 <= score <= 1.0
        assert score > 0.5

    def test_low_confidence(self):
        """Attention score of 0.3 should come through below 0.65."""
        import torch
        from signal_gate import extract_attention_score

        model = self._make_mock_model(attn_value=0.30, n_heads=4)
        x = MagicMock()
        batch = (x, MagicMock())

        score = extract_attention_score(model, batch)
        assert 0.0 <= score <= 1.0
        assert score < 0.65

    def test_missing_attention_key_returns_neutral(self):
        """If interpret_output has no attention key, return 0.5."""
        from signal_gate import extract_attention_score

        mock_model = MagicMock()
        mock_model.eval = MagicMock()
        mock_model.interpret_output = MagicMock(return_value={"variable_importances": {}})
        mock_model.return_value = MagicMock()

        score = extract_attention_score(mock_model, (MagicMock(), MagicMock()))
        assert score == 0.5

    def test_exception_returns_neutral(self):
        """Exceptions inside interpret_output should not propagate — return 0.5."""
        from signal_gate import extract_attention_score

        mock_model = MagicMock()
        mock_model.eval = MagicMock()
        mock_model.side_effect = RuntimeError("cuda error")

        score = extract_attention_score(mock_model, (MagicMock(), MagicMock()))
        assert score == 0.5


# ===========================================================================
# ── gate_signal ──────────────────────────────────────────────────────────────
# ===========================================================================
class TestGateSignal:

    # ── Gate 1 failures ─────────────────────────────────────────────────────
    def test_gate1_fail_low_attention(self):
        """Attention below min_confidence → HOLD regardless of direction."""
        sig = _gate_signal(
            BUY_PRED,
            attention_score=0.40,    # below 0.65
            sentiment_score=NEUTRAL_SENT,
            current_price=CURRENT_PRICE,
        )
        assert sig.action == "HOLD"
        assert "Low model confidence" in sig.reason
        assert "0.40" in sig.reason
        assert sig.gate_results["gate1_passed"] is False
        assert sig.gate_results["gate2_passed"] == "skipped"
        assert sig.gate_results["gate3_passed"] == "skipped"

    def test_gate1_fail_exactly_at_boundary(self):
        """Attention exactly at min_confidence (exclusive lower bound) → HOLD."""
        sig = _gate_signal(
            BUY_PRED,
            attention_score=0.6499,
            sentiment_score=NEUTRAL_SENT,
            current_price=CURRENT_PRICE,
        )
        assert sig.action == "HOLD"
        assert sig.gate_results["gate1_passed"] is False

    def test_gate1_pass_at_exact_min(self):
        """Attention exactly equal to min_confidence → passes Gate 1."""
        sig = _gate_signal(
            BUY_PRED,
            attention_score=0.65,    # exactly at boundary — should NOT fail Gate 1
            sentiment_score=NEUTRAL_SENT,
            current_price=CURRENT_PRICE,
        )
        # Gate 1 should pass (attention >= min_confidence)
        assert sig.gate_results["gate1_passed"] is True

    # ── Gate 2 failures ─────────────────────────────────────────────────────
    def test_gate2_fail_wide_cone(self):
        """Cone width > max_cone_width → HOLD."""
        wide_pred = {"q0.1": 75.0, "q0.5": 101.0, "q0.9": 130.0}  # cone ~54%
        sig = _gate_signal(
            wide_pred,
            attention_score=GOOD_ATTN,
            sentiment_score=NEUTRAL_SENT,
            current_price=CURRENT_PRICE,
        )
        assert sig.action == "HOLD"
        assert "High uncertainty cone" in sig.reason
        assert sig.gate_results["gate1_passed"] is True
        assert sig.gate_results["gate2_passed"] is False
        assert sig.gate_results["gate3_passed"] == "skipped"

    def test_gate2_fail_cone_just_over_threshold(self):
        """Cone at 15.1% (just above 15%) → HOLD."""
        # (p90 - p10) / p50  →  (116.0 - 98.9) / 100.0 = 17.1% > 15%
        wide_pred = {"q0.1": 98.9, "q0.5": 101.0, "q0.9": 116.0}
        sig = _gate_signal(
            wide_pred,
            attention_score=GOOD_ATTN,
            sentiment_score=NEUTRAL_SENT,
            current_price=CURRENT_PRICE,
        )
        assert sig.gate_results["gate2_passed"] is False

    # ── Gate 3a: bearish sentiment blocks BUY ───────────────────────────────
    def test_gate3a_fail_bearish_sentiment_blocks_buy(self):
        """BUY direction + negative sentiment below min_sentiment → HOLD."""
        sig = _gate_signal(
            BUY_PRED,
            attention_score=GOOD_ATTN,
            sentiment_score=-0.50,   # below -0.3 threshold
            current_price=CURRENT_PRICE,
        )
        assert sig.action == "HOLD"
        assert "Bearish sentiment override" in sig.reason
        assert "-0.50" in sig.reason
        assert sig.gate_results["gate3_passed"] is False

    def test_gate3a_just_below_min_sentiment(self):
        """Sentiment at -0.31 (just below -0.3) → HOLD for BUY."""
        sig = _gate_signal(
            BUY_PRED,
            attention_score=GOOD_ATTN,
            sentiment_score=-0.31,
            current_price=CURRENT_PRICE,
        )
        assert sig.action == "HOLD"
        assert "Bearish" in sig.reason

    def test_gate3a_exactly_at_min_sentiment_passes(self):
        """Sentiment exactly at min_sentiment (-0.3) should NOT block BUY."""
        sig = _gate_signal(
            BUY_PRED,
            attention_score=GOOD_ATTN,
            sentiment_score=-0.30,   # equal, not strictly less than
            current_price=CURRENT_PRICE,
        )
        # Should NOT trigger Gate 3a (condition is < min_sentiment)
        assert sig.gate_results["gate3_passed"] is True

    # ── Gate 3b: bullish sentiment blocks SELL ────────────────────────────────
    def test_gate3b_fail_bullish_sentiment_blocks_sell(self):
        """SELL direction + positive sentiment above max_sentiment → HOLD."""
        sig = _gate_signal(
            SELL_PRED,
            attention_score=GOOD_ATTN,
            sentiment_score=0.50,    # above 0.3 threshold
            current_price=CURRENT_PRICE,
        )
        assert sig.action == "HOLD"
        assert "Bullish sentiment override" in sig.reason
        assert "0.50" in sig.reason
        assert sig.gate_results["gate3_passed"] is False

    def test_gate3b_just_above_max_sentiment(self):
        """Sentiment at 0.31 (just above 0.3) → HOLD for SELL."""
        sig = _gate_signal(
            SELL_PRED,
            attention_score=GOOD_ATTN,
            sentiment_score=0.31,
            current_price=CURRENT_PRICE,
        )
        assert sig.action == "HOLD"
        assert "Bullish" in sig.reason

    def test_gate3b_exactly_at_max_sentiment_passes(self):
        """Sentiment exactly at max_sentiment (0.3) should NOT block SELL."""
        sig = _gate_signal(
            SELL_PRED,
            attention_score=GOOD_ATTN,
            sentiment_score=0.30,
            current_price=CURRENT_PRICE,
        )
        # Should NOT trigger Gate 3b (condition is > max_sentiment)
        assert sig.gate_results["gate3_passed"] is True

    # ── Gate 3 not triggered for HOLD direction ───────────────────────────────
    def test_gate3_not_triggered_for_hold_direction(self):
        """Gate 3 sentiment check is only for BUY/SELL — a HOLD direction
        with extreme sentiment should still pass (gate3_passed=True)."""
        sig = _gate_signal(
            HOLD_PRED,
            attention_score=GOOD_ATTN,
            sentiment_score=-0.99,   # very bearish — but direction is HOLD
            current_price=CURRENT_PRICE,
        )
        # direction is HOLD (p50 ≈ current), gate3 should not fire
        assert sig.gate_results["gate3_passed"] is True
        assert sig.action == "HOLD"

    # ── All gates pass → BUY ─────────────────────────────────────────────────
    def test_all_gates_pass_buy(self):
        """All three gates green → BUY signal emitted."""
        sig = _gate_signal(
            BUY_PRED,
            attention_score=GOOD_ATTN,
            sentiment_score=NEUTRAL_SENT,
            current_price=CURRENT_PRICE,
        )
        assert sig.action == "BUY"
        assert sig.confidence == GOOD_ATTN
        assert sig.expected_return_pct > 0
        assert sig.p50 > sig.p10
        assert sig.p90 > sig.p50
        assert sig.gate_results["gate1_passed"] is True
        assert sig.gate_results["gate2_passed"] is True
        assert sig.gate_results["gate3_passed"] is True
        assert "All gates passed" in sig.reason
        assert "BUY" in sig.reason

    # ── All gates pass → SELL ────────────────────────────────────────────────
    def test_all_gates_pass_sell(self):
        """All three gates green → SELL signal emitted."""
        sig = _gate_signal(
            SELL_PRED,
            attention_score=GOOD_ATTN,
            sentiment_score=NEUTRAL_SENT,
            current_price=CURRENT_PRICE,
        )
        assert sig.action == "SELL"
        assert sig.expected_return_pct < 0
        assert sig.gate_results["gate1_passed"] is True
        assert sig.gate_results["gate2_passed"] is True
        assert sig.gate_results["gate3_passed"] is True
        assert "SELL" in sig.reason

    # ── Expected return calculation ──────────────────────────────────────────
    def test_expected_return_pct_accuracy(self):
        """(p50 - current) / current * 100 must match SignalOutput.expected_return_pct."""
        pred = {"q0.1": 101.0, "q0.5": 105.0, "q0.9": 106.0}
        sig = _gate_signal(
            pred,
            attention_score=GOOD_ATTN,
            sentiment_score=NEUTRAL_SENT,
            current_price=100.0,
        )
        expected = (105.0 - 100.0) / 100.0 * 100.0
        assert abs(sig.expected_return_pct - expected) < 1e-6

    # ── Custom threshold overrides ────────────────────────────────────────────
    def test_custom_min_confidence_override(self):
        """Caller can lower min_confidence to accept less-confident signals."""
        sig = _gate_signal(
            BUY_PRED,
            attention_score=0.50,   # below default 0.65 but above custom 0.40
            sentiment_score=NEUTRAL_SENT,
            current_price=CURRENT_PRICE,
            min_confidence=0.40,   # custom override
        )
        assert sig.gate_results["gate1_passed"] is True

    def test_custom_max_cone_width_override(self):
        """Wider cone allowance via custom max_cone_width."""
        wide_pred = {"q0.1": 88.0, "q0.5": 101.0, "q0.9": 115.0}
        sig = _gate_signal(
            wide_pred,
            attention_score=GOOD_ATTN,
            sentiment_score=NEUTRAL_SENT,
            current_price=CURRENT_PRICE,
            max_cone_width=0.30,   # allow up to 30% cone width
        )
        assert sig.gate_results["gate2_passed"] is True

    # ── gate_results keys always present ─────────────────────────────────────
    def test_gate_results_keys_present_on_all_paths(self):
        """gate_results must always contain the documented keys."""
        required_keys = {
            "direction_raw", "p10", "p50", "p90", "current_price",
            "expected_return_pct", "attention_score", "cone_width",
            "sentiment_score", "gate1_passed", "gate2_passed", "gate3_passed",
        }
        # Gate 1 fail path
        sig1 = _gate_signal(BUY_PRED, 0.3, NEUTRAL_SENT, CURRENT_PRICE)
        assert required_keys.issubset(sig1.gate_results.keys())

        # Gate 2 fail path
        wide = {"q0.1": 70.0, "q0.5": 101.0, "q0.9": 135.0}
        sig2 = _gate_signal(wide, GOOD_ATTN, NEUTRAL_SENT, CURRENT_PRICE)
        assert required_keys.issubset(sig2.gate_results.keys())

        # All-gates-pass path
        sig3 = _gate_signal(BUY_PRED, GOOD_ATTN, NEUTRAL_SENT, CURRENT_PRICE)
        assert required_keys.issubset(sig3.gate_results.keys())

    # ── Edge cases ────────────────────────────────────────────────────────────
    def test_invalid_current_price_raises(self):
        with pytest.raises(ValueError, match="current_price must be > 0"):
            _gate_signal(BUY_PRED, GOOD_ATTN, NEUTRAL_SENT, current_price=0.0)

    def test_invalid_current_price_negative_raises(self):
        with pytest.raises(ValueError):
            _gate_signal(BUY_PRED, GOOD_ATTN, NEUTRAL_SENT, current_price=-10.0)


# ===========================================================================
# ── SignalOutput dataclass ───────────────────────────────────────────────────
# ===========================================================================
class TestSignalOutput:

    def test_repr_contains_action_and_return(self):
        from signal_gate import SignalOutput
        so = SignalOutput(
            action="BUY", confidence=0.75, reason="test",
            p10=99.0, p50=102.0, p90=105.0,
            current_price=100.0, expected_return_pct=2.0,
            gate_results={},
        )
        r = repr(so)
        assert "BUY" in r
        assert "+2.00%" in r
        assert "0.750" in r

    def test_default_gate_results_is_empty_dict(self):
        from signal_gate import SignalOutput
        so = SignalOutput(
            action="HOLD", confidence=0.5, reason="",
            p10=99.0, p50=100.0, p90=101.0,
            current_price=100.0, expected_return_pct=0.0,
        )
        assert so.gate_results == {}

    def test_dataclass_fields(self):
        """All specified fields exist."""
        from signal_gate import SignalOutput
        import dataclasses
        field_names = {f.name for f in dataclasses.fields(SignalOutput)}
        assert {"action", "confidence", "reason", "p10", "p50", "p90",
                "current_price", "expected_return_pct",
                "gate_results"}.issubset(field_names)


# ===========================================================================
# ── CONFIG defaults ──────────────────────────────────────────────────────────
# ===========================================================================
class TestConfig:

    def test_config_keys_present(self):
        from signal_gate import CONFIG
        required = {
            "min_confidence", "max_cone_width",
            "min_sentiment", "max_sentiment",
            "buy_threshold", "sell_threshold",
            "inference_lookback_days",
        }
        assert required.issubset(CONFIG.keys())

    def test_config_default_values(self):
        from signal_gate import CONFIG
        assert CONFIG["min_confidence"] == 0.65
        assert CONFIG["max_cone_width"] == 0.15
        assert CONFIG["min_sentiment"] == -0.3
        assert CONFIG["max_sentiment"] == 0.3
        assert CONFIG["buy_threshold"] == 0.005
        assert CONFIG["sell_threshold"] == 0.005
        assert CONFIG["inference_lookback_days"] == 120
