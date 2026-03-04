"""
frac_diff.py
============
Apex AI — Phase 2: Fractional Differentiation Engine
------------------------------------------------------
Implements Lopez de Prado's Fixed-Width Window (FFD) fractional
differentiation from "Advances in Financial Machine Learning" (Chapter 5).

MOTIVATION
----------
Standard integer differencing (log-returns, Δp) destroys the long-range
memory embedded in price series — the very autocorrelation a TFT model
relies on. Fractional differencing with order d ∈ (0, 1) is a middle
ground:
  • d = 0   → raw prices (non-stationary, full memory)
  • d = 1   → standard returns (stationary, zero memory)
  • d = 0.4 → stationary, maximum memory preserved  ← we want this

The key insight: find the minimum d such that the ADF test rejects the
unit-root null (p < 0.05) while keeping d as small as possible.

API
---
    get_weights_ffd(d, thres)          → np.ndarray  (FFD weight vector)
    frac_diff_ffd(series_df, d, thres) → pd.DataFrame (differenced series)
    find_min_d(series, d_range, thres) → float       (optimal d)
    apply_to_dataframe(df, d)          → pd.DataFrame (adds Close_fracdiff)

Packages required: numpy, pandas, statsmodels, matplotlib
Author : Apex AI Team  (based on López de Prado 2018, Chapter 5)
"""

from __future__ import annotations

import logging
import os
from typing import Optional

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from statsmodels.tsa.stattools import adfuller

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("apex_ai.frac_diff")


# ---------------------------------------------------------------------------
# 1. get_weights_ffd
# ---------------------------------------------------------------------------
def get_weights_ffd(d: float, thres: float = 0.01) -> np.ndarray:
    """Compute Fixed-Width Window FFD weights for differencing order *d*.

    The binomial series expansion of the lag operator (1-L)^d gives weights:

        w_k = -w_{k-1} * (d - k + 1) / k      for k = 1, 2, 3, …

    FFD stops adding weights once |w_k| < *thres*, bounding the window
    length.  This avoids the expanding-window problem of standard FD (which
    would use ALL past observations for each point).

    Parameters
    ----------
    d : float
        Differencing order, typically in (0, 1).
    thres : float, optional
        Weight magnitude cutoff.  Smaller = longer window, more memory
        preserved.  Defaults to ``0.01``.

    Returns
    -------
    np.ndarray
        1-D array of weights ``[w_0, w_1, …, w_k]`` in reverse-lag order
        (w_0 = 1 at lag-0, w_k = smallest weight farthest in the past).
        Ready to be dot-product'd with a sliding window of prices.

    Examples
    --------
    >>> w = get_weights_ffd(0.4, thres=0.01)
    >>> len(w)   # fixed window length
    12
    """
    # w_0 = 1 always (the current observation contributes 100%)
    w = [1.0]
    k = 1
    while True:
        # Recurrence: w_k = -w_{k-1} * (d - k + 1) / k
        w_k = -w[-1] * (d - k + 1) / k
        if abs(w_k) < thres:
            break
        w.append(w_k)
        k += 1

    weights = np.array(w[::-1])   # reverse: oldest lag first (for convolution)
    logger.debug("get_weights_ffd: d=%.2f, window_len=%d, thres=%.4f", d, len(weights), thres)
    return weights


# ---------------------------------------------------------------------------
# 2. frac_diff_ffd
# ---------------------------------------------------------------------------
def frac_diff_ffd(
    series_df: pd.DataFrame,
    d: float,
    thres: float = 0.01,
) -> pd.DataFrame:
    """Apply FFD fractional differentiation to all columns of *series_df*.

    For each column and each valid row, computes the dot product of the
    FFD weight vector ``w`` and the corresponding window of lagged values.
    Rows without a full warm-up window are set to NaN.

    Parameters
    ----------
    series_df : pd.DataFrame
        DataFrame with one or more numeric price columns (e.g. ``Close``
        or ``Close_denoised``).  Index should be a DatetimeIndex.
    d : float
        Fractional differencing order, typically in (0, 1).
    thres : float, optional
        Weight magnitude threshold forwarded to :func:`get_weights_ffd`.

    Returns
    -------
    pd.DataFrame
        Same shape as *series_df*, columns unchanged.  The first
        ``len(w) - 1`` rows contain NaN (warm-up / burn-in period).

    Notes
    -----
    Implementation follows Algorithm 5.3 in López de Prado (2018).
    Using FFD rather than standard FD ensures the window length is
    **fixed**, making the operation stationary in its own right.
    """
    w = get_weights_ffd(d, thres)
    width = len(w) - 1    # number of lagged observations required

    result_dict: dict[str, list] = {col: [] for col in series_df.columns}

    for col in series_df.columns:
        series = series_df[col].values.astype(float)
        n = len(series)
        col_vals: list[float] = []

        for i in range(n):
            if i < width:
                # Not enough history yet — warm-up rows
                col_vals.append(np.nan)
            else:
                # Window: lagged values from (i-width) to i inclusive
                window = series[i - width : i + 1]
                if np.any(np.isnan(window)):
                    # Skip rows with NaN in the window
                    col_vals.append(np.nan)
                else:
                    # Dot product: Σ w_k * price_{i-k}
                    col_vals.append(float(np.dot(w, window)))

        result_dict[col] = col_vals

    result = pd.DataFrame(result_dict, index=series_df.index)
    n_valid = result.notna().all(axis=1).sum()
    logger.info(
        "frac_diff_ffd: d=%.2f, window=%d, valid_rows=%d/%d",
        d, width, n_valid, len(series_df),
    )
    return result


# ---------------------------------------------------------------------------
# 3. find_min_d
# ---------------------------------------------------------------------------
def find_min_d(
    series: pd.Series,
    d_range: Optional[list[float]] = None,
    thres: float = 0.01,
    plot: bool = True,
    save_plot: bool = True,
) -> float:
    """Grid-search the minimum differencing order *d* that achieves stationarity.

    For each candidate *d*, applies FFD and runs an Augmented Dickey-Fuller
    test.  The minimum *d* where p-value < 0.05 (i.e. the ADF null of a
    unit root is rejected) is returned as the "optimal" differencing order.

    Parameters
    ----------
    series : pd.Series
        Raw or wavelet-denoised closing-price series.
    d_range : list[float], optional
        Candidate d values to search.  Defaults to ``[0.1, 0.2, …, 1.0]``.
    thres : float, optional
        FFD weight cutoff forwarded to :func:`get_weights_ffd`.
    plot : bool, optional
        If True, renders a d vs ADF p-value chart.  Defaults to True.
    save_plot : bool, optional
        If True *and* ``plot=True``, saves the chart to
        ``plots/find_min_d.png``.

    Returns
    -------
    float
        Optimal (minimum stationary) d, or ``1.0`` if none found.

    Prints
    ------
    A formatted table:  d | ADF stat | p-value | Stationary?
    """
    if d_range is None:
        d_range = [round(x, 1) for x in np.arange(0.1, 1.1, 0.1)]

    df_in = pd.DataFrame({"price": series.values}, index=series.index)

    results: list[dict] = []
    optimal_d = 1.0

    # ── Header ──────────────────────────────────────────────────────────────
    header = f"{'d':>6} | {'ADF stat':>10} | {'p-value':>9} | Stationary?"
    print(f"\n{'─'*len(header)}")
    print(header)
    print(f"{'─'*len(header)}")

    for d in d_range:
        try:
            diff_df = frac_diff_ffd(df_in, d=d, thres=thres)
            diff_clean = diff_df["price"].dropna()

            if len(diff_clean) < 20:
                continue

            adf_stat, pvalue, *_ = adfuller(diff_clean, autolag="AIC")
            stationary = pvalue < 0.05
            tag = "✅ YES" if stationary else "❌ NO "

            print(f"{d:>6.1f} | {adf_stat:>10.4f} | {pvalue:>9.4f} | {tag}")
            results.append({"d": d, "adf_stat": adf_stat, "pvalue": pvalue, "stationary": stationary})

            if stationary and d < optimal_d:
                optimal_d = d

        except Exception as exc:
            logger.warning("find_min_d: error at d=%.1f — %s", d, exc)

    print(f"{'─'*len(header)}")
    print(f"\n  ➜ Optimal minimum d = {optimal_d:.1f}\n")
    logger.info("find_min_d complete — optimal_d=%.1f", optimal_d)

    # ── Plot d vs p-value ────────────────────────────────────────────────────
    if plot and results:
        ds = [r["d"] for r in results]
        pvals = [r["pvalue"] for r in results]

        fig, ax = plt.subplots(figsize=(10, 4))
        ax.set_facecolor("#0d0d0d")
        fig.patch.set_facecolor("#0d0d0d")

        # p-value curve
        ax.plot(ds, pvals, color="#00d2aa", linewidth=2.5, marker="o",
                markersize=7, markerfacecolor="#ffffff", label="ADF p-value")

        # Significance threshold at p = 0.05
        ax.axhline(0.05, color="#ff3366", linewidth=1.8, linestyle="--",
                   label="Significance threshold (p = 0.05)")

        # Shade the stationary region
        ax.fill_between(ds, pvals, 0.05,
                        where=[p < 0.05 for p in pvals],
                        alpha=0.15, color="#00d2aa", label="Stationary region")

        # Mark optimal d
        ax.axvline(optimal_d, color="#ffcc00", linewidth=1.5, linestyle=":",
                   label=f"Optimal d = {optimal_d:.1f}")

        ax.set_xlabel("Differencing order d", color="#aaaaaa", fontsize=11)
        ax.set_ylabel("ADF p-value", color="#aaaaaa", fontsize=11)
        ax.set_title("Fractional Differentiation — ADF p-value vs d", 
                     color="white", fontsize=14, fontweight="bold", pad=12)
        ax.tick_params(colors="#aaaaaa", labelsize=9)
        for spine in ax.spines.values():
            spine.set_edgecolor("#333333")
        ax.grid(color="#222222", linestyle="--", linewidth=0.5, alpha=0.7)

        legend = ax.legend(fontsize=9, facecolor="#1a1a1a", edgecolor="#333333")
        for text in legend.get_texts():
            text.set_color("white")

        plt.tight_layout()
        if save_plot:
            os.makedirs("plots", exist_ok=True)
            path = os.path.join("plots", "find_min_d.png")
            plt.savefig(path, dpi=150, bbox_inches="tight",
                        facecolor=fig.get_facecolor())
            logger.info("d vs p-value plot saved → %s", os.path.abspath(path))
            print(f"  Plot saved → {os.path.abspath(path)}")
        plt.show()
        plt.close(fig)

    return optimal_d


# ---------------------------------------------------------------------------
# 4. apply_to_dataframe
# ---------------------------------------------------------------------------
def apply_to_dataframe(df: pd.DataFrame, d: float = 0.4) -> pd.DataFrame:
    """Apply FFD fractional differentiation to ``df['Close_denoised']``.

    Selects ``df['Close_denoised']`` (the wavelet-denoised target produced
    by ``utils.denoising.apply_denoising_to_dataframe``), applies FFD with
    differencing order *d*, and stores the result as ``df['Close_fracdiff']``.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain a ``'Close_denoised'`` column.  If absent, falls back
        to ``'Close'`` with a warning.
    d : float, optional
        Fractional differencing order.  Defaults to ``0.4`` — a reasonable
        starting point for most equity price series per López de Prado.

    Returns
    -------
    pd.DataFrame
        Copy of *df* with new column ``'Close_fracdiff'``.
        Rows lost to the FFD warm-up window are left as NaN.

    Prints
    ------
    Number of rows lost to warm-up / retained.
    """
    df = df.copy()

    if "Close_denoised" in df.columns:
        source_col = "Close_denoised"
    elif "Close" in df.columns:
        logger.warning(
            "apply_to_dataframe: 'Close_denoised' not found — falling back to 'Close'. "
            "Run utils.denoising.apply_denoising_to_dataframe first for best results."
        )
        source_col = "Close"
    else:
        raise KeyError("apply_to_dataframe: DataFrame must contain 'Close_denoised' or 'Close'.")

    n_before = len(df)
    diff_df = frac_diff_ffd(df[[source_col]], d=d)
    df["Close_fracdiff"] = diff_df[source_col].values

    n_nan = df["Close_fracdiff"].isna().sum()
    n_valid = n_before - n_nan

    print(
        f"\n  Fractional Differentiation (d={d:.2f}) applied to '{source_col}':\n"
        f"    Total rows     : {n_before}\n"
        f"    Warm-up lost   : {n_nan}  (FFD window = {n_nan} observations)\n"
        f"    Usable rows    : {n_valid}\n"
    )
    logger.info(
        "apply_to_dataframe: d=%.2f, source='%s', rows_before=%d, valid=%d",
        d, source_col, n_before, n_valid,
    )
    return df


# ---------------------------------------------------------------------------
# __main__ — run find_min_d on synthetic AAPL-like price series
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"\n{'='*62}")
    print("  Apex AI — frac_diff.py smoke test")
    print(f"{'='*62}\n")

    # Try to load real AAPL data; fall back to synthetic if no network
    try:
        import yfinance as yf
        print("  Fetching AAPL close prices from Yahoo Finance…")
        raw = yf.download("AAPL", period="5y", interval="1d",
                          progress=False, auto_adjust=True)
        price_series = raw["Close"].dropna().squeeze()
        price_series.name = "AAPL"
        print(f"  Loaded {len(price_series)} rows of real AAPL data.\n")
    except Exception as exc:
        print(f"  yfinance unavailable ({exc}). Using synthetic data.\n")
        np.random.seed(0)
        n = 500
        # Random walk (non-stationary by construction — perfect test case)
        price_series = pd.Series(
            100 + np.cumsum(np.random.randn(n) * 0.5),
            index=pd.date_range("2020-01-01", periods=n, freq="B"),
            name="SYNTHETIC",
        )

    # ── 1. Weight vector quick-check ──────────────────────────────────────
    print("▶ get_weights_ffd(d=0.4) …")
    w = get_weights_ffd(d=0.4, thres=0.01)
    print(f"  Window length : {len(w)}")
    print(f"  Weights (first 5): {w[:5].round(5)}\n")

    # ── 2. Single-d FFD check ─────────────────────────────────────────────
    print("▶ frac_diff_ffd(d=0.4) …")
    df_price = pd.DataFrame({"price": price_series.values}, index=price_series.index)
    diff_result = frac_diff_ffd(df_price, d=0.4)
    n_valid = diff_result["price"].notna().sum()
    print(f"  Output shape  : {diff_result.shape}")
    print(f"  Valid rows    : {n_valid}")
    print(f"  Head (5 rows):\n{diff_result.dropna().head()}\n")

    # ── 3. find_min_d grid search ─────────────────────────────────────────
    print("▶ find_min_d(d_range=[0.1 … 1.0]) …")
    optimal = find_min_d(price_series, plot=True, save_plot=True)
    print(f"  Returned optimal d = {optimal}\n")

    # ── 4. apply_to_dataframe ─────────────────────────────────────────────
    print("▶ apply_to_dataframe(d=optimal) …")
    # Emulate having Close_denoised already in the DataFrame
    test_df = pd.DataFrame({
        "Close":          price_series.values,
        "Close_denoised": price_series.values,   # same as raw for this test
    }, index=price_series.index)

    enriched = apply_to_dataframe(test_df, d=optimal if optimal < 1.0 else 0.4)
    assert "Close_fracdiff" in enriched.columns, "❌ Column not added!"
    print(f"  ✅ 'Close_fracdiff' column added.")
    print(f"  Shape  : {enriched.shape}")
    print(f"  Sample :\n{enriched[['Close','Close_denoised','Close_fracdiff']].dropna().head()}\n")

    print(f"{'='*62}")
    print("  Smoke test complete.")
    print(f"{'='*62}\n")
