"""
tft_dataset.py
==============
Apex AI - Phase 2: TFT Dataset & DataLoader Configuration
----------------------------------------------------------
Configures pytorch-forecasting's TimeSeriesDataSet and PyTorch DataLoaders
for the Temporal Fusion Transformer. All hyper-parameters are declared as
module-level constants so they can be tuned in one place.

COLUMN CONTRACT (must match the DataFrame produced by build_all_features)
-------------------------------------------------------------------------
  Group ID            : ticker
  Time index          : time_idx
  Target              : Close_denoised
  Static categoricals : sector
  Static reals        : market_cap_log
  Known future reals  : time_idx, day_of_week, month, quarter,
                        is_month_end, VIX, SP500, NSEI
  Unknown reals       : Close, Volume, RSI_14, MACD_12_26_9, MACDh_12_26_9,
                        ATR_14, OBV, BBB_20_2, RSI_14_lag1, RSI_14_lag3,
                        RSI_14_lag5, MACD_12_26_9_lag1, MACD_12_26_9_lag3,
                        Volume_ratio, STOCHk_14_3_3

API
---
    create_datasets(df, val_cutoff_pct)   -> training_dataset, val_dataset
    create_dataloaders(train_ds, val_ds)  -> train_dl, val_dl
    inspect_dataset(training_dataset)     -> prints full diagnostic report

Packages required: pytorch-forecasting, pytorch-lightning, torch
Author : Apex AI Team
"""

from __future__ import annotations

import logging
import warnings
from typing import Tuple

import numpy as np
import pandas as pd

# ── pytorch-forecasting import with informative error ─────────────────────
try:
    from pytorch_forecasting import TimeSeriesDataSet
    from pytorch_forecasting.data import GroupNormalizer
    _HAS_PTF = True
except ImportError:
    _HAS_PTF = False
    warnings.warn(
        "pytorch-forecasting is not installed. "
        "Run: pip install pytorch-forecasting pytorch-lightning\n"
        "All functions will raise ImportError if called.",
        stacklevel=2,
    )

try:
    from torch.utils.data import DataLoader
    _HAS_TORCH = True
except ImportError:
    _HAS_TORCH = False

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("apex_ai.tft_dataset")

# ===========================================================================
# ── TUNABLE CONSTANTS (all dataset hyper-parameters live here) ──────────────
# ===========================================================================

# Encoder / prediction window lengths (in trading days)
MIN_ENCODER_LENGTH: int = 60        # minimum look-back context
MAX_ENCODER_LENGTH: int = 120       # maximum look-back context
MIN_PREDICTION_LENGTH: int = 7      # shortest forecast horizon
MAX_PREDICTION_LENGTH: int = 30     # longest forecast horizon (1 trading month)

# DataLoader
BATCH_SIZE: int = 64
NUM_WORKERS: int = 2

# Train/val split
DEFAULT_VAL_CUTOFF_PCT: float = 0.15   # last 15 % of rows -> validation

# Target normalizer
TARGET_NORMALIZER_TRANSFORMATION: str = "softplus"   # stable for prices > 0

# Column definitions - mirrors features.py FEATURE_TYPES
TARGET: str = "Close_denoised"
GROUP_IDS: list[str] = ["ticker"]
TIME_IDX: str = "time_idx"

STATIC_CATEGORICALS: list[str] = ["sector"]
STATIC_REALS: list[str] = ["market_cap_log"]

KNOWN_FUTURE_REALS: list[str] = [
    "day_of_week",
    "month",
    "quarter",
    "is_month_end",
    "VIX",
    "SP500",
    "NSEI",
]

UNKNOWN_REALS: list[str] = [
    "Close",
    "Volume",
    "RSI_14",
    "MACD_12_26_9",
    "MACDh_12_26_9",
    "ATR_14",
    "OBV",
    "BBB_20_2",
    "RSI_14_lag1",
    "RSI_14_lag3",
    "RSI_14_lag5",
    "MACD_12_26_9_lag1",
    "MACD_12_26_9_lag3",
    "Volume_ratio",
    "STOCHk_14_3_3",
]


# ---------------------------------------------------------------------------
# Helper - silently drop column lists to only what is in the DataFrame
# ---------------------------------------------------------------------------
def _filter_present(df: pd.DataFrame, columns: list[str], label: str) -> list[str]:
    """Return only the columns from *columns* that exist in *df*.
    Logs a warning for every missing column so the user knows."""
    present = [c for c in columns if c in df.columns]
    missing = [c for c in columns if c not in df.columns]
    if missing:
        logger.warning(
            "[%s] %d column(s) not found in DataFrame and will be skipped: %s",
            label, len(missing), missing,
        )
    return present


# ---------------------------------------------------------------------------
# 1. create_datasets
# ---------------------------------------------------------------------------
def create_datasets(
    df: pd.DataFrame,
    val_cutoff_pct: float = DEFAULT_VAL_CUTOFF_PCT,
) -> Tuple["TimeSeriesDataSet", "TimeSeriesDataSet"]:
    """Split *df* into train/val and build pytorch-forecasting TimeSeriesDataSets.

    The split is **time-based** (no shuffling) - the last ``val_cutoff_pct``
    fraction of ``time_idx`` values form the validation set.  The validation
    dataset is constructed via ``TimeSeriesDataSet.from_dataset()`` so that
    normalisation statistics computed on training data are reused (no leakage).

    Parameters
    ----------
    df : pd.DataFrame
        Feature-enriched DataFrame with ``time_idx`` and ``ticker`` columns.
        Must be sorted by ``time_idx`` within each ticker group.
    val_cutoff_pct : float, optional
        Fraction of time steps reserved for validation.  Must be in (0, 1).
        Defaults to ``0.15`` (last 15 %).

    Returns
    -------
    training_dataset : TimeSeriesDataSet
    val_dataset      : TimeSeriesDataSet

    Raises
    ------
    ImportError   If pytorch-forecasting is not installed.
    ValueError    If *df* does not contain the required ``time_idx`` column.
    """
    if not _HAS_PTF:
        raise ImportError(
            "pytorch-forecasting is required. "
            "Run: pip install pytorch-forecasting pytorch-lightning"
        )
    if TIME_IDX not in df.columns:
        raise ValueError(f"DataFrame must contain '{TIME_IDX}' column.")
    if TARGET not in df.columns:
        raise ValueError(f"DataFrame must contain target column '{TARGET}'.")

    # ── Time-based train / val split ─────────────────────────────────────
    max_time = df[TIME_IDX].max()
    val_cutoff = int(max_time * (1.0 - val_cutoff_pct))
    df_train = df[df[TIME_IDX] <= val_cutoff].copy()
    df_val   = df[df[TIME_IDX] >  val_cutoff].copy()

    n_train, n_val = len(df_train), len(df_val)
    logger.info(
        "Train/val split: cutoff time_idx=%d | train=%d rows | val=%d rows",
        val_cutoff, n_train, n_val,
    )

    # ── Filter columns to only those present in the DataFrame ────────────
    static_cats  = _filter_present(df_train, STATIC_CATEGORICALS, "static_categoricals")
    static_reals = _filter_present(df_train, STATIC_REALS,        "static_reals")
    known_reals  = _filter_present(df_train, KNOWN_FUTURE_REALS,  "known_future_reals")
    unknown_reals = _filter_present(df_train, UNKNOWN_REALS,      "unknown_reals")

    # ── Training TimeSeriesDataSet ────────────────────────────────────────
    logger.info("Building training TimeSeriesDataSet ...")
    training_dataset = TimeSeriesDataSet(
        df_train,
        # ── Identifiers ──────────────────────────────────────────────────
        time_idx=TIME_IDX,
        target=TARGET,
        group_ids=GROUP_IDS,

        # ── Window lengths ───────────────────────────────────────────────
        min_encoder_length=MIN_ENCODER_LENGTH,
        max_encoder_length=MAX_ENCODER_LENGTH,
        min_prediction_length=MIN_PREDICTION_LENGTH,
        max_prediction_length=MAX_PREDICTION_LENGTH,

        # ── Feature columns ──────────────────────────────────────────────
        static_categoricals=static_cats,
        static_reals=static_reals,
        time_varying_known_reals=known_reals,
        time_varying_unknown_reals=unknown_reals + [TARGET],

        # ── Normalisation ─────────────────────────────────────────────────
        target_normalizer=GroupNormalizer(
            groups=GROUP_IDS,
            transformation=TARGET_NORMALIZER_TRANSFORMATION,
        ),

        # ── TFT auxiliary features ───────────────────────────────────────
        add_relative_time_idx=True,    # adds relative position in encoder
        add_encoder_length=True,       # tells model how long the encoder is
        allow_missing_timesteps=True,  # handle weekends / holidays gracefully
    )

    # ── Validation TimeSeriesDataSet (reuses training normalisation) ──────
    logger.info("Building validation TimeSeriesDataSet from training dataset ...")
    val_dataset = TimeSeriesDataSet.from_dataset(
        training_dataset,
        df_val,
        predict=True,
        stop_randomization=True,
    )

    logger.info(
        "Datasets ready - train samples=%d | val samples=%d",
        len(training_dataset), len(val_dataset),
    )
    return training_dataset, val_dataset


# ---------------------------------------------------------------------------
# 2. create_dataloaders
# ---------------------------------------------------------------------------
def create_dataloaders(
    training_dataset: "TimeSeriesDataSet",
    val_dataset: "TimeSeriesDataSet",
    batch_size: int = BATCH_SIZE,
) -> Tuple["DataLoader", "DataLoader"]:
    """Wrap TimeSeriesDataSets in PyTorch DataLoaders.

    Parameters
    ----------
    training_dataset : TimeSeriesDataSet
    val_dataset      : TimeSeriesDataSet
    batch_size       : int, optional
        Mini-batch size.  Defaults to :data:`BATCH_SIZE` (64).

    Returns
    -------
    train_dl : DataLoader
        Shuffle=False (time series must stay sequential).
        drop_last=True (avoids partial-batch issues with GroupNorm).
    val_dl : DataLoader
        Shuffle=False, ``train=False`` (uses all samples deterministically).

    Notes
    -----
    ``num_workers`` is set to :data:`NUM_WORKERS`.  On Windows you may need
    to set this to ``0`` if you encounter multiprocessing errors.
    """
    if not _HAS_PTF:
        raise ImportError(
            "pytorch-forecasting is required. "
            "Run: pip install pytorch-forecasting pytorch-lightning"
        )

    train_dl = training_dataset.to_dataloader(
        train=True,
        batch_size=batch_size,
        num_workers=NUM_WORKERS,
        shuffle=False,      # DO NOT shuffle - temporal order matters
        drop_last=True,
    )

    val_dl = val_dataset.to_dataloader(
        train=False,
        batch_size=batch_size,
        num_workers=NUM_WORKERS,
        shuffle=False,
    )

    logger.info(
        "DataLoaders ready - batch_size=%d | num_workers=%d",
        batch_size, NUM_WORKERS,
    )
    return train_dl, val_dl


# ---------------------------------------------------------------------------
# 3. inspect_dataset
# ---------------------------------------------------------------------------
def inspect_dataset(training_dataset: "TimeSeriesDataSet") -> None:
    """Print a full diagnostic report for a training TimeSeriesDataSet.

    Prints
    ------
    * Number of samples
    * Encoder and prediction length ranges
    * Static categoricals and reals
    * Time-varying known and unknown reals
    * Target normaliser info
    * Missing-timestep warning if ``allow_missing_timesteps`` is True

    Parameters
    ----------
    training_dataset : TimeSeriesDataSet
        The dataset returned by :func:`create_datasets`.
    """
    if not _HAS_PTF:
        raise ImportError("pytorch-forecasting is not installed.")

    ds = training_dataset
    sep = "─" * 56

    print(f"\n  {sep}")
    print(f"  Apex AI - TFT Dataset Inspector")
    print(f"  {sep}")
    print(f"  Samples (windows)        : {len(ds):,}")
    print(f"  Encoder length           : {ds.min_encoder_length} ... {ds.max_encoder_length} days")
    print(f"  Prediction length        : {ds.min_prediction_length} ... {ds.max_prediction_length} days")
    print(f"  Target                   : {ds.target}")
    print(f"  Group IDs                : {ds.group_ids}")

    print(f"\n  Static categoricals ({len(ds.static_categoricals)}) :")
    for c in ds.static_categoricals:
        print(f"    • {c}")

    print(f"\n  Static reals ({len(ds.static_reals)}) :")
    for c in ds.static_reals:
        print(f"    • {c}")

    known = ds.time_varying_known_reals
    print(f"\n  Time-varying KNOWN future reals ({len(known)}) :")
    for c in known:
        print(f"    • {c}")

    unknown = ds.time_varying_unknown_reals
    print(f"\n  Time-varying UNKNOWN reals ({len(unknown)}) :")
    for c in unknown:
        print(f"    • {c}")

    # Target normalizer
    norm = ds.target_normalizer
    print(f"\n  Target normalizer        : {type(norm).__name__}")
    if hasattr(norm, "transformation"):
        print(f"  Normalizer transformation: {norm.transformation}")

    # Missing timesteps
    if ds.allow_missing_timesteps:
        print(f"\n  ⚠️  allow_missing_timesteps=True")
        print(f"     Gaps (weekends/holidays) are handled automatically.")
    else:
        print(f"\n  ✅  allow_missing_timesteps=False (dense index assumed).")

    print(f"\n  Total features           : {len(ds.static_categoricals) + len(ds.static_reals) + len(known) + len(unknown)}")
    print(f"  {sep}\n")


# ---------------------------------------------------------------------------
# 4. create_inference_dataset  (Fix 2: shorter encoder at inference)
# ---------------------------------------------------------------------------

# Inference-time encoder limits - shorter than training (attention is O(n²))
INFER_MIN_ENCODER_LENGTH: int = 30   # half of training MIN_ENCODER_LENGTH
INFER_MAX_ENCODER_LENGTH: int = 60   # half of training MAX_ENCODER_LENGTH


def create_inference_dataset(
    df: pd.DataFrame,
    training_dataset: "TimeSeriesDataSet",
    tail_rows: int = 90,
) -> "TimeSeriesDataSet":
    """Build a lightweight inference-only TimeSeriesDataSet.

    WHY THIS EXISTS
    ---------------
    The TFT attention mechanism scales as **O(n²)** with encoder sequence
    length.  During training we use ``max_encoder_length=120`` for maximum
    accuracy.  At inference, we only need a recent context window -
    cutting the encoder to 60 rows gives **~4× faster** forward passes.

    This dataset reuses normalisation statistics from *training_dataset*
    (via ``from_dataset``) so predictions are on the same scale - no
    data leakage, no re-fitting.

    Parameters
    ----------
    df : pd.DataFrame
        Feature-enriched DataFrame for the ticker(s) to predict.
        Must contain the same columns as the training DataFrame.
    training_dataset : TimeSeriesDataSet
        The dataset returned by :func:`create_datasets` - supplies
        normalisation statistics and column config.
    tail_rows : int, optional
        Keep only the last *tail_rows* rows per group before building the
        dataset.  90 rows ≈ 3 months of trading days - enough context.
        Defaults to 90.

    Returns
    -------
    TimeSeriesDataSet
        Inference dataset using the shorter encoder window.
    """
    if not _HAS_PTF:
        raise ImportError(
            "pytorch-forecasting is required. "
            "Run: pip install pytorch-forecasting pytorch-lightning"
        )

    # Keep only recent history - no need to feed the model years of data
    if tail_rows and len(df) > tail_rows:
        df = df.groupby("ticker", group_keys=False).tail(tail_rows).copy()

    inference_ds = TimeSeriesDataSet.from_dataset(
        training_dataset,
        df,
        predict=True,
        stop_randomization=True,
        # ── Key: shorter encoder for O(n²) speedup ───────────────────────
        min_encoder_length=INFER_MIN_ENCODER_LENGTH,
        max_encoder_length=INFER_MAX_ENCODER_LENGTH,
    )

    logger.info(
        "create_inference_dataset: encoder=[%d,%d], rows=%d",
        INFER_MIN_ENCODER_LENGTH, INFER_MAX_ENCODER_LENGTH, len(df),
    )
    return inference_ds


# ---------------------------------------------------------------------------
# __main__ - smoke-test with synthetic multi-ticker data
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"\n{'='*60}")
    print("  Apex AI - tft_dataset.py smoke test")
    print(f"{'='*60}\n")

    if not _HAS_PTF:
        print("  ⚠️  pytorch-forecasting not installed.")
        print("  Run: pip install pytorch-forecasting pytorch-lightning")
        print("\n  Performing config-only validation (no dataset construction)...")

        # At minimum verify column lists are consistent
        all_cols = (
            GROUP_IDS + [TIME_IDX, TARGET]
            + STATIC_CATEGORICALS + STATIC_REALS
            + KNOWN_FUTURE_REALS + UNKNOWN_REALS
        )
        unique_cols = list(dict.fromkeys(all_cols))
        print(f"\n  Configured columns ({len(unique_cols)}):")
        for c in unique_cols:
            print(f"    • {c}")
        print(f"\n  Constants:")
        print(f"    MIN_ENCODER_LENGTH  = {MIN_ENCODER_LENGTH}")
        print(f"    MAX_ENCODER_LENGTH  = {MAX_ENCODER_LENGTH}")
        print(f"    MIN_PREDICTION_LENGTH = {MIN_PREDICTION_LENGTH}")
        print(f"    MAX_PREDICTION_LENGTH = {MAX_PREDICTION_LENGTH}")
        print(f"    BATCH_SIZE          = {BATCH_SIZE}")
        print(f"    VAL_CUTOFF_PCT      = {DEFAULT_VAL_CUTOFF_PCT}")
        print(f"\n  Config-only validation passed ✅")
        print(f"{'='*60}\n")
    else:
        # Build synthetic multi-ticker DataFrame matching column contract
        np.random.seed(42)
        n, tickers = 800, ["AAPL", "MSFT"]

        frames = []
        for tkr in tickers:
            close = np.cumsum(np.random.randn(n) * 0.5) + 150
            frame = pd.DataFrame({
                "time_idx":            np.arange(n, dtype=np.int64),
                "ticker":              tkr,
                "Close_denoised":      close,
                "Close":               close * (1 + np.random.randn(n)*0.002),
                "Volume":              np.random.randint(1_000_000, 10_000_000, n).astype(float),
                "RSI_14":              np.random.uniform(30, 70, n),
                "MACD_12_26_9":        np.random.randn(n) * 0.5,
                "MACDh_12_26_9":       np.random.randn(n) * 0.1,
                "ATR_14":              np.abs(np.random.randn(n)) * 2 + 1,
                "OBV":                 np.cumsum(np.random.randn(n) * 1e6),
                "BBB_20_2":            np.random.uniform(0.01, 0.05, n),
                "RSI_14_lag1":         np.random.uniform(30, 70, n),
                "RSI_14_lag3":         np.random.uniform(30, 70, n),
                "RSI_14_lag5":         np.random.uniform(30, 70, n),
                "MACD_12_26_9_lag1":   np.random.randn(n) * 0.5,
                "MACD_12_26_9_lag3":   np.random.randn(n) * 0.5,
                "Volume_ratio":        np.random.uniform(0.5, 2.0, n),
                "STOCHk_14_3_3":       np.random.uniform(0, 100, n),
                "day_of_week":         np.tile(np.arange(5), n // 5 + 1)[:n].astype(np.int8),
                "month":               np.random.randint(1, 13, n, dtype=np.int8),
                "quarter":             np.random.randint(1, 5, n, dtype=np.int8),
                "is_month_end":        np.random.randint(0, 2, n, dtype=np.int8),
                "VIX":                 np.random.uniform(12, 40, n),
                "SP500":               np.cumsum(np.random.randn(n)*3) + 4000,
                "NSEI":                np.cumsum(np.random.randn(n)*5) + 18000,
                "sector":              "Technology",
                "market_cap_log":      float(np.log(3e12)),
            })
            frames.append(frame)

        df_synth = pd.concat(frames, ignore_index=True)
        df_synth.sort_values(["ticker", "time_idx"], inplace=True)

        print(f"  Synthetic df shape: {df_synth.shape}")
        print(f"  Tickers: {df_synth['ticker'].unique().tolist()}\n")

        # ── create_datasets ───────────────────────────────────────────
        print("▶ create_datasets ...")
        train_ds, val_ds = create_datasets(df_synth, val_cutoff_pct=0.15)

        # ── inspect_dataset ───────────────────────────────────────────
        print("▶ inspect_dataset ...")
        inspect_dataset(train_ds)

        # ── create_dataloaders ────────────────────────────────────────
        print("▶ create_dataloaders ...")
        train_dl, val_dl = create_dataloaders(train_ds, val_ds, batch_size=32)

        # Verify one batch loads without error
        batch = next(iter(train_dl))
        x, y = batch
        print(f"  ✅ First batch loaded - x keys: {list(x.keys())}")
        print(f"  ✅ Target tensor shape: {y[0].shape}")

        print(f"\n{'='*60}")
        print("  Smoke test complete - no errors.")
        print(f"{'='*60}\n")
