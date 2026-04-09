import pandas as pd
import numpy as np
import logging
from datetime import datetime
from utils.data_loader import fetch_data
from utils.indicators import add_technical_indicators

logger = logging.getLogger("apex_ai.tuner")

def run_tuner_backtest(ticker: str, thresholds: dict, days: int = 30) -> dict:
    """
    Simulates gateway confluence logic over historical data to evaluate threshold performance.
    """
    try:
        # 1. Fetch data
        df = fetch_data(ticker, period="3mo", interval="1d")
        if df is None or len(df) < 20:
            return {"error": "Insufficient historical data"}
        
        # 2. Add technical indicators
        df = add_technical_indicators(df)
        df = df.tail(days).copy()
        
        # 3. Simulate Signals
        # We simulate the 3-Gate confluence as defined in main.py
        # Gate 1: Cone Width (using ATR/Price as a proxy if P90/P10 isn't available historically)
        df['cone_width'] = df['ATR'] / df['Close']
        
        # Thresholds
        c_max = thresholds.get('cone_max', 0.16)
        r_lo  = thresholds.get('rsi_buy_lo', 40)
        r_hi  = thresholds.get('rsi_buy_hi', 70)
        s_buy = thresholds.get('sent_buy_min', 0.05)
        
        # Gates
        df['g1'] = df['cone_width'] < c_max
        df['g3_buy'] = (df['RSI'] >= r_lo) & (df['RSI'] <= r_hi)
        
        # Sentiment Simulation (since we don't have historical sentiment easily)
        # We'll use a small bias towards neutral-positive for testing purposes
        np.random.seed(42)
        df['sentiment'] = np.random.normal(0.05, 0.1, size=len(df))
        df['g2_buy'] = df['sentiment'] >= s_buy
        
        # Signal = Direction (Trend) + Gates
        # Using EMA cross as a simple trend proxy for backtesting gates
        df['trend'] = np.where(df['EMA_9'] > df['EMA_21'], 1, -1)
        df['signal'] = (df['trend'] == 1) & df['g1'] & df['g2_buy'] & df['g3_buy']
        
        # 4. Compute P&L
        # Simplified: Buy on signal, hold 3 days or until signal flips
        pnl = []
        wins = 0
        total_trades = 0
        
        prices = df['Close'].values
        signals = df['signal'].values
        
        for i in range(len(df) - 3):
            if signals[i]:
                # Entry at close i, exit at close i+3
                ret = (prices[i+3] - prices[i]) / prices[i]
                pnl.append(ret)
                total_trades += 1
                if ret > 0: wins += 1
        
        win_rate = (wins / total_trades * 100) if total_trades > 0 else 0
        cumulative = np.prod(1 + np.array(pnl)) - 1 if pnl else 0
        
        return {
            "win_rate": round(win_rate, 2),
            "total_return_pct": round(cumulative * 100, 2),
            "total_trades": total_trades,
            "avg_trade_pct": round(np.mean(pnl) * 100, 2) if pnl else 0,
            "status": "SUCCESS"
        }
        
    except Exception as e:
        logger.error(f"Backtest error: {e}")
        return {"error": str(e)}

def run_neural_optimization(ticker: str) -> dict:
    """
    Heuristic search for optimal thresholds on a specific ticker.
    """
    # Grid of candidate thresholds
    cone_grid = [0.10, 0.14, 0.18, 0.22]
    rsi_lo_grid = [30, 40, 50]
    rsi_hi_grid = [60, 70, 80]
    sent_grid = [0.01, 0.05, 0.10]
    
    best_score = -999
    best_config = {}
    
    # Pre-fetch data once
    df = fetch_data(ticker, period="3mo", interval="1d")
    if df is None: return {"error": "Fetch failed"}
    df = add_technical_indicators(df)
    df = df.tail(60).copy() # 60 day history for optimization
    
    # We optimize for a "Neural Score" = WinRate * Return
    for c in cone_grid:
        for rl in rsi_lo_grid:
            for rh in rsi_hi_grid:
                for s in sent_grid:
                    config = {
                        "cone_max": c,
                        "rsi_buy_lo": rl,
                        "rsi_buy_hi": rh,
                        "sent_buy_min": s
                    }
                    # Internal simulation logic (faster than calling backtest func)
                    # Simplified for speed
                    df_sim = df.copy()
                    df_sim['cone_width'] = df_sim['ATR'] / df_sim['Close']
                    df_sim['g1'] = df_sim['cone_width'] < c
                    df_sim['g3_buy'] = (df_sim['RSI'] >= rl) & (df_sim['RSI'] <= rh)
                    
                    # Sentiment simulation baseline
                    np.random.seed(42)
                    df_sim['sentiment'] = np.random.normal(0.05, 0.1, size=len(df_sim))
                    df_sim['g2_buy'] = df_sim['sentiment'] >= s
                    
                    df_sim['trend'] = np.where(df_sim['EMA_9'] > df_sim['EMA_21'], 1, -1)
                    df_sim['signal'] = (df_sim['trend'] == 1) & df_sim['g1'] & df_sim['g2_buy'] & df_sim['g3_buy']
                    
                    prices = df_sim['Close'].values
                    signals = df_sim['signal'].values
                    trades_pnl = []
                    
                    for i in range(len(df_sim) - 3):
                        if signals[i]:
                            trades_pnl.append((prices[i+3] - prices[i]) / prices[i])
                    
                    if not trades_pnl: continue
                    
                    wr = len([p for p in trades_pnl if p > 0]) / len(trades_pnl)
                    ret = np.mean(trades_pnl)
                    score = wr * 1.5 + ret * 10.0 # Balanced metric
                    
                    if score > best_score:
                        best_score = score
                        best_config = config

    return {
        "best_config": best_config,
        "optimized_score": round(best_score, 4),
        "status": "OPTIMIZED"
    }
