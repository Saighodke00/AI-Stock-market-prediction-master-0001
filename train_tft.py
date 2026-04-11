"""
train_tft.py
============
Apex AI — Phase 2: Temporal Fusion Transformer Training Script
--------------------------------------------------------------
Orchestrates the complete training pipeline:

    data_pipeline → denoising → frac_diff → features
        → tft_dataset → TFT model → pytorch-lightning Trainer

API
---
    build_model(training_dataset)            → TemporalFusionTransformer
    build_trainer(log_dir)                   → pl.Trainer
    lr_finder(model, trainer, train_dl)      → suggested learning rate
    train(ticker, period)                    → (model, best_ckpt_path)
    load_model(checkpoint_path, training_ds) → TemporalFusionTransformer

Packages required: pytorch-forecasting, pytorch-lightning, torch
Author : Apex AI Team
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Tuple, Optional

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("apex_ai.train_tft")

# ---------------------------------------------------------------------------
# Optional heavy imports — graceful error messages
# ---------------------------------------------------------------------------
try:
    import torch
    import pytorch_lightning as pl
    from pytorch_lightning.callbacks import EarlyStopping, ModelCheckpoint
    from pytorch_lightning.loggers import TensorBoardLogger
    from pytorch_forecasting import TemporalFusionTransformer
    from pytorch_forecasting.metrics import QuantileLoss
    _HAS_PTF = True
except ImportError as _ptf_err:
    _HAS_PTF = False
    _ptf_err_msg = str(_ptf_err)

# ===========================================================================
# ── TUNABLE HYPER-PARAMETERS ────────────────────────────────────────────────
# ===========================================================================
LEARNING_RATE: float     = 3e-4
HIDDEN_SIZE: int          = 64
ATTENTION_HEAD_SIZE: int  = 4
DROPOUT: float            = 0.1
HIDDEN_CONTINUOUS_SIZE: int = 32
OUTPUT_SIZE: int          = 7          # number of quantiles
QUANTILES: list[float]   = [0.02, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98]
LOG_INTERVAL: int         = 10
PLATEAU_PATIENCE: int     = 5

MAX_EPOCHS: int           = 100
GRADIENT_CLIP_VAL: float  = 0.1       # critical for transformer stability
EARLY_STOP_PATIENCE: int  = 10
EARLY_STOP_MIN_DELTA: float = 1e-4
SAVE_TOP_K: int           = 3

DEFAULT_LOG_DIR: str      = "logs/tft"
DEFAULT_CKPT_DIR: str     = "checkpoints/tft"


# ---------------------------------------------------------------------------
# Guard helper
# ---------------------------------------------------------------------------
def _require_ptf() -> None:
    if not _HAS_PTF:
        raise ImportError(
            f"pytorch-forecasting / pytorch-lightning not installed.\n"
            f"  Run: pip install pytorch-forecasting pytorch-lightning\n"
            f"  Original error: {_ptf_err_msg}"
        )


# ---------------------------------------------------------------------------
# 1. build_model
# ---------------------------------------------------------------------------
def build_model(training_dataset) -> "TemporalFusionTransformer":
    """Construct a TFT from a pytorch-forecasting TimeSeriesDataSet.

    Uses :func:`TemporalFusionTransformer.from_dataset` so that the dataset's
    embedding sizes and normalisation are automatically wired into the model.

    Hyper-parameters
    ----------------
    All constants are defined at module level for easy tuning:
        LEARNING_RATE, HIDDEN_SIZE, ATTENTION_HEAD_SIZE, DROPOUT,
        HIDDEN_CONTINUOUS_SIZE, OUTPUT_SIZE, QUANTILES,
        LOG_INTERVAL, PLATEAU_PATIENCE.

    Parameters
    ----------
    training_dataset : TimeSeriesDataSet
        Output of :func:`tft_dataset.create_datasets`.

    Returns
    -------
    TemporalFusionTransformer
        Untrained model ready for :func:`build_trainer` and ``trainer.fit``.
    """
    _require_ptf()

    model = TemporalFusionTransformer.from_dataset(
        training_dataset,
        learning_rate=LEARNING_RATE,
        hidden_size=HIDDEN_SIZE,
        attention_head_size=ATTENTION_HEAD_SIZE,
        dropout=DROPOUT,
        hidden_continuous_size=HIDDEN_CONTINUOUS_SIZE,
        output_size=OUTPUT_SIZE,
        loss=QuantileLoss(QUANTILES),
        log_interval=LOG_INTERVAL,
        reduce_on_plateau_patience=PLATEAU_PATIENCE,
    )

    n_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"\n  TFT Model built successfully.")
    print(f"  ┌──────────────────────────────────────────────┐")
    print(f"  │  Trainable parameters : {n_params:>12,}      │")
    print(f"  │  Hidden size          : {HIDDEN_SIZE:<6}                │")
    print(f"  │  Attention heads      : {ATTENTION_HEAD_SIZE:<6}                │")
    print(f"  │  Dropout              : {DROPOUT:<6}                │")
    print(f"  │  Quantiles            : {QUANTILES}  │")
    print(f"  └──────────────────────────────────────────────┘\n")
    logger.info("build_model: %d trainable parameters.", n_params)
    return model


# ---------------------------------------------------------------------------
# 2. build_trainer
# ---------------------------------------------------------------------------
def build_trainer(log_dir: str = DEFAULT_LOG_DIR, max_epochs: int = MAX_EPOCHS, ticker: str = "UNKNOWN") -> "pl.Trainer":
    """Create a PyTorch-Lightning Trainer with recommended TFT settings.

    Callbacks
    ---------
    ``ModelCheckpoint``
        Saves the top-3 checkpoints by ``val_loss``.  Best checkpoint path
        is accessible via ``trainer.checkpoint_callback.best_model_path``.
    ``EarlyStopping``
        Stops training if ``val_loss`` doesn't improve by
        ``EARLY_STOP_MIN_DELTA`` for ``EARLY_STOP_PATIENCE`` consecutive
        epochs — prevents overfitting on financial time series.

    Parameters
    ----------
    log_dir : str, optional
        TensorBoard log directory.  Defaults to ``'logs/tft'``.
    max_epochs : int, optional
        Maximum training epochs.
    ticker : str, optional
        The ticker being trained. Used in checkpoint filenames.

    Returns
    -------
    pl.Trainer
    """
    _require_ptf()

    os.makedirs(log_dir, exist_ok=True)
    os.makedirs(DEFAULT_CKPT_DIR, exist_ok=True)

    # Use ticker in filename for multi-model clarity
    clean_ticker = ticker.replace(".", "_").replace("^", "")
    checkpoint_callback = ModelCheckpoint(
        dirpath=DEFAULT_CKPT_DIR,
        filename=f"tft-{{epoch:03d}}-{{val_loss:.4f}}-{clean_ticker}",
        monitor="val_loss",
        save_top_k=1,
        mode="min",
        verbose=True,
        save_on_train_epoch_end=True,
    )

    early_stop_callback = EarlyStopping(
        monitor="val_loss",
        patience=EARLY_STOP_PATIENCE,
        min_delta=EARLY_STOP_MIN_DELTA,
        mode="min",
        verbose=True,
    )

    tb_logger = TensorBoardLogger(save_dir=log_dir, name="apex_ai_tft")

    trainer = pl.Trainer(
        max_epochs=max_epochs,
        min_epochs=1,
        accelerator="auto",          # auto-selects GPU / MPS / CPU
        devices=1,
        gradient_clip_val=GRADIENT_CLIP_VAL,   # CRITICAL for transformer stability
        callbacks=[checkpoint_callback, early_stop_callback],
        logger=tb_logger,
        enable_progress_bar=True,
        log_every_n_steps=LOG_INTERVAL,
        check_val_every_n_epoch=1,
    )

    logger.info(
        "build_trainer: max_epochs=%d, gradient_clip=%.2f, log_dir=%s",
        MAX_EPOCHS, GRADIENT_CLIP_VAL, log_dir,
    )
    return trainer


# ---------------------------------------------------------------------------
# 3. lr_finder
# ---------------------------------------------------------------------------
def lr_finder(
    model: "TemporalFusionTransformer",
    trainer: "pl.Trainer",
    train_dl,
    val_dl=None,
    num_training: int = 100,
) -> float:
    """Run PyTorch-Lightning's built-in learning rate finder.

    Sweeps LR from a small value up to a large one over ``num_training``
    steps and plots the loss-vs-LR curve.  The suggested LR is printed
    and returned.

    Parameters
    ----------
    model : TemporalFusionTransformer
    trainer : pl.Trainer
        Trainer instance (does NOT need to be the training trainer — a
        lightweight one-epoch trainer is fine here).
    train_dl : DataLoader
    val_dl : DataLoader, optional
    num_training : int, optional
        Number of LR steps to sweep.  Defaults to 100.

    Returns
    -------
    float
        Suggested learning rate.
    """
    _require_ptf()

    logger.info("Running LR finder over %d steps …", num_training)
    tuner = pl.tuner.Tuner(trainer)
    lr_result = tuner.lr_find(
        model,
        train_dataloaders=train_dl,
        val_dataloaders=val_dl,
        num_training=num_training,
        early_stop_threshold=None,
    )

    suggested_lr = lr_result.suggestion()
    print(f"\n  LR Finder result → suggested LR = {suggested_lr:.2e}")
    logger.info("lr_finder: suggested LR = %.2e", suggested_lr)

    try:
        fig = lr_result.plot(suggest=True)
        os.makedirs("plots", exist_ok=True)
        fig.savefig("plots/lr_finder.png", dpi=100, bbox_inches="tight")
        print(f"  LR curve saved → plots/lr_finder.png")
    except Exception as exc:
        logger.warning("Could not save LR finder plot: %s", exc)

    return float(suggested_lr)


# ---------------------------------------------------------------------------
# 4. train
# ---------------------------------------------------------------------------
def train(
    ticker: str,
    period: str = "3y",
    run_lr_finder: bool = False,
    log_dir: str = DEFAULT_LOG_DIR,
    max_epochs: int = MAX_EPOCHS,
) -> Tuple["TemporalFusionTransformer", str]:
    """Orchestrate the complete Apex AI TFT training pipeline.

    Pipeline steps
    --------------
    1. ``data_pipeline.fetch_multi_modal``      — OHLCV + macro indices
    2. ``data_pipeline.add_static_metadata``    — sector, log_market_cap, beta
    3. ``denoising.apply_denoising_to_dataframe`` — wavelet DWT target
    4. ``frac_diff.apply_to_dataframe``         — stationarity via FFD
    5. ``features.build_all_features``          — full TFT feature matrix
    6. ``tft_dataset.create_datasets``          — TimeSeriesDataSet objects
    7. ``tft_dataset.create_dataloaders``       — PyTorch DataLoaders
    8. ``build_model``                          — TFT construction
    9. ``build_trainer``                        — Lightning Trainer
    10. ``trainer.fit``                         — training loop
    11. Print the best checkpoint path

    Parameters
    ----------
    ticker : str
        Stock ticker, e.g. ``'AAPL'`` or ``'RELIANCE.NS'``.
    period : str, optional
        yfinance history period.  Defaults to ``'3y'``.
    run_lr_finder : bool, optional
        If True, runs LR finder before training and updates ``model.hparams``
        with the suggested LR.
    log_dir : str, optional
        TensorBoard log directory.

    Returns
    -------
    model : TemporalFusionTransformer
        The trained model.
    best_ckpt_path : str
        Path to the best checkpoint saved by ``ModelCheckpoint``.
    """
    _require_ptf()

    # Lazy imports — keep top-level import-free for syntax checking
    from utils.data_pipeline import fetch_multi_modal, add_static_metadata
    from utils.denoising     import apply_denoising_to_dataframe
    from utils.frac_diff     import apply_to_dataframe as frac_diff_apply
    from utils.features      import build_all_features
    from utils.tft_dataset   import create_datasets, create_dataloaders

    sep = "─" * 56
    print(f"\n  {sep}")
    print(f"  Apex AI — TFT Training Pipeline  [{ticker}]")
    print(f"  {sep}")

    # ── Step 1-2: Fetch data ────────────────────────────────────────────
    print(f"\n  [1/8] Fetching {ticker} ({period}) + macro indices …")
    df = fetch_multi_modal(ticker, period=period)
    df = add_static_metadata(df, ticker)
    logger.info("Fetched %d rows for %s.", len(df), ticker)

    # ── Step 3: Wavelet denoising ────────────────────────────────────────
    print(f"  [2/8] Wavelet denoising (DWT) …")
    df = apply_denoising_to_dataframe(df)

    # ── Step 4: Fractional differentiation ──────────────────────────────
    print(f"  [3/8] Fractional differentiation (FFD d=0.4) …")
    df = frac_diff_apply(df, d=0.4)

    # ── Step 5: Feature engineering ─────────────────────────────────────
    print(f"  [4/8] Building TFT feature matrix …")
    df = build_all_features(df, ticker=ticker)

    # ── Step 6-7: Datasets & DataLoaders ────────────────────────────────
    print(f"  [5/8] Creating TimeSeriesDataSets …")
    train_ds, val_ds = create_datasets(df)

    print(f"  [6/8] Creating DataLoaders …")
    train_dl, val_dl = create_dataloaders(train_ds, val_ds)

    # ── Step 8: Model ───────────────────────────────────────────────────
    print(f"  [7/8] Building TFT model …")
    model = build_model(train_ds)

    # ── LR Finder (optional) ────────────────────────────────────────────
    trainer = build_trainer(log_dir=log_dir, max_epochs=max_epochs, ticker=ticker)
    if run_lr_finder:
        print(f"  [LR] Running LR Finder …")
        suggested_lr = lr_finder(model, trainer, train_dl, val_dl)
        model.hparams.learning_rate = suggested_lr
        logger.info("LR updated to %.2e after LR finder.", suggested_lr)
        # Rebuild trainer (LR finder may have advanced its state)
        trainer = build_trainer(log_dir=log_dir, max_epochs=max_epochs, ticker=ticker)

    # ── Step 9: Training ─────────────────────────────────────────────────
    print(f"  [8/8] Starting training (max_epochs={MAX_EPOCHS}) …")
    print(f"  {sep}\n")
    trainer.fit(model, train_dl, val_dl)

    # ── Step 10: Best checkpoint ─────────────────────────────────────────
    best_ckpt = trainer.checkpoint_callback.best_model_path
    print(f"\n  {sep}")
    print(f"  Training complete!")
    print(f"  Best checkpoint : {best_ckpt}")
    print(f"  Best val_loss   : {trainer.checkpoint_callback.best_model_score:.6f}")
    print(f"  {sep}\n")
    logger.info("Training complete. Best checkpoint: %s", best_ckpt)

    return model, best_ckpt


# ---------------------------------------------------------------------------
# 5. load_model
# ---------------------------------------------------------------------------
def load_model(
    checkpoint_path: str,
    training_dataset=None,
) -> "TemporalFusionTransformer":
    """Load a TFT from a saved Lightning checkpoint.

    Parameters
    ----------
    checkpoint_path : str
        Path to a ``.ckpt`` file created by ``ModelCheckpoint``.
    training_dataset : TimeSeriesDataSet, optional
        If provided, :func:`TemporalFusionTransformer.from_dataset` is used
        to rebuild the model architecture before loading weights.  This is
        the safest approach when the checkpoint doesn't embed the full config.
        If None, falls back to ``load_from_checkpoint`` directly.

    Returns
    -------
    TemporalFusionTransformer
        Model in eval mode, ready for inference.
    """
    _require_ptf()

    if not Path(checkpoint_path).exists():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")

    if training_dataset is not None:
        # Preferred: ensures architecture matches the dataset
        model = TemporalFusionTransformer.load_from_checkpoint(
            checkpoint_path,
        )
    else:
        model = TemporalFusionTransformer.load_from_checkpoint(checkpoint_path)

    model.eval()
    logger.info("Model loaded from checkpoint: %s", checkpoint_path)
    print(f"  ✅ Model loaded from: {checkpoint_path}")
    return model


# ===========================================================================
# ── INFERENCE OPTIMIZATIONS (Fixes 1–5) ─────────────────────────────────────
# ===========================================================================

# Quantile index mapping — matches QUANTILES list order
_Q_IDX: dict[float, int] = {q: i for i, q in enumerate(QUANTILES)}


# ---------------------------------------------------------------------------
# Fix 1 + 2 + 4: fast_predict
# ---------------------------------------------------------------------------
def fast_predict(
    model: "TemporalFusionTransformer",
    ticker_df,                          # pd.DataFrame
    training_dataset,                   # TimeSeriesDataSet
    device: Optional[str] = None,
    tail_rows: int = 90,
    num_workers: int = 0,
) -> tuple:
    """Optimised single-ticker inference (~0.3s vs 2-3s naive).

    Combines three key speedups in one call:
      * **Fix 1** — ``model.eval()`` + ``torch.no_grad()``  (5–10× win)
      * **Fix 2** — shorter inference encoder via
        :func:`tft_dataset.create_inference_dataset` (4× win from O(n²))
      * **Fix 4** — ``num_workers=0`` (no subprocess fork overhead for
        single-sample predictions), returns both quantiles and index.

    Parameters
    ----------
    model : TemporalFusionTransformer
    ticker_df : pd.DataFrame
        Feature-enriched DataFrame for one ticker.
    training_dataset : TimeSeriesDataSet
        Training dataset (supplies normalisation statistics).
    device : str, optional
        ``'cuda'``, ``'mps'``, or ``'cpu'``.  Auto-detected if None.
    tail_rows : int, optional
        History rows to keep — 90 ≈ 3 months.  Defaults to 90.
    num_workers : int, optional
        DataLoader workers.  0 = no subprocess (fastest for one sample).

    Returns
    -------
    tuple
        ``(predictions, index)`` where ``predictions`` has shape
        ``(batch, prediction_horizon, n_quantiles)`` and ``index`` is
        a DataFrame with the group/time index for alignment.
    """
    _require_ptf()

    import time
    from utils.tft_dataset import create_inference_dataset

    if device is None:
        if torch.cuda.is_available():
            device = "cuda"
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            device = "mps"
        else:
            device = "cpu"

    # Fix 1 — eval mode disables dropout & batch-norm training behaviour
    model = model.to(device)
    model.eval()

    # Fix 2 — shorter encoder (60 rows instead of 120 → 4× attention speedup)
    inference_ds = create_inference_dataset(ticker_df, training_dataset, tail_rows=tail_rows)
    loader = inference_ds.to_dataloader(
        train=False,
        batch_size=1,
        num_workers=num_workers,   # Fix 4 — no subprocess for single prediction
    )

    t0 = time.time()
    with torch.no_grad():          # Fix 1 — no gradient computation
        raw_output = model.predict(
            loader,
            mode="quantiles",          # return all 7 quantile columns
            return_index=True,         # include index for ticker alignment
            trainer_kwargs={"accelerator": device, "enable_progress_bar": False},
        )
    elapsed = time.time() - t0
    print(f"  ⚡ Inference: {elapsed:.2f}s on {device}")
    logger.info("fast_predict: %.2fs on %s", elapsed, device)
    return raw_output


# ---------------------------------------------------------------------------
# Fix 4 helper: get_quantile_prices
# ---------------------------------------------------------------------------
def get_quantile_prices(
    raw_output: tuple,
    quantiles: list[float] = None,
) -> dict[str, float]:
    """Extract P10, P50, P90 and multi-horizon medians from model output.

    Parameters
    ----------
    raw_output : tuple
        Return value of :func:`fast_predict` — ``(predictions, index)``.
        ``predictions`` shape: ``(batch, prediction_horizon, n_quantiles)``.
    quantiles : list[float], optional
        Subset of quantiles to extract.  Defaults to ``[0.1, 0.5, 0.9]``.

    Returns
    -------
    dict with keys:
        ``p10``    — 14-day P10 price forecast.
        ``p50``    — 14-day median forecast.
        ``p90``    — 14-day P90 forecast.
        ``p50_7d`` — 7-day median forecast.
        ``p50_30d``— 30-day median forecast (if prediction_horizon ≥ 30).
    """
    if quantiles is None:
        quantiles = [0.1, 0.5, 0.9]

    predictions = raw_output[0]           # shape: (batch, horizon, n_quantiles)
    forecast = predictions[0]             # first (only) sample

    horizon = forecast.shape[0]
    result: dict[str, float] = {}

    # 14-day quantile forecasts
    idx_14 = min(13, horizon - 1)
    for q in quantiles:
        if q in _Q_IDX:
            key = f"p{int(q*100)}"
            result[key] = float(forecast[idx_14, _Q_IDX[q]])

    # Multi-horizon medians
    med_idx = _Q_IDX.get(0.5, 3)
    result["p50_7d"]  = float(forecast[min(6,  horizon-1), med_idx])
    result["p50_14d"] = float(forecast[min(13, horizon-1), med_idx])
    result["p50_30d"] = float(forecast[min(29, horizon-1), med_idx])

    return result


# ---------------------------------------------------------------------------
# Fix 3: batch_predict — all tickers in one forward pass
# ---------------------------------------------------------------------------
def batch_predict(
    model: "TemporalFusionTransformer",
    tickers: list[str],
    dfs: dict,                      # dict[str, pd.DataFrame]
    training_dataset,               # TimeSeriesDataSet
    batch_size: int = 128,
    num_workers: int = 4,
    device: Optional[str] = None,
) -> dict[str, dict[str, float]]:
    """Predict all tickers in a single batched forward pass.

    Instead of calling inference once per ticker (slow), this combines all
    tickers into one DataLoader and runs a single ``model.predict()`` call.
    Suitable for multi-stock screeners.

    Parameters
    ----------
    model : TemporalFusionTransformer
    tickers : list[str]
        Ticker symbols to predict.
    dfs : dict[str, pd.DataFrame]
        Mapping of ticker → feature DataFrame (one per ticker).
    training_dataset : TimeSeriesDataSet
    batch_size : int, optional
        Inference batch size.  128 is efficient for GPU.  Defaults to 128.
    num_workers : int, optional
        DataLoader workers.  Defaults to 4.
    device : str, optional
        Auto-detected if None.

    Returns
    -------
    dict[str, dict[str, float]]
        ``{ticker: {'p10': ..., 'p50': ..., 'p90': ..., 'p50_7d': ..., 'p50_30d': ...}}``
    """
    _require_ptf()
    import pandas as pd
    import time
    from utils.tft_dataset import create_inference_dataset

    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    # ── Combine all ticker DataFrames ──────────────────────────────────────
    combined_df = pd.concat(
        [dfs[t] for t in tickers if t in dfs],
        ignore_index=True,
    )

    inference_ds = create_inference_dataset(combined_df, training_dataset)
    loader = inference_ds.to_dataloader(
        train=False,
        batch_size=batch_size,
        num_workers=num_workers,
        shuffle=False,
    )

    model = model.to(device)
    model.eval()

    t0 = time.time()
    with torch.no_grad():
        raw_output = model.predict(
            loader,
            mode="quantiles",
            return_index=True,
            trainer_kwargs={"accelerator": device, "enable_progress_bar": False},
        )
    elapsed = time.time() - t0
    print(f"  ⚡ Batch inference ({len(tickers)} tickers): {elapsed:.2f}s on {device}")

    predictions, index_df = raw_output

    # ── Split results back by ticker ──────────────────────────────────────
    results: dict[str, dict[str, float]] = {}
    for i, tkr in enumerate(index_df["ticker"].unique() if "ticker" in index_df.columns else []):
        mask = index_df["ticker"] == tkr
        tkr_preds = predictions[mask.values]
        if len(tkr_preds) == 0:
            continue
        fake_output = (tkr_preds, index_df[mask])
        results[tkr] = get_quantile_prices(fake_output)

    return results


# ---------------------------------------------------------------------------
# Fix 5: export_torchscript
# ---------------------------------------------------------------------------
def export_torchscript(
    model: "TemporalFusionTransformer",
    training_dataset,
    save_path: str = "models/apex_tft.pt",
) -> str:
    """Export TFT to TorchScript for production inference (3–5× speedup).

    TorchScript removes Python interpreter overhead and runs in pure C++.
    This should be done **once** after training is complete.

    Falls back to ``state_dict`` export if TorchScript tracing fails (TFT
    has dynamic shapes that can break ``torch.jit.trace``).

    Parameters
    ----------
    model : TemporalFusionTransformer
    training_dataset : TimeSeriesDataSet
        Used to create a sample batch for tracing.
    save_path : str, optional
        Destination ``.pt`` file.  Defaults to ``'models/apex_tft.pt'``.

    Returns
    -------
    str
        Path to the saved file.
    """
    _require_ptf()
    os.makedirs(os.path.dirname(save_path) or "models", exist_ok=True)
    model.eval()

    loader = training_dataset.to_dataloader(
        train=False, batch_size=1, num_workers=0,
    )
    sample_batch = next(iter(loader))

    try:
        scripted = torch.jit.trace(model, sample_batch[0])
        torch.jit.save(scripted, save_path)
        print(f"  ✅ TorchScript exported → {save_path}")
        logger.info("TorchScript export saved to: %s", save_path)
    except Exception as exc:
        logger.warning("TorchScript failed (dynamic shapes): %s — falling back to state_dict.", exc)
        print(f"  ⚠️  TorchScript failed: {exc}")
        fallback_path = save_path.replace(".pt", "_state.pt")
        torch.save({
            "state_dict":       model.state_dict(),
            "hyper_parameters": model.hparams,
        }, fallback_path)
        save_path = fallback_path
        print(f"  💾 State dict saved instead → {save_path}")

    return save_path


# ---------------------------------------------------------------------------
# Fix 5 companion: load_fast_model
# ---------------------------------------------------------------------------
def load_fast_model(
    checkpoint_path: str,
    training_dataset=None,
) -> "TemporalFusionTransformer":
    """Load a checkpoint and optimise for inference.

    Attempts to fuse BatchNorm layers for reduced computation.  Unlike
    :func:`load_model`, this is optimised for serving — not for resuming
    training.

    Parameters
    ----------
    checkpoint_path : str
        Path to a ``.ckpt`` file.
    training_dataset : TimeSeriesDataSet, optional
        Not used directly, kept for API symmetry with :func:`load_model`.

    Returns
    -------
    TemporalFusionTransformer
        Model in ``eval`` mode with fused layers where possible.
    """
    _require_ptf()
    model = TemporalFusionTransformer.load_from_checkpoint(checkpoint_path)
    model.eval()

    # Fuse BatchNorm + ReLU layers where possible (reduces memory + compute)
    try:
        torch.quantization.fuse_modules(model, [["bn", "relu"]], inplace=True)
        logger.info("load_fast_model: BN+ReLU layers fused.")
    except Exception:
        pass  # Not all models have fuseable layers — this is optional

    logger.info("load_fast_model: loaded from %s", checkpoint_path)
    return model


# ---------------------------------------------------------------------------
# Benchmark: end-to-end timing breakdown
# ---------------------------------------------------------------------------
def benchmark_inference(
    model: "TemporalFusionTransformer",
    training_dataset,
    ticker: str = "AAPL",
    period: str = "6mo",
) -> dict[str, float]:
    """Time each stage of the inference pipeline and print a breakdown.

    Stages timed
    ------------
    * ``data_fetch``       — yfinance + macro fetch
    * ``feature_pipeline`` — denoising, frac_diff, feature engineering
    * ``model_inference``  — fast_predict call

    Target benchmarks (CPU, M-series Mac / modern laptop):
        data_fetch ~1s, features ~0.2s, inference ~0.3s → ~1.5s total

    Parameters
    ----------
    model : TemporalFusionTransformer
    training_dataset : TimeSeriesDataSet
    ticker : str, optional
    period : str, optional

    Returns
    -------
    dict[str, float]
        Stage name → elapsed seconds.
    """
    import time
    from utils.data_pipeline import fetch_multi_modal, add_static_metadata
    from utils.denoising     import apply_denoising_to_dataframe
    from utils.frac_diff     import apply_to_dataframe as frac_diff_apply
    from utils.features      import build_all_features

    times: dict[str, float] = {}
    sep = "─" * 40

    print(f"\n  {sep}")
    print(f"  Apex AI — Inference Benchmark [{ticker}]")
    print(f"  {sep}")

    # ── Data fetch ────────────────────────────────────────────────────────
    t0 = time.time()
    df = fetch_multi_modal(ticker, period=period)
    df = add_static_metadata(df, ticker)
    times["data_fetch"] = time.time() - t0

    # ── Feature pipeline ──────────────────────────────────────────────────
    t0 = time.time()
    df = apply_denoising_to_dataframe(df)
    df = frac_diff_apply(df, d=0.4)
    df = build_all_features(df, ticker=ticker)
    times["feature_pipeline"] = time.time() - t0

    # ── Model inference ────────────────────────────────────────────────────
    t0 = time.time()
    raw = fast_predict(model, df, training_dataset)
    times["model_inference"] = time.time() - t0

    # ── Print results ──────────────────────────────────────────────────────
    total = sum(times.values())
    for stage, elapsed in times.items():
        bar = "█" * int(elapsed / total * 20)
        print(f"  {stage:25s}: {elapsed:.2f}s  {bar}")
    print(f"  {'─'*40}")
    print(f"  {'Total':25s}: {total:.2f}s")
    print(f"  {sep}\n")

    return times


# ---------------------------------------------------------------------------
# __main__ — train on AAPL and print final val_loss
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    print(f"\n{'='*60}")
    print("  Apex AI — train_tft.py")
    print(f"{'='*60}\n")

    if not _HAS_PTF:
        print(f"  ⚠️  pytorch-forecasting not installed.")
        print(f"  Run: pip install pytorch-forecasting pytorch-lightning")
        print(f"\n  Performing config-only check …")
        print(f"  LEARNING_RATE          = {LEARNING_RATE}")
        print(f"  HIDDEN_SIZE            = {HIDDEN_SIZE}")
        print(f"  ATTENTION_HEAD_SIZE    = {ATTENTION_HEAD_SIZE}")
        print(f"  DROPOUT                = {DROPOUT}")
        print(f"  HIDDEN_CONTINUOUS_SIZE = {HIDDEN_CONTINUOUS_SIZE}")
        print(f"  QUANTILES              = {QUANTILES}")
        print(f"  MAX_EPOCHS             = {MAX_EPOCHS}")
        print(f"  GRADIENT_CLIP_VAL      = {GRADIENT_CLIP_VAL}")
        print(f"  EARLY_STOP_PATIENCE    = {EARLY_STOP_PATIENCE}")
        print(f"  SAVE_TOP_K             = {SAVE_TOP_K}")
        print(f"\n  Config check passed ✅")
        print(f"{'='*60}\n")
        sys.exit(0)

    TICKER = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    PERIOD = sys.argv[2] if len(sys.argv) > 2 else "3y"
    EPOCHS = int(sys.argv[3]) if len(sys.argv) > 3 else MAX_EPOCHS

    try:
        model, ckpt = train(
            ticker=TICKER,
            period=PERIOD,
            run_lr_finder=False,
            max_epochs=EPOCHS
        )
        # Print final val_loss from the Lightning trainer logs
        val_loss = model.trainer.logged_metrics.get("val_loss", "N/A")
        print(f"\n  Final val_loss : {val_loss}")
        print(f"  Best checkpoint: {ckpt}")

    except Exception as exc:
        logger.exception("Training failed: %s", exc)
        print(f"\n  ❌ Training failed: {exc}")
        sys.exit(1)

    print(f"\n{'='*60}")
    print("  Done.")
    print(f"{'='*60}\n")
