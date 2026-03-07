import numpy as np
import pandas as pd
from scipy.signal import find_peaks, argrelextrema
from dataclasses import dataclass, field
from typing import Literal, Optional
import plotly.graph_objects as go


# ─────────────────────────────────────────────────────────────────────────────
# DATA CLASSES
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class PatternResult:
    """
    Holds everything about a single detected pattern.
    """
    name: str                          # e.g. "Head & Shoulders"
    pattern_type: Literal[
        "reversal_bearish",
        "reversal_bullish",
        "continuation_bullish",
        "continuation_bearish",
        "neutral"
    ]
    confidence: float                  # 0.0 – 1.0
    start_idx: int                     # bar index where pattern starts
    end_idx: int                       # bar index where pattern ends
    key_points: list                   # [(bar_idx, price), ...] for drawing
    breakout_level: Optional[float]    # price level for breakout/neckline
    target_price: Optional[float]      # measured move target
    description: str                   # short human-readable reason
    direction: Literal["bullish", "bearish", "neutral"]
    emoji: str = "📐"


# ─────────────────────────────────────────────────────────────────────────────
# CORE: SWING HIGH / LOW DETECTION
# ─────────────────────────────────────────────────────────────────────────────

def find_swing_highs_lows(
    prices: np.ndarray,
    order: int = 5
) -> tuple[np.ndarray, np.ndarray]:
    """
    Find significant swing highs and lows using scipy argrelextrema.

    Args:
        prices: 1D numpy array of closing prices
        order:  how many bars on each side must be lower/higher
                (higher = fewer but more significant swings)

    Returns:
        (highs_idx, lows_idx) — arrays of bar indices
    """
    highs_idx = argrelextrema(prices, np.greater, order=order)[0]
    lows_idx  = argrelextrema(prices, np.less,    order=order)[0]
    return highs_idx, lows_idx


def find_peaks_scipy(
    prices: np.ndarray,
    prominence: float = 0.01,   # minimum % move to count as peak
    distance: int = 5           # minimum bars between peaks
) -> tuple[np.ndarray, np.ndarray]:
    """
    Uses scipy.signal.find_peaks for peak/trough detection.
    More robust than argrelextrema for irregular data.

    Args:
        prices:     1D numpy array of prices
        prominence: minimum prominence as fraction of price range
        distance:   minimum bars between detected peaks

    Returns:
        (peak_idx, trough_idx)
    """
    price_range = prices.max() - prices.min()
    abs_prominence = prominence * price_range

    peak_idx, _   = find_peaks(prices,  prominence=abs_prominence, distance=distance)
    trough_idx, _ = find_peaks(-prices, prominence=abs_prominence, distance=distance)

    return peak_idx, trough_idx


# ─────────────────────────────────────────────────────────────────────────────
# PATTERN DETECTORS
# ─────────────────────────────────────────────────────────────────────────────

def _pct_diff(a: float, b: float) -> float:
    """Percentage difference between two price levels."""
    return abs(a - b) / ((a + b) / 2)


def detect_head_and_shoulders(
    prices: np.ndarray,
    peak_idx: np.ndarray,
    trough_idx: np.ndarray,
    tolerance: float = 0.03     # 3% — how close shoulders must be in height
) -> list[PatternResult]:
    """
    HEAD & SHOULDERS (bearish reversal)
    Pattern: Left Shoulder → Head (higher high) → Right Shoulder
    Neckline: line connecting the two troughs between shoulders

    INVERSE H&S (bullish reversal) detected on inverted prices.
    """
    results = []

    # ── STANDARD H&S (bearish) ──
    for i in range(len(peak_idx) - 2):
        ls_idx = peak_idx[i]
        h_idx  = peak_idx[i + 1]
        rs_idx = peak_idx[i + 2]

        ls = prices[ls_idx]
        h  = prices[h_idx]
        rs = prices[rs_idx]

        # Head must be highest
        if not (h > ls and h > rs):
            continue

        # Shoulders must be roughly equal
        if _pct_diff(ls, rs) > tolerance:
            continue

        # Find neckline troughs between LS→H and H→RS
        t1_candidates = trough_idx[(trough_idx > ls_idx) & (trough_idx < h_idx)]
        t2_candidates = trough_idx[(trough_idx > h_idx)  & (trough_idx < rs_idx)]

        if len(t1_candidates) == 0 or len(t2_candidates) == 0:
            continue

        t1_idx = t1_candidates[np.argmin(prices[t1_candidates])]
        t2_idx = t2_candidates[np.argmin(prices[t2_candidates])]
        neckline = (prices[t1_idx] + prices[t2_idx]) / 2

        # Pattern height = head - neckline → measured move target
        height = h - neckline
        target = neckline - height  # bearish target below neckline

        # Confidence: how symmetrical + how clear the head is
        symmetry_score = 1 - _pct_diff(ls, rs) / tolerance
        head_prominence = (h - max(ls, rs)) / h
        confidence = min(0.95, 0.5 + symmetry_score * 0.3 + head_prominence * 0.2)

        results.append(PatternResult(
            name="Head & Shoulders",
            pattern_type="reversal_bearish",
            confidence=round(confidence, 2),
            start_idx=int(ls_idx),
            end_idx=int(rs_idx),
            key_points=[
                (int(ls_idx), float(ls)),
                (int(t1_idx), float(prices[t1_idx])),
                (int(h_idx),  float(h)),
                (int(t2_idx), float(prices[t2_idx])),
                (int(rs_idx), float(rs)),
            ],
            breakout_level=round(neckline, 2),
            target_price=round(target, 2),
            description=f"LS ₹{ls:.0f} → Head ₹{h:.0f} → RS ₹{rs:.0f} · Neckline ₹{neckline:.0f}",
            direction="bearish",
            emoji="📉"
        ))

    # ── INVERSE H&S (bullish) ── detect on negated prices
    inv = -prices
    inv_peak_idx, inv_trough_idx = find_peaks_scipy(inv)
    for i in range(len(inv_peak_idx) - 2):
        ls_idx = inv_peak_idx[i]
        h_idx  = inv_peak_idx[i + 1]
        rs_idx = inv_peak_idx[i + 2]

        ls = prices[ls_idx]   # actual low
        h  = prices[h_idx]
        rs = prices[rs_idx]

        if not (h < ls and h < rs):
            continue
        if _pct_diff(ls, rs) > tolerance:
            continue

        t1_c = inv_trough_idx[(inv_trough_idx > ls_idx) & (inv_trough_idx < h_idx)]
        t2_c = inv_trough_idx[(inv_trough_idx > h_idx)  & (inv_trough_idx < rs_idx)]
        if len(t1_c) == 0 or len(t2_c) == 0:
            continue

        t1_idx = t1_c[np.argmax(prices[t1_c])]
        t2_idx = t2_c[np.argmax(prices[t2_c])]
        neckline = (prices[t1_idx] + prices[t2_idx]) / 2
        height   = neckline - h
        target   = neckline + height  # bullish target

        sym   = 1 - _pct_diff(ls, rs) / tolerance
        head_p = (min(ls, rs) - h) / abs(h)
        conf  = min(0.95, 0.5 + sym * 0.3 + head_p * 0.2)

        results.append(PatternResult(
            name="Inverse Head & Shoulders",
            pattern_type="reversal_bullish",
            confidence=round(conf, 2),
            start_idx=int(ls_idx),
            end_idx=int(rs_idx),
            key_points=[
                (int(ls_idx), float(ls)),
                (int(t1_idx), float(prices[t1_idx])),
                (int(h_idx),  float(h)),
                (int(t2_idx), float(prices[t2_idx])),
                (int(rs_idx), float(rs)),
            ],
            breakout_level=round(neckline, 2),
            target_price=round(target, 2),
            description=f"Inv H&S · Neckline ₹{neckline:.0f} · Target ₹{target:.0f}",
            direction="bullish",
            emoji="📈"
        ))

    return results


def detect_double_top_bottom(
    prices: np.ndarray,
    peak_idx: np.ndarray,
    trough_idx: np.ndarray,
    tolerance: float = 0.025    # peaks must be within 2.5% of each other
) -> list[PatternResult]:
    """
    DOUBLE TOP  (bearish) — two roughly equal peaks with valley between
    DOUBLE BOTTOM (bullish) — two roughly equal troughs with peak between
    """
    results = []

    # ── DOUBLE TOP ──
    for i in range(len(peak_idx) - 1):
        p1_idx = peak_idx[i]
        p2_idx = peak_idx[i + 1]
        p1, p2 = prices[p1_idx], prices[p2_idx]

        if _pct_diff(p1, p2) > tolerance:
            continue

        # Valley between the two tops
        v_candidates = trough_idx[(trough_idx > p1_idx) & (trough_idx < p2_idx)]
        if len(v_candidates) == 0:
            continue
        v_idx = v_candidates[np.argmin(prices[v_candidates])]
        valley = prices[v_idx]
        neckline = valley
        height   = max(p1, p2) - neckline
        target   = neckline - height

        conf = min(0.92, 0.6 + (1 - _pct_diff(p1, p2) / tolerance) * 0.32)

        results.append(PatternResult(
            name="Double Top",
            pattern_type="reversal_bearish",
            confidence=round(conf, 2),
            start_idx=int(p1_idx),
            end_idx=int(p2_idx),
            key_points=[
                (int(p1_idx), float(p1)),
                (int(v_idx),  float(valley)),
                (int(p2_idx), float(p2)),
            ],
            breakout_level=round(neckline, 2),
            target_price=round(target, 2),
            description=f"Double Top ₹{p1:.0f}/₹{p2:.0f} · Target ₹{target:.0f}",
            direction="bearish",
            emoji="🔻"
        ))

    # ── DOUBLE BOTTOM ──
    for i in range(len(trough_idx) - 1):
        t1_idx = trough_idx[i]
        t2_idx = trough_idx[i + 1]
        t1, t2 = prices[t1_idx], prices[t2_idx]

        if _pct_diff(t1, t2) > tolerance:
            continue

        p_candidates = peak_idx[(peak_idx > t1_idx) & (peak_idx < t2_idx)]
        if len(p_candidates) == 0:
            continue
        p_idx    = p_candidates[np.argmax(prices[p_candidates])]
        peak     = prices[p_idx]
        neckline = peak
        height   = neckline - min(t1, t2)
        target   = neckline + height

        conf = min(0.92, 0.6 + (1 - _pct_diff(t1, t2) / tolerance) * 0.32)

        results.append(PatternResult(
            name="Double Bottom",
            pattern_type="reversal_bullish",
            confidence=round(conf, 2),
            start_idx=int(t1_idx),
            end_idx=int(t2_idx),
            key_points=[
                (int(t1_idx), float(t1)),
                (int(p_idx),  float(peak)),
                (int(t2_idx), float(t2)),
            ],
            breakout_level=round(neckline, 2),
            target_price=round(target, 2),
            description=f"Double Bottom ₹{t1:.0f}/₹{t2:.0f} · Target ₹{target:.0f}",
            direction="bullish",
            emoji="🔺"
        ))

    return results


def detect_triangles(
    prices: np.ndarray,
    dates: np.ndarray,
    peak_idx: np.ndarray,
    trough_idx: np.ndarray,
    min_touches: int = 3,
    lookback: int = 60
) -> list[PatternResult]:
    """
    TRIANGLE PATTERNS — Ascending, Descending, Symmetrical
    Uses linear regression on recent highs and lows to detect converging trendlines.

    Ascending  → flat resistance + rising support → bullish
    Descending → flat support + falling resistance → bearish
    Symmetrical → falling highs + rising lows → continuation
    """
    results = []

    if len(peak_idx) < 2 or len(trough_idx) < 2:
        return results

    # Only use recent bars
    recent_peaks   = peak_idx[peak_idx >= len(prices) - lookback]
    recent_troughs = trough_idx[trough_idx >= len(prices) - lookback]

    if len(recent_peaks) < 2 or len(recent_troughs) < 2:
        return results

    # Fit lines through highs and lows
    high_prices = prices[recent_peaks]
    low_prices  = prices[recent_troughs]

    # Linear regression slopes
    if len(recent_peaks) >= 2:
        high_slope = np.polyfit(recent_peaks, high_prices, 1)[0]
    else:
        return results

    if len(recent_troughs) >= 2:
        low_slope  = np.polyfit(recent_troughs, low_prices, 1)[0]
    else:
        return results

    # Normalise slope by price level
    avg_price   = prices[-lookback:].mean()
    h_slope_pct = high_slope / avg_price * 100
    l_slope_pct = low_slope  / avg_price * 100

    flat_thresh = 0.03   # slope < 0.03% per bar = "flat"
    slope_thresh = 0.05  # slope > 0.05% per bar = "significant"

    start = int(min(recent_peaks[0], recent_troughs[0]))
    end   = int(max(recent_peaks[-1], recent_troughs[-1]))

    # ── ASCENDING TRIANGLE ──
    if abs(h_slope_pct) < flat_thresh and l_slope_pct > slope_thresh:
        resistance = float(high_prices.mean())
        height     = resistance - float(low_prices[-1])
        target     = resistance + height
        results.append(PatternResult(
            name="Ascending Triangle",
            pattern_type="continuation_bullish",
            confidence=0.72,
            start_idx=start, end_idx=end,
            key_points=[(int(i), float(prices[i])) for i in recent_peaks],
            breakout_level=round(resistance, 2),
            target_price=round(target, 2),
            description=f"Flat resistance ₹{resistance:.0f} + rising lows · Breakout target ₹{target:.0f}",
            direction="bullish",
            emoji="📐"
        ))

    # ── DESCENDING TRIANGLE ──
    elif abs(l_slope_pct) < flat_thresh and h_slope_pct < -slope_thresh:
        support = float(low_prices.mean())
        height  = float(high_prices[-1]) - support
        target  = support - height
        results.append(PatternResult(
            name="Descending Triangle",
            pattern_type="continuation_bearish",
            confidence=0.71,
            start_idx=start, end_idx=end,
            key_points=[(int(i), float(prices[i])) for i in recent_troughs],
            breakout_level=round(support, 2),
            target_price=round(target, 2),
            description=f"Flat support ₹{support:.0f} + falling highs · Breakdown target ₹{target:.0f}",
            direction="bearish",
            emoji="📐"
        ))

    # ── SYMMETRICAL TRIANGLE ──
    elif h_slope_pct < -flat_thresh and l_slope_pct > flat_thresh:
        apex_price = (float(high_prices[-1]) + float(low_prices[-1])) / 2
        height     = float(high_prices[0]) - float(low_prices[0])
        results.append(PatternResult(
            name="Symmetrical Triangle",
            pattern_type="neutral",
            confidence=0.65,
            start_idx=start, end_idx=end,
            key_points=[(int(i), float(prices[i])) for i in list(recent_peaks) + list(recent_troughs)],
            breakout_level=round(apex_price, 2),
            target_price=None,
            description=f"Converging trendlines · Apex ₹{apex_price:.0f} · Breakout imminent",
            direction="neutral",
            emoji="🔺"
        ))

    return results


def detect_flag(
    prices: np.ndarray,
    peak_idx: np.ndarray,
    trough_idx: np.ndarray,
    pole_min_pct: float = 0.06,   # pole must be ≥ 6% move
    flag_bars: int = 15           # flag consolidation window
) -> list[PatternResult]:
    """
    BULL FLAG / BEAR FLAG — Sharp move (pole) followed by tight consolidation (flag)
    Bull Flag: strong upward pole → slight downward channel → breakout up
    Bear Flag:  strong downward pole → slight upward channel → breakdown
    """
    results = []
    n = len(prices)
    if n < flag_bars + 10:
        return results

    # ── BULL FLAG ──
    # Look for a strong pole followed by a brief pullback
    for i in range(10, n - flag_bars):
        pole_start = i - 10
        pole_end   = i
        pole_low   = prices[pole_start:pole_end].min()
        pole_high  = prices[pole_start:pole_end].max()
        pole_move  = (pole_high - pole_low) / pole_low

        if pole_move < pole_min_pct:
            continue
        if prices[pole_end] < pole_high * 0.95:   # must still be near top
            continue

        flag_segment = prices[pole_end:pole_end + flag_bars]
        flag_slope   = np.polyfit(range(flag_bars), flag_segment, 1)[0]
        flag_slope_pct = flag_slope / flag_segment.mean() * 100

        # Flag should drift slightly down (−0.15% to +0.05% per bar)
        if -0.15 < flag_slope_pct < 0.05:
            target = pole_high + (pole_high - pole_low)
            results.append(PatternResult(
                name="Bull Flag",
                pattern_type="continuation_bullish",
                confidence=0.74,
                start_idx=pole_start,
                end_idx=pole_end + flag_bars,
                key_points=[
                    (pole_start, float(pole_low)),
                    (pole_end,   float(pole_high)),
                    (pole_end + flag_bars, float(flag_segment[-1])),
                ],
                breakout_level=round(pole_high, 2),
                target_price=round(target, 2),
                description=f"Bull Flag · Pole +{pole_move*100:.1f}% · Target ₹{target:.0f}",
                direction="bullish",
                emoji="🚩"
            ))
            break  # one flag per call

    # ── BEAR FLAG ──
    for i in range(10, n - flag_bars):
        pole_start  = i - 10
        pole_end    = i
        pole_high   = prices[pole_start:pole_end].max()
        pole_low    = prices[pole_start:pole_end].min()
        pole_move   = (pole_high - pole_low) / pole_high

        if pole_move < pole_min_pct:
            continue
        if prices[pole_end] > pole_low * 1.05:
            continue

        flag_segment = prices[pole_end:pole_end + flag_bars]
        flag_slope   = np.polyfit(range(flag_bars), flag_segment, 1)[0]
        flag_slope_pct = flag_slope / flag_segment.mean() * 100

        # Flag drifts slightly up
        if 0.0 < flag_slope_pct < 0.15:
            target = pole_low - (pole_high - pole_low)
            results.append(PatternResult(
                name="Bear Flag",
                pattern_type="continuation_bearish",
                confidence=0.72,
                start_idx=pole_start,
                end_idx=pole_end + flag_bars,
                key_points=[
                    (pole_start, float(pole_high)),
                    (pole_end,   float(pole_low)),
                    (pole_end + flag_bars, float(flag_segment[-1])),
                ],
                breakout_level=round(pole_low, 2),
                target_price=round(target, 2),
                description=f"Bear Flag · Pole -{pole_move*100:.1f}% · Target ₹{target:.0f}",
                direction="bearish",
                emoji="🚩"
            ))
            break

    return results


def detect_cup_and_handle(
    prices: np.ndarray,
    peak_idx: np.ndarray,
    trough_idx: np.ndarray,
    cup_min_bars: int = 20,
    depth_max_pct: float = 0.35    # cup shouldn't be deeper than 35%
) -> list[PatternResult]:
    """
    CUP & HANDLE — Bullish continuation pattern
    Shape: round bottom (cup) followed by small consolidation (handle)
    """
    results = []
    n = len(prices)

    for i in range(len(peak_idx) - 1):
        left_rim_idx  = peak_idx[i]
        right_rim_idx = peak_idx[i + 1]

        span = right_rim_idx - left_rim_idx
        if span < cup_min_bars:
            continue

        left_rim  = prices[left_rim_idx]
        right_rim = prices[right_rim_idx]

        # Rims must be at similar heights
        if _pct_diff(left_rim, right_rim) > 0.06:
            continue

        # Cup bottom = lowest point between rims
        cup_segment  = prices[left_rim_idx:right_rim_idx + 1]
        cup_bottom   = cup_segment.min()
        cup_depth    = (max(left_rim, right_rim) - cup_bottom) / max(left_rim, right_rim)

        if cup_depth > depth_max_pct or cup_depth < 0.08:
            continue

        # Roundness check: midpoint of cup should be near bottom
        mid_idx  = left_rim_idx + span // 2
        mid_price = prices[mid_idx]
        roundness = (mid_price - cup_bottom) / (max(left_rim, right_rim) - cup_bottom)
        if roundness > 0.35:  # too V-shaped
            continue

        # Handle = last 10-20% of pattern after right rim
        handle_end = min(n - 1, right_rim_idx + max(5, span // 8))
        handle_low = prices[right_rim_idx:handle_end + 1].min()
        handle_depth = (right_rim - handle_low) / right_rim
        if handle_depth > 0.12:  # handle too deep
            continue

        target = right_rim + (right_rim - cup_bottom)
        conf   = min(0.88, 0.55 + (1 - roundness) * 0.2 + (1 - handle_depth / 0.12) * 0.13)

        results.append(PatternResult(
            name="Cup & Handle",
            pattern_type="continuation_bullish",
            confidence=round(conf, 2),
            start_idx=int(left_rim_idx),
            end_idx=int(handle_end),
            key_points=[
                (int(left_rim_idx),  float(left_rim)),
                (int(left_rim_idx + span // 2), float(cup_bottom)),
                (int(right_rim_idx), float(right_rim)),
                (int(handle_end),    float(handle_low)),
            ],
            breakout_level=round(right_rim, 2),
            target_price=round(target, 2),
            description=f"Cup depth {cup_depth*100:.1f}% · Handle {handle_depth*100:.1f}% · Target ₹{target:.0f}",
            direction="bullish",
            emoji="☕"
        ))

    return results


def detect_support_resistance(
    prices: np.ndarray,
    peak_idx: np.ndarray,
    trough_idx: np.ndarray,
    cluster_pct: float = 0.015,  # price levels within 1.5% grouped together
    min_touches: int = 2
) -> list[dict]:
    """
    Detects horizontal support and resistance levels by clustering peaks/troughs.
    Returns a list of level dicts for drawing on chart.
    """
    levels = []

    # Collect all significant pivot prices
    pivot_prices = []
    for idx in peak_idx:
        pivot_prices.append(("resistance", float(prices[idx])))
    for idx in trough_idx:
        pivot_prices.append(("support", float(prices[idx])))

    if not pivot_prices:
        return levels

    # Cluster nearby levels
    all_prices = [p[1] for p in pivot_prices]
    all_prices.sort()

    clusters = []
    current_cluster = [all_prices[0]]

    for p in all_prices[1:]:
        if _pct_diff(p, current_cluster[-1]) <= cluster_pct:
            current_cluster.append(p)
        else:
            clusters.append(current_cluster)
            current_cluster = [p]
    clusters.append(current_cluster)

    current_price = prices[-1]

    for cluster in clusters:
        if len(cluster) < min_touches:
            continue
        level = float(np.mean(cluster))
        kind  = "resistance" if level > current_price else "support"
        strength = min(1.0, len(cluster) / 5)   # more touches = stronger

        levels.append({
            "level":    round(level, 2),
            "kind":     kind,
            "strength": round(strength, 2),
            "touches":  len(cluster),
        })

    return levels


# ─────────────────────────────────────────────────────────────────────────────
# MASTER DETECTOR
# ─────────────────────────────────────────────────────────────────────────────

def detect_all_patterns(
    df: pd.DataFrame,
    price_col: str = "Close",
    date_col: str = None,
    lookback_bars: int = 120,
    order: int = 5,
    prominence: float = 0.01
) -> dict:
    """
    Main entry point. Run ALL pattern detectors on a DataFrame.

    Args:
        df:            OHLCV DataFrame (must have Close column at minimum)
        price_col:     column name for price (default "Close")
        date_col:      column name for dates (used for display only)
        lookback_bars: only scan the most recent N bars
        order:         swing high/low sensitivity
        prominence:    peak detection sensitivity

    Returns:
        {
          "patterns":   [PatternResult, ...],    sorted by confidence desc
          "levels":     [{"level", "kind", "strength", "touches"}, ...],
          "summary":    str,                      plain-English summary
          "best":       PatternResult | None,     highest confidence pattern
        }
    """
    df = df.tail(lookback_bars).reset_index(drop=True).copy()
    prices = df[price_col].values.astype(float)
    dates  = df[date_col].values if date_col and date_col in df.columns else np.arange(len(prices))

    # Detect swing points
    peak_idx, trough_idx = find_peaks_scipy(prices, prominence=prominence, distance=order)

    all_patterns: list[PatternResult] = []

    # Run all detectors
    all_patterns += detect_head_and_shoulders(prices, peak_idx, trough_idx)
    all_patterns += detect_double_top_bottom(prices, peak_idx, trough_idx)
    all_patterns += detect_triangles(prices, dates, peak_idx, trough_idx)
    all_patterns += detect_flag(prices, peak_idx, trough_idx)
    all_patterns += detect_cup_and_handle(prices, peak_idx, trough_idx)

    # Sort by confidence descending
    all_patterns.sort(key=lambda p: p.confidence, reverse=True)

    # Support/resistance levels
    levels = detect_support_resistance(prices, peak_idx, trough_idx)

    # Build summary string
    best = all_patterns[0] if all_patterns else None
    if best:
        summary = (
            f"{best.emoji} {best.name} detected "
            f"({'confidence ' + str(int(best.confidence*100)) + '%'}). "
            f"{best.description}"
        )
    else:
        summary = "No significant chart patterns detected in current lookback window."

    return {
        "patterns": all_patterns,
        "levels":   levels,
        "summary":  summary,
        "best":     best,
        "peaks":    peak_idx,
        "troughs":  trough_idx,
    }


# ─────────────────────────────────────────────────────────────────────────────
# PLOTLY CHART DRAWING
# ─────────────────────────────────────────────────────────────────────────────

# Colour palette for different pattern directions
_COLOURS = {
    "bullish":  {"line": "#34d399", "fill": "rgba(52,211,153,0.08)",  "text": "#34d399"},
    "bearish":  {"line": "#fb7185", "fill": "rgba(251,113,133,0.08)", "text": "#fb7185"},
    "neutral":  {"line": "#fbbf24", "fill": "rgba(251,191,36,0.06)",  "text": "#fbbf24"},
}


def draw_patterns_on_chart(
    fig: go.Figure,
    pattern_result: dict,
    df: pd.DataFrame,
    price_col: str = "Close",
    max_patterns: int = 3,
    show_levels: bool = True,
    show_labels: bool = True,
) -> go.Figure:
    """
    Annotates a Plotly figure with detected patterns.
    Call AFTER building your base candlestick / line chart.

    Args:
        fig:             Plotly Figure (already has candlestick/line trace)
        pattern_result:  dict returned by detect_all_patterns()
        df:              same DataFrame used for detection
        price_col:       price column name
        max_patterns:    how many patterns to draw (top by confidence)
        show_levels:     whether to draw support/resistance lines
        show_labels:     whether to add text annotations

    Returns:
        Annotated Plotly Figure
    """
    patterns = pattern_result["patterns"][:max_patterns]
    levels   = pattern_result["levels"]
    prices   = df[price_col].values.astype(float)
    x_vals   = list(df.index)  # use integer indices for x-axis

    # ── DRAW SUPPORT / RESISTANCE LINES ──
    if show_levels:
        for lvl in levels:
            colour = "#34d399" if lvl["kind"] == "support" else "#fb7185"
            dash   = "dot" if lvl["strength"] < 0.5 else "dash"
            fig.add_hline(
                y=lvl["level"],
                line_dash=dash,
                line_color=colour,
                line_width=1,
                opacity=0.4 + lvl["strength"] * 0.4,
                annotation_text=(
                    f"  {'SUP' if lvl['kind']=='support' else 'RES'} "
                    f"₹{lvl['level']} ({lvl['touches']}T)"
                ),
                annotation_font_size=9,
                annotation_font_color=colour,
                annotation_position="right",
            )

    # ── DRAW EACH PATTERN ──
    for pattern in patterns:
        col = _COLOURS[pattern.direction]
        pts = pattern.key_points  # [(idx, price), ...]

        if len(pts) < 2:
            continue

        x_pts = [p[0] for p in pts]
        y_pts = [p[1] for p in pts]

        # Connect key points with dashed line
        fig.add_trace(go.Scatter(
            x=x_pts,
            y=y_pts,
            mode="lines+markers",
            line=dict(color=col["line"], width=1.5, dash="dot"),
            marker=dict(size=6, color=col["line"], symbol="circle"),
            name=f"{pattern.emoji} {pattern.name}",
            hovertemplate=(
                f"<b>{pattern.name}</b><br>"
                f"Confidence: {pattern.confidence*100:.0f}%<br>"
                f"{pattern.description}<extra></extra>"
            ),
            showlegend=True,
        ))

        # Shaded region under/over pattern
        if pattern.direction in ("bullish", "bearish"):
            fig.add_trace(go.Scatter(
                x=x_pts + x_pts[::-1],
                y=y_pts + [min(y_pts)] * len(y_pts) if pattern.direction == "bullish"
                  else y_pts + [max(y_pts)] * len(y_pts),
                fill="toself",
                fillcolor=col["fill"],
                line=dict(width=0),
                showlegend=False,
                hoverinfo="skip",
            ))

        # Neckline / breakout level horizontal line
        if pattern.breakout_level:
            x_start = pattern.start_idx
            x_end   = min(len(prices) - 1, pattern.end_idx + 10)
            fig.add_shape(
                type="line",
                x0=x_start, x1=x_end,
                y0=pattern.breakout_level, y1=pattern.breakout_level,
                line=dict(color=col["line"], width=1.5, dash="dash"),
            )

        # Target price arrow annotation
        if pattern.target_price and show_labels:
            arrow_colour = col["text"]
            fig.add_annotation(
                x=pattern.end_idx,
                y=pattern.target_price,
                text=(
                    f"  🎯 {pattern.name}<br>"
                    f"  Target: ₹{pattern.target_price:.0f}<br>"
                    f"  Conf: {pattern.confidence*100:.0f}%"
                ),
                showarrow=True,
                arrowhead=2,
                arrowsize=1,
                arrowwidth=1.5,
                arrowcolor=arrow_colour,
                font=dict(size=10, color=arrow_colour),
                bgcolor="rgba(7,9,26,0.85)",
                bordercolor=arrow_colour,
                borderwidth=1,
                borderpad=5,
            )

    return fig


# ─────────────────────────────────────────────────────────────────────────────
# TFT CONFLUENCE ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def get_confluence_message(
    tft_action: str,          # "BUY" | "SELL" | "HOLD"
    tft_confidence: float,    # 0.0 – 1.0
    pattern_result: dict,
) -> dict:
    """
    Combines TFT signal with pattern detection for a confluence score
    and plain-English explanation.

    Returns:
        {
          "final_action":     str,    # may override TFT signal
          "confluence_score": float,  # 0.0 – 1.0
          "message":          str,    # human-readable explanation
          "boost":            bool,   # True if pattern confirms TFT
          "conflict":         bool,   # True if pattern contradicts TFT
        }
    """
    best = pattern_result.get("best")

    if best is None:
        return {
            "final_action":     tft_action,
            "confluence_score": tft_confidence,
            "message":          f"TFT Signal: {tft_action} (conf {tft_confidence:.0%}). No chart pattern detected.",
            "boost":            False,
            "conflict":         False,
        }

    # Map pattern direction to action
    pattern_action_map = {
        "bullish":  "BUY",
        "bearish":  "SELL",
        "neutral":  "HOLD",
    }
    pattern_action = pattern_action_map[best.direction]

    agrees  = pattern_action == tft_action and tft_action != "HOLD"
    opposes = (
        (pattern_action == "BUY"  and tft_action == "SELL") or
        (pattern_action == "SELL" and tft_action == "BUY")
    )

    if agrees:
        # CONFLUENCE — boost confidence
        boosted = min(1.0, tft_confidence + best.confidence * 0.15)
        msg = (
            f"✅ TFT says {tft_action} + {best.emoji} {best.name} breakout — "
            f"STRONG CONFLUENCE. "
            f"Confidence boosted to {boosted:.0%}. "
            f"Pattern target: ₹{best.target_price:.0f}." if best.target_price else
            f"✅ TFT says {tft_action} + {best.emoji} {best.name} — STRONG CONFLUENCE. "
            f"Confidence boosted to {boosted:.0%}."
        )
        return {
            "final_action":     tft_action,
            "confluence_score": boosted,
            "message":          msg,
            "boost":            True,
            "conflict":         False,
        }

    elif opposes:
        # CONFLICT — downgrade to HOLD
        msg = (
            f"⚠️ TFT says {tft_action} but {best.emoji} {best.name} "
            f"suggests {pattern_action}. CONFLICTING signals — downgrading to HOLD. "
            f"Wait for resolution."
        )
        return {
            "final_action":     "HOLD",
            "confluence_score": 0.5,
            "message":          msg,
            "boost":            False,
            "conflict":         True,
        }

    else:
        # Pattern is neutral or TFT is HOLD
        msg = (
            f"TFT Signal: {tft_action} (conf {tft_confidence:.0%}). "
            f"{best.emoji} {best.name} detected ({best.confidence:.0%}) — "
            f"neutral pattern, no confluence adjustment."
        )
        return {
            "final_action":     tft_action,
            "confluence_score": tft_confidence,
            "message":          msg,
            "boost":            False,
            "conflict":         False,
        }


# ─────────────────────────────────────────────────────────────────────────────
# STREAMLIT INTEGRATION HELPER
# ─────────────────────────────────────────────────────────────────────────────

def render_pattern_panel_streamlit(pattern_result: dict, confluence: dict):
    """
    Drop-in Streamlit display block.
    Call after detect_all_patterns() and get_confluence_message().

    Usage in your Streamlit page:
        result = detect_all_patterns(df)
        conf   = get_confluence_message("BUY", 0.81, result)
        render_pattern_panel_streamlit(result, conf)
    """
    try:
        import streamlit as st
    except ImportError:
        print("Streamlit not installed — skipping render.")
        return

    patterns = pattern_result["patterns"]
    best     = pattern_result["best"]

    # ── CONFLUENCE MESSAGE BANNER ──
    if confluence["conflict"]:
        st.markdown(
            f"""<div style="background:rgba(251,113,133,0.1);border:1px solid rgba(251,113,133,0.3);
            border-radius:10px;padding:14px 18px;font-size:14px;color:#fb7185;line-height:1.6">
            {confluence['message']}</div>""",
            unsafe_allow_html=True
        )
    elif confluence["boost"]:
        st.markdown(
            f"""<div style="background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.2);
            border-left:3px solid #34d399;border-radius:10px;padding:14px 18px;
            font-size:14px;color:#34d399;line-height:1.6">
            {confluence['message']}</div>""",
            unsafe_allow_html=True
        )
    else:
        st.markdown(
            f"""<div style="background:rgba(56,189,248,0.05);border:1px solid rgba(56,189,248,0.15);
            border-radius:10px;padding:14px 18px;font-size:14px;color:#38bdf8;line-height:1.6">
            {confluence['message']}</div>""",
            unsafe_allow_html=True
        )

    st.markdown("<br>", unsafe_allow_html=True)

    # ── PATTERN LIST ──
    if not patterns:
        st.caption("No patterns detected in the current lookback window.")
        return

    st.markdown(
        """<div style="font-family:'Share Tech Mono',monospace;font-size:9px;
        color:#4a5580;letter-spacing:3px;text-transform:uppercase;margin-bottom:12px">
        // DETECTED PATTERNS</div>""",
        unsafe_allow_html=True
    )

    for p in patterns[:4]:
        dir_colour = {"bullish": "#34d399", "bearish": "#fb7185", "neutral": "#fbbf24"}[p.direction]
        target_str = f"· Target ₹{p.target_price:.0f}" if p.target_price else ""
        st.markdown(
            f"""<div style="background:rgba(11,13,34,0.8);border:1px solid rgba(30,36,72,0.8);
            border-left:3px solid {dir_colour};border-radius:8px;padding:12px 16px;
            margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-size:14px;font-weight:600;color:{dir_colour}">{p.emoji} {p.name}</span>
              <span style="font-family:'Share Tech Mono',monospace;font-size:11px;
                color:{dir_colour};background:rgba(52,211,153,0.08);
                padding:2px 8px;border-radius:10px">{p.confidence*100:.0f}%</span>
            </div>
            <div style="font-size:12px;color:rgba(226,232,255,0.55);line-height:1.6">
              {p.description} {target_str}
            </div></div>""",
            unsafe_allow_html=True
        )
