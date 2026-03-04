"""
denoising.py
============
Apex AI — Phase 2: Signal Denoising & Stationarity Engine
----------------------------------------------------------
Provides four functions for transforming raw closing prices into a
clean, stationary target series suitable for Temporal Fusion Transformer
training:

    1. wavelet_denoise          — DWT-based trend extraction (remove noise)
    2. run_adf_test             — Augmented Dickey-Fuller stationarity gate
    3. plot_denoising_comparison — Visual sanity-check (raw vs denoised)
    4. apply_denoising_to_dataframe — Pipeline-friendly wrapper

Packages required:
    pip install PyWavelets statsmodels matplotlib

Author : Apex AI Team
"""

from __future__ import annotations

import logging
import os
from typing import Any

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import pywt
from statsmodels.tsa.stattools import adfuller

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("apex_ai.denoising")


# ---------------------------------------------------------------------------
# 1. wavelet_denoise
# ---------------------------------------------------------------------------
def wavelet_denoise(
    series: pd.Series,
    wavelet: str = "db4",
    level: int = 3,
) -> pd.Series:
    """Denoise a price series with Discrete Wavelet Transform (DWT).

    Decomposes *series* into one approximation sub-band and *level* detail
    sub-bands using ``pywt.wavedec``.  **All detail coefficients are zeroed
    out**, retaining only the low-frequency approximation (trend).  The
    signal is then reconstructed with ``pywt.waverec`` and trimmed to the
    original length.

    Parameters
    ----------
    series : pd.Series
        Closing-price series (or any real-valued financial time series).
        Must not be empty.
    wavelet : str, optional
        PyWavelets wavelet family and order.  ``'db4'`` (Daubechies 4) is
        recommended for financial data.  Defaults to ``'db4'``.
    level : int, optional
        Decomposition depth.  Higher = smoother output but more lag.
        Defaults to ``3``.

    Returns
    -------
    pd.Series
        Reconstructed (denoised) series with the **same index and name** as
        the input.  Length is identical to the input — assertion guaranteed.

    Raises
    ------
    ValueError
        If *series* is empty or contains only NaN values.
    """
    if series.empty or series.isna().all():
        raise ValueError("wavelet_denoise received an empty or all-NaN series.")

    original_index = series.index
    original_len = len(series)

    # Forward-fill any interior NaNs so PyWavelets gets a clean array
    values: np.ndarray = series.ffill().bfill().to_numpy(dtype=float)

    # ── DWT decomposition ──────────────────────────────────────────────────
    max_level = pywt.dwt_max_level(len(values), wavelet)
    level = min(level, max_level)
    logger.info(
        "wavelet_denoise: wavelet=%s, requested_level=%d, effective_level=%d, n=%d",
        wavelet, level, level, original_len,
    )

    coeffs = pywt.wavedec(values, wavelet=wavelet, level=level)

    # ── Zero ALL detail coefficients (indices 1 … level) ──────────────────
    for i in range(1, len(coeffs)):
        coeffs[i] = np.zeros_like(coeffs[i])

    # ── Reconstruct & trim to original length ──────────────────────────────
    reconstructed = pywt.waverec(coeffs, wavelet=wavelet)
    denoised = reconstructed[:original_len]

    assert len(denoised) == original_len, (
        f"Length mismatch after reconstruction: got {len(denoised)}, "
        f"expected {original_len}."
    )

    result = pd.Series(denoised, index=original_index, name=series.name)
    logger.info("wavelet_denoise complete — output length matches input (%d).", original_len)
    return result


# ---------------------------------------------------------------------------
# 2. run_adf_test
# ---------------------------------------------------------------------------
def run_adf_test(series: pd.Series) -> dict[str, Any]:
    """Run an Augmented Dickey-Fuller test and return a structured report.

    The ADF test checks the null hypothesis that the series has a unit root
    (i.e. is **non-stationary**).  A p-value below 0.05 rejects the null,
    meaning the series **is** stationary.

    Parameters
    ----------
    series : pd.Series
        The time series to test.  NaNs are dropped before testing.

    Returns
    -------
    dict with keys:
        ``stationary`` : bool
            True if p-value < 0.05.
        ``pvalue`` : float
            ADF test p-value (4 decimal places).
        ``adf_stat`` : float
            ADF test statistic (4 decimal places).
        ``critical_values`` : dict[str, float]
            Critical values at 1 %, 5 %, and 10 % significance levels.
        ``n_lags_used`` : int
            Number of lags chosen automatically by the test.

    Notes
    -----
    Uses ``autolag='AIC'`` so the optimal number of lags is selected
    automatically via the Akaike Information Criterion.
    """
    clean = series.dropna()
    if len(clean) < 20:
        logger.warning("ADF test: series too short (%d observations). Results unreliable.", len(clean))

    adf_result = adfuller(clean, autolag="AIC")
    adf_stat, pvalue, n_lags, _, critical_values, _ = adf_result

    stationary = bool(pvalue < 0.05)
    report: dict[str, Any] = {
        "stationary": stationary,
        "pvalue": round(float(pvalue), 4),
        "adf_stat": round(float(adf_stat), 4),
        "critical_values": {k: round(v, 4) for k, v in critical_values.items()},
        "n_lags_used": n_lags,
    }

    # Human-readable interpretation
    if stationary:
        interpretation = (
            f"✅  Series IS stationary (p={pvalue:.4f} < 0.05). "
            f"ADF stat={adf_stat:.4f}."
        )
    else:
        interpretation = (
            f"⚠️  Series is NOT stationary (p={pvalue:.4f} ≥ 0.05). "
            f"ADF stat={adf_stat:.4f}. Consider fractional differencing."
        )
    print(interpretation)
    logger.info("ADF test: stationary=%s, p=%.4f, adf_stat=%.4f", stationary, pvalue, adf_stat)
    return report


# ---------------------------------------------------------------------------
# 3. plot_denoising_comparison
# ---------------------------------------------------------------------------
def plot_denoising_comparison(
    raw: pd.Series,
    denoised: pd.Series,
    ticker: str,
) -> str:
    """Plot raw vs denoised closing prices and save to disk.

    Parameters
    ----------
    raw : pd.Series
        Original closing price series.
    denoised : pd.Series
        Wavelet-denoised series returned by :func:`wavelet_denoise`.
    ticker : str
        Ticker symbol used for the plot title and filename.

    Returns
    -------
    str
        Absolute path to the saved PNG file.

    Notes
    -----
    * Saves to ``plots/<ticker>_denoised.png`` relative to the current
      working directory.  The ``plots/`` directory is created automatically.
    * Raw series: thin gray line (alpha=0.7).
    * Denoised series: thick green line (#00d2aa, Apex AI brand colour).
    """
    os.makedirs("plots", exist_ok=True)
    save_path = os.path.join("plots", f"{ticker}_denoised.png")

    fig, ax = plt.subplots(figsize=(14, 5))
    ax.set_facecolor("#0d0d0d")
    fig.patch.set_facecolor("#0d0d0d")

    ax.plot(
        raw.index, raw.values,
        color="#888888", linewidth=0.8, alpha=0.7,
        label=f"{ticker} — Raw Close",
    )
    ax.plot(
        denoised.index, denoised.values,
        color="#00d2aa", linewidth=2.5,
        label=f"{ticker} — Denoised (DWT Trend)",
    )

    ax.set_title(
        f"Wavelet Denoising — {ticker}",
        fontsize=16, fontweight="bold", color="white", pad=15,
    )
    ax.set_xlabel("Date", color="#aaaaaa", fontsize=11)
    ax.set_ylabel("Price", color="#aaaaaa", fontsize=11)
    ax.tick_params(colors="#aaaaaa", labelsize=9)
    for spine in ax.spines.values():
        spine.set_edgecolor("#333333")
    ax.grid(color="#222222", linestyle="--", linewidth=0.5, alpha=0.8)

    legend = ax.legend(fontsize=10, facecolor="#1a1a1a", edgecolor="#333333")
    for text in legend.get_texts():
        text.set_color("white")

    plt.tight_layout()
    plt.savefig(save_path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)

    logger.info("Plot saved → %s", os.path.abspath(save_path))
    return os.path.abspath(save_path)


# ---------------------------------------------------------------------------
# 4. apply_denoising_to_dataframe
# ---------------------------------------------------------------------------
def apply_denoising_to_dataframe(
    df: pd.DataFrame,
    wavelet: str = "db4",
    level: int = 3,
    run_stationarity_check: bool = True,
) -> pd.DataFrame:
    """Apply wavelet denoising to a DataFrame's Close column in-place.

    Convenience wrapper that chains :func:`wavelet_denoise` and optionally
    :func:`run_adf_test` to produce a pipeline-ready DataFrame with a new
    ``Close_denoised`` column — the target series for TFT training.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain a ``'Close'`` column.
    wavelet : str, optional
        Forwarded to :func:`wavelet_denoise`. Defaults to ``'db4'``.
    level : int, optional
        Forwarded to :func:`wavelet_denoise`. Defaults to ``3``.
    run_stationarity_check : bool, optional
        If True, runs an ADF test on ``Close_denoised`` and prints the
        result. Defaults to True.

    Returns
    -------
    pd.DataFrame
        A copy of *df* with the extra column ``'Close_denoised'``.

    Raises
    ------
    KeyError
        If *df* does not contain a ``'Close'`` column.
    """
    if "Close" not in df.columns:
        raise KeyError("apply_denoising_to_dataframe: DataFrame must have a 'Close' column.")

    df = df.copy()

    logger.info("Applying wavelet denoising to 'Close' column (%d rows)…", len(df))
    df["Close_denoised"] = wavelet_denoise(df["Close"], wavelet=wavelet, level=level)

    # Length assertion
    assert len(df["Close_denoised"]) == len(df), (
        f"Close_denoised length {len(df['Close_denoised'])} != DataFrame length {len(df)}."
    )

    if run_stationarity_check:
        logger.info("Running ADF stationarity test on 'Close_denoised'…")
        run_adf_test(df["Close_denoised"])

    logger.info(
        "apply_denoising_to_dataframe complete — shape=%s, NaN in Close_denoised=%d",
        df.shape,
        df["Close_denoised"].isna().sum(),
    )
    return df


# ---------------------------------------------------------------------------
# __main__ — smoke-test with synthetic sine + Gaussian noise
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import pprint

    print(f"\n{'='*62}")
    print("  Apex AI — denoising.py smoke test (synthetic data)")
    print(f"{'='*62}\n")

    # ── Generate synthetic data: trend + noise ─────────────────────────────
    np.random.seed(42)
    n = 500
    t = np.linspace(0, 4 * np.pi, n)
    trend = 100 + 15 * np.sin(t) + 0.05 * np.arange(n)   # sine drift
    noise = np.random.normal(0, 3, n)                       # Gaussian noise
    synthetic_close = pd.Series(
        trend + noise,
        index=pd.date_range("2022-01-01", periods=n, freq="B"),
        name="Close",
    )

    print(f"Synthetic series length : {len(synthetic_close)}")

    # ── 1. Wavelet denoise ─────────────────────────────────────────────────
    print("\n▶ wavelet_denoise …")
    denoised = wavelet_denoise(synthetic_close, wavelet="db4", level=3)
    assert len(denoised) == len(synthetic_close), "❌ Length mismatch!"
    print(f"  ✅ Output length matches input: {len(denoised)} == {len(synthetic_close)}")
    print(f"  Head: {denoised.head(3).values.round(4)}")

    # ── 2. ADF test ────────────────────────────────────────────────────────
    print("\n▶ run_adf_test (on raw — non-stationary expected) …")
    report_raw = run_adf_test(synthetic_close)

    print("\n▶ run_adf_test (on denoised — may or may not be stationary) …")
    report_denoised = run_adf_test(denoised)
    print("\n  ADF report (denoised):")
    pprint.pprint(report_denoised, indent=4)

    # ── 3. Plot ────────────────────────────────────────────────────────────
    print("\n▶ plot_denoising_comparison …")
    saved = plot_denoising_comparison(synthetic_close, denoised, ticker="SYNTHETIC")
    print(f"  Plot saved → {saved}")

    # ── 4. DataFrame wrapper ───────────────────────────────────────────────
    print("\n▶ apply_denoising_to_dataframe …")
    test_df = pd.DataFrame({"Close": synthetic_close})
    enriched = apply_denoising_to_dataframe(test_df, wavelet="db4", level=3)
    assert "Close_denoised" in enriched.columns, "❌ Column not added!"
    assert len(enriched["Close_denoised"]) == len(test_df), "❌ Length mismatch in DataFrame!"
    print(f"  ✅ 'Close_denoised' column added successfully.")
    print(f"  Shape: {enriched.shape}")
    print(f"\n  Head (5 rows):\n{enriched[['Close','Close_denoised']].head()}\n")

    print(f"{'='*62}")
    print("  All assertions passed. Smoke test complete.")
    print(f"{'='*62}\n")
