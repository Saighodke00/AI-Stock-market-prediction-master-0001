"""
backtest.py
===========
Apex AI — Vectorized Backtesting Engine
---------------------------------------
A professional-grade, vectorized backtesting engine designed for evaluating
the performance of TFT median return forecasts (p50) against historical data.
Instead of slow row-by-row iteration, this uses pandas vectorization to
instantly calculate equity curves and risk metrics.

API
---
    BacktestConfig (dataclass)
    Trade (dataclass)
    run_backtest(df, predictions_dict, config) -> tuple[pd.Series, list[Trade]]
    calculate_metrics(equity_curve, trades)    -> dict
    plot_backtest_results(equity_curve, trades, ticker)

Author: Apex AI Team
Requires: pandas, numpy, matplotlib
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Tuple

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

logger = logging.getLogger("apex_ai.backtest")

# ===========================================================================
# ── CONFIG: Data Structures ────────────────────────────────────────────────
# ===========================================================================

@dataclass
class BacktestConfig:
    """Configuration parameters for the backtest engine."""
    initial_capital: float = 10_000.0
    position_size: float = 1.0          # Fraction of capital to deploy per trade (0.0 to 1.0)
    trading_fee_pct: float = 0.001      # e.g. 0.1% commission per trade
    slippage_pct: float = 0.0005        # e.g. 0.05% slippage
    stop_loss_pct: float = 0.05         # 5% stop loss
    take_profit_pct: float = 0.10       # 10% take profit

@dataclass
class Trade:
    """Record of a single executed trade."""
    entry_date: pd.Timestamp
    exit_date: pd.Timestamp
    entry_price: float
    exit_price: float
    direction: str          # 'LONG' or 'SHORT'
    pnl_pct: float          # Percentage profit/loss
    pnl_abs: float          # Absolute profit/loss in dollars
    reason: str             # e.g., 'Signal Reversal', 'Stop Loss', 'Take Profit'


# ===========================================================================
# ── FUNCTION: run_backtest ─────────────────────────────────────────────────
# ===========================================================================
def run_backtest(
    df: pd.DataFrame, 
    predictions_series: pd.Series, 
    config: BacktestConfig = BacktestConfig()
) -> Tuple[pd.Series, List[Trade]]:
    """Execute a vectorized backtest for the provided price data and AI predictions.
    
    Strategy Logic
    --------------
    * LONG: If the model predicts a postive return (p50 > 0).
    * FLAT: If the model predicts a non-positive return (p50 <= 0).
    * (We assume daily execution: signal evaluated on Close, executed on next Open).
    
    Parameters
    ----------
    df : pd.DataFrame
        Must contain 'Open', 'High', 'Low', 'Close'. Index should be Datetime.
    predictions_series : pd.Series
        Predicted percentage returns for the *next* day, aligned with df's index.
        e.g. predictions_series.loc['2023-01-01'] is the prediction for the return on 2023-01-02.
    config : BacktestConfig
        Parameters governing fees, capital, and position sizing.
        
    Returns
    -------
    tuple
        (equity_curve_series, list_of_trades)
    """
    if len(df) == 0 or len(predictions_series) == 0:
        logger.warning("run_backtest: Empty DataFrame or predictions.")
        return pd.Series(dtype=float), []
        
    # Align data to ensure we are only testing where we have both price and predictions
    combined = df[['Open', 'High', 'Low', 'Close']].copy()
    combined['Pred_Return'] = predictions_series
    combined = combined.dropna()
    
    n = len(combined)
    if n < 2:
        return pd.Series([config.initial_capital], index=combined.index), []

    # ── 1. Vectorized Signal Generation ──────────────────────────────────────
    # Signal = 1 if predicted return > 0 (LONG), else 0 (FLAT)
    # We shift the signal forward by 1 because a prediction made today 
    # determines our position for tomorrow.
    signals = (combined['Pred_Return'] > 0).astype(int).shift(1).fillna(0)
    
    # ── 2. Vectorized Return Calculation ─────────────────────────────────────
    # Standard daily return = (Close today / Close yesterday) - 1
    # Note: realistically, if trading on daily closes, we capture the close-to-close return.
    actual_returns = combined['Close'].pct_change().fillna(0)
    
    # Strategy Return = Signal * Actual Return
    strategy_returns = signals * actual_returns
    
    # Apply Fees & Slippage ONLY when the signal changes (a trade is executed)
    signal_diff = signals.diff().fillna(0)
    trades_mask = signal_diff != 0
    num_trades = trades_mask.sum()
    
    # Calculate costs as a penalty to the return on days we trade
    total_cost_pct = config.trading_fee_pct + config.slippage_pct
    strategy_returns[trades_mask] -= total_cost_pct
    
    # ── 3. Equity Curve Calculation ──────────────────────────────────────────
    # Cumulative product of (1 + daily strategy returns)
    cumulative_returns = (1 + strategy_returns).cumprod()
    equity_curve = config.initial_capital * cumulative_returns
    
    # Provide the starting capital at the beginning of the curve (at index t-1 effectively)
    equity_curve.iloc[0] = config.initial_capital
    
    # ── 4. Trade Log Generation (Iterative for precise logging) ────────────────
    trades = []
    in_position = False
    entry_date = None
    entry_price = 0.0
    
    dates = combined.index
    closes = combined['Close'].values
    sigs = signals.values
    
    for i in range(1, len(combined)):
        current_sig = sigs[i]
        prev_sig = sigs[i-1]
        
        # Enter LONG
        if current_sig == 1 and prev_sig == 0:
            in_position = True
            entry_date = dates[i]
            entry_price = closes[i-1] # Assume entry at previous close (or today's open, simplistic here)
            
        # Exit LONG
        elif current_sig == 0 and prev_sig == 1 and in_position:
            exit_date = dates[i]
            exit_price = closes[i]
            pnl_pct = (exit_price / entry_price) - 1 - total_cost_pct
            
            # Simple assumption: deploying all capital
            capital_at_entry = equity_curve.iloc[i-1] 
            pnl_abs = capital_at_entry * pnl_pct
            
            trades.append(Trade(
                entry_date=entry_date,
                exit_date=exit_date,
                entry_price=entry_price,
                exit_price=exit_price,
                direction='LONG',
                pnl_pct=pnl_pct,
                pnl_abs=pnl_abs,
                reason='Signal Reversal'
            ))
            in_position = False

    # Force close any open position at the end of the backtest
    if in_position:
        exit_date = dates[-1]
        exit_price = closes[-1]
        pnl_pct = (exit_price / entry_price) - 1 - total_cost_pct
        pnl_abs = equity_curve.iloc[-2] * pnl_pct
        trades.append(Trade(
            entry_date=entry_date,
            exit_date=exit_date,
            entry_price=entry_price,
            exit_price=exit_price,
            direction='LONG',
            pnl_pct=pnl_pct,
            pnl_abs=pnl_abs,
            reason='End of Backtest'
        ))

    logger.info(f"Backtest complete. Simulated {len(trades)} trades over {n} days.")
    return equity_curve, trades


# ===========================================================================
# ── FUNCTION: calculate_metrics ────────────────────────────────────────────
# ===========================================================================
def calculate_metrics(equity_curve: pd.Series, trades: List[Trade]) -> Dict[str, float]:
    """Calculate professional performance metrics from an equity curve and trade list.
    
    Returns
    -------
    dict
        Contains Total Return, CAGR, Sharpe, Sortino, Max Drawdown, Win Rate, Profit Factor.
    """
    if len(equity_curve) < 2:
        return {}

    # 1. Curve-based metrics
    daily_returns = equity_curve.pct_change().dropna()
    total_return_pct = (equity_curve.iloc[-1] / equity_curve.iloc[0]) - 1

    days = (equity_curve.index[-1] - equity_curve.index[0]).days
    years = max(days / 365.25, 0.01) # Avoid div by zero
    cagr = (1 + total_return_pct) ** (1 / years) - 1

    # Annualised volatility
    ann_vol = daily_returns.std() * np.sqrt(252)

    # Sharpe Ratio (assuming 0% risk free rate for simplicity)
    sharpe = (cagr / ann_vol) if ann_vol != 0 else 0.0

    # Sortino Ratio (downside deviation only)
    downside_returns = daily_returns[daily_returns < 0]
    downside_vol = downside_returns.std() * np.sqrt(252)
    sortino = (cagr / downside_vol) if downside_vol != 0 else 0.0

    # Maximum Drawdown
    running_max = equity_curve.cummax()
    drawdowns = (equity_curve - running_max) / running_max
    max_drawdown = drawdowns.min()

    # 2. Trade-based metrics
    win_rate = 0.0
    profit_factor = 0.0
    
    if trades:
        winning_trades = [t.pnl_abs for t in trades if t.pnl_abs > 0]
        losing_trades = [t.pnl_abs for t in trades if t.pnl_abs <= 0]
        
        win_rate = len(winning_trades) / len(trades)
        
        gross_profit = sum(winning_trades)
        gross_loss = abs(sum(losing_trades))
        profit_factor = (gross_profit / gross_loss) if gross_loss != 0 else float('inf')

    return {
        "Total Return (%)": total_return_pct * 100,
        "CAGR (%)": cagr * 100,
        "Max Drawdown (%)": max_drawdown * 100,
        "Sharpe Ratio": sharpe,
        "Sortino Ratio": sortino,
        "Win Rate (%)": win_rate * 100,
        "Profit Factor": profit_factor,
        "Total Trades": len(trades)
    }


# ===========================================================================
# ── FUNCTION: plot_backtest_results ────────────────────────────────────────
# ===========================================================================
def plot_backtest_results(equity_curve: pd.Series, trades: List[Trade], ticker: str) -> None:
    """Render a clean, professional plot of the Equity Curve."""
    import matplotlib.dates as mdates
    
    plt.style.use('dark_background')
    fig, ax = plt.subplots(figsize=(12, 6))
    
    # Plot equity curve
    ax.plot(equity_curve.index, equity_curve.values, color='#00f2fe', linewidth=2, label='Strategy Equity')
    
    # Fill area under the curve
    ax.fill_between(equity_curve.index, equity_curve.values, equity_curve.values.min() * 0.99, 
                    color='#00f2fe', alpha=0.1)

    # Formatting
    ax.set_title(f"Apex AI Backtest Results: {ticker}", fontsize=16, fontweight='bold', pad=20, color='white')
    ax.set_ylabel("Account Balance ($)", fontsize=12, color='#aaaaaa')
    ax.grid(True, linestyle='--', alpha=0.2)
    
    # Format x-axis dates
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
    plt.xticks(rotation=45)
    
    # Hide unnecessary spines
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#333333')
    ax.spines['bottom'].set_color('#333333')
    
    # Add a watermark or legend
    ax.legend(loc='upper left', frameon=False, labelcolor='white')
    
    plt.tight_layout()
    plt.savefig('plots/latest_backtest.png', dpi=150)
    logger.info("Saved backtest plot to plots/latest_backtest.png")
    # plt.show() # Uncomment if running interactively


# ===========================================================================
# ── __main__ — Demonstration Block ─────────────────────────────────────────
# ===========================================================================
if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  Apex AI — backtest.py demonstration")
    print("=" * 60 + "\n")
    
    import os
    os.makedirs('plots', exist_ok=True)
    
    # 1. Generate Synthetic Price Data (1 year of daily trading)
    np.random.seed(42)
    dates = pd.date_range(start="2023-01-01", periods=252, freq="B")
    
    # Random walk with slight upward drift
    returns = np.random.normal(0.0005, 0.015, 252)
    prices = 100 * (1 + returns).cumprod()
    
    df_mock = pd.DataFrame({
        'Open': prices * (1 - np.random.uniform(0, 0.005, 252)),
        'High': prices * (1 + np.random.uniform(0, 0.01, 252)),
        'Low': prices * (1 - np.random.uniform(0, 0.01, 252)),
        'Close': prices
    }, index=dates)
    
    # 2. Generate Synthetic Model Predictions (with some predictive edge)
    # We predict the actual next day return + some noise. 
    # If edge > 0, the strategy should be profitable.
    future_returns = df_mock['Close'].pct_change().shift(-1).fillna(0)
    predictive_edge = 0.6 # 60% correlation
    noise = np.random.normal(0, 0.02, 252)
    predictions = (future_returns * predictive_edge) + (noise * (1 - predictive_edge))
    pred_series = pd.Series(predictions, index=dates)
    
    # 3. Run Backtest
    print("▶ Running Vectorized Backtest...")
    config = BacktestConfig(initial_capital=10000.0, trading_fee_pct=0.001)
    equity, trade_log = run_backtest(df_mock, pred_series, config)
    
    # 4. Calculate Metrics
    print("▶ Calculating Risk & Performance Metrics...\n")
    metrics = calculate_metrics(equity, trade_log)
    
    for k, v in metrics.items():
        if "Ratio" in k or k == "Profit Factor":
            print(f"  {k:<20}: {v:.2f}")
        else:
            print(f"  {k:<20}: {v:.2f}")
            
    # 5. Plot
    print("\n▶ Generating Plot...")
    plot_backtest_results(equity, trade_log, "MOCK_TICKER")
    
    print("\n" + "=" * 60)
    print("  Demonstration complete.")
    print("=" * 60 + "\n")
