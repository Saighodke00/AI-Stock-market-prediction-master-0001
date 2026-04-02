"""
risk_manager.py
===============
Apex AI - Risk Management Engine
---------------------------------
Provides institutional-grade risk controls:
  • Position sizing based on account equity and ATR volatility.
  • Dynamic SL/TP generation using model quantiles (P10/P90) and ATR buffers.
  • Risk/Reward (R:R) ratio calculation and validation.

Author : Apex AI Team
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, Optional

class RiskManager:
    """
    Orchestrates trade sizing and exit strategies.
    
    Default parameters assume a $100,000 portfolio with 1% risk per trade.
    """
    
    def __init__(
        self, 
        default_capital: float = 100000.0, 
        default_risk_pct: float = 0.01,
        atr_multiplier: float = 2.0
    ):
        self.default_capital = default_capital
        self.default_risk_pct = default_risk_pct
        self.atr_multiplier = atr_multiplier

    def get_sl_tp(
        self, 
        direction: str, 
        current_price: float, 
        p10: float, 
        p50: float, 
        p90: float, 
        atr: float
    ) -> Dict[str, float]:
        """
        Calculate suggested SL and TP based on quantiles and ATR.
        
        Logic:
          - BUY: SL is the lower of P10 or (Price - 2*ATR). TP is P90.
          - SELL: SL is the higher of P90 or (Price + 2*ATR). TP is P10.
        """
        if direction == "BUY":
            # For a long, SL should be below price. We use P10 but cap it at a max distance of 2*ATR for safety.
            atr_sl = current_price - (self.atr_multiplier * atr)
            suggested_sl = min(p10, atr_sl) if p10 < current_price else atr_sl
            suggested_tp = p90 if p90 > current_price else current_price + (self.atr_multiplier * atr * 1.5)
        elif direction == "SELL":
            # For a short, SL should be above price. We use P90 but cap it at a max distance of 2*ATR.
            atr_sl = current_price + (self.atr_multiplier * atr)
            suggested_sl = max(p90, atr_sl) if p90 > current_price else atr_sl
            suggested_tp = p10 if p10 < current_price else current_price - (self.atr_multiplier * atr * 1.5)
        else:
            suggested_sl = current_price
            suggested_tp = current_price

        return {
            "sl": round(float(suggested_sl), 2),
            "tp": round(float(suggested_tp), 2)
        }


    def calculate_position_size(
        self, 
        entry_price: float, 
        stop_loss: float, 
        capital: Optional[float] = None, 
        risk_pct: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Standard Risk-First position sizing.
        Formula: Quantity = (Capital * Risk%) / (Entry - SL)
        """
        cap = capital or self.default_capital
        r_pct = risk_pct or self.default_risk_pct
        
        risk_amount = cap * r_pct
        sl_distance = abs(entry_price - stop_loss)
        
        if sl_distance <= 0:
            return {"quantity": 0, "nominal_value": 0.0, "risk_amount": risk_amount}
        
        quantity = int(risk_amount / sl_distance)
        nominal_value = quantity * entry_price
        
        return {
            "quantity": quantity,
            "nominal_value": round(float(nominal_value), 2),
            "risk_amount": round(float(risk_amount), 2),
            "capital_utilized_pct": round(float((nominal_value / cap) * 100), 2)
        }

    def calculate_risk_reward(
        self, 
        entry: float, 
        sl: float, 
        tp: float
    ) -> float:
        """Calculate the Risk:Reward ratio."""
        risk = abs(entry - sl)
        reward = abs(tp - entry)
        
        if risk <= 0:
            return 0.0
        
        return round(float(reward / risk), 2)

    def analyze_risk(
        self, 
        ticker: str,
        direction: str, 
        current_price: float, 
        p10: float, 
        p50: float, 
        p90: float, 
        atr: float
    ) -> Dict[str, Any]:
        """
        Top-level method to produce a complete risk report for a signal.
        """
        exits = self.get_sl_tp(direction, current_price, p10, p50, p90, atr)
        sl, tp = exits["sl"], exits["tp"]
        
        sizing = self.calculate_position_size(current_price, sl)
        rr = self.calculate_risk_reward(current_price, sl, tp)
        
        return {
            "ticker": ticker,
            "direction": direction,
            "entry_price": round(current_price, 2),
            "suggested_sl": sl,
            "suggested_tp": tp,
            "risk_reward_ratio": rr,
            "position_sizing": sizing,
            "is_viable": rr >= 1.2 and sizing["quantity"] > 0
        }
