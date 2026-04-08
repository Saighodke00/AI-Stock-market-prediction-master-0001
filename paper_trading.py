from __future__ import annotations
import json
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal


Action = Literal["BUY", "SELL"]

INITIAL_CASH = 1_000_000.0   # ₹10 lakh starting capital


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class _Position:
    ticker:     str
    quantity:   int
    avg_cost:   float          # FIFO average cost per share
    opened_at:  str            # ISO timestamp of first buy

    def market_value(self, price: float) -> float:
        return self.quantity * price

    def unrealised_pnl(self, price: float) -> float:
        return (price - self.avg_cost) * self.quantity

    def unrealised_pct(self, price: float) -> float:
        if self.avg_cost == 0:
            return 0.0
        return (price - self.avg_cost) / self.avg_cost * 100

    def to_dict(self, current_price: float | None = None) -> dict:
        cp = current_price or self.avg_cost    # fallback to cost if no live price
        return {
            "ticker":           self.ticker,
            "quantity":         self.quantity,
            "avg_cost":         self.avg_cost,
            "opened_at":        self.opened_at,
        }

    @classmethod
    def from_dict(cls, d: dict) -> _Position:
        return cls(
            ticker=d["ticker"],
            quantity=d["quantity"],
            avg_cost=d["avg_cost"],
            opened_at=d["opened_at"],
        )


@dataclass
class _Trade:
    id:            str
    ticker:        str
    action:        Action
    quantity:      int
    price:         float
    total:         float       # quantity × price (positive = cash out for BUY)
    realised_pnl:  float       # 0 for BUY trades; computed on SELL
    notes:         str
    executed_at:   str

    def to_dict(self) -> dict:
        return {
            "id":            self.id,
            "ticker":        self.ticker,
            "action":        self.action,
            "quantity":      self.quantity,
            "price":         self.price,
            "total":         self.total,
            "realised_pnl":  self.realised_pnl,
            "notes":         self.notes,
            "executed_at":   self.executed_at,
        }

    @classmethod
    def from_dict(cls, d: dict) -> _Trade:
        return cls(
            id=d["id"], ticker=d["ticker"], action=d["action"],
            quantity=d["quantity"], price=d["price"], total=d["total"],
            realised_pnl=d["realised_pnl"], notes=d["notes"],
            executed_at=d["executed_at"]
        )


class PaperPortfolio:
    """Thread-safe (GIL level) paper trading engine with persistence."""

    def __init__(self) -> None:
        self._positions: dict[str, _Position] = {}
        self._history:   list[_Trade]         = []
        self._cash:      float                = INITIAL_CASH
        self._realised:  float                = 0.0

    # ─── Public API ──────────────────────────────────────────────────────────

    def execute_trade(
        self,
        ticker:   str,
        action:   Action,
        quantity: int,
        price:    float,
        notes:    str = "",
    ) -> dict:
        if quantity <= 0:
            raise ValueError(f"Quantity must be positive, got {quantity}")
        if price <= 0:
            raise ValueError(f"Price must be positive, got {price}")

        action = action.upper()  # type: ignore[assignment]
        if action not in ("BUY", "SELL"):
            raise ValueError(f"Action must be BUY or SELL, got {action!r}")

        realised_pnl = 0.0

        if action == "BUY":
            cost = quantity * price
            if cost > self._cash:
                raise ValueError(
                    f"Insufficient cash: need ₹{cost:,.2f}, have ₹{self._cash:,.2f}"
                )
            self._cash -= cost
            self._update_position_buy(ticker, quantity, price)

        else:  # SELL
            pos = self._positions.get(ticker)
            if pos is None or pos.quantity < quantity:
                held = pos.quantity if pos else 0
                raise ValueError(
                    f"Insufficient shares: trying to sell {quantity} of {ticker}, "
                    f"but only holding {held}"
                )
            realised_pnl = (price - pos.avg_cost) * quantity
            self._realised += realised_pnl
            self._cash += quantity * price
            self._update_position_sell(ticker, quantity)

        trade = _Trade(
            id           = str(uuid.uuid4())[:8],
            ticker       = ticker,
            action       = action,
            quantity     = quantity,
            price        = price,
            total        = quantity * price,
            realised_pnl = realised_pnl,
            notes        = notes,
            executed_at  = _now_iso(),
        )
        self._history.append(trade)

        return {
            "status":        "ok",
            "trade":         trade.to_dict(),
            "cash_remaining": round(self._cash, 2),
            "realised_pnl":  round(self._realised, 2),
        }

    def get_positions(self, live_prices: dict[str, float] | None = None) -> list[dict]:
        lp = live_prices or {}
        # We use a custom to_dict helper for the frontend that includes MTM fields
        return [
            {
                **p.to_dict(),
                "current_price":  round(lp.get(t, p.avg_cost), 2),
                "market_value":   round(p.market_value(lp.get(t, p.avg_cost)), 2),
                "unrealised_pnl": round(p.unrealised_pnl(lp.get(t, p.avg_cost)), 2),
                "unrealised_pct": round(p.unrealised_pct(lp.get(t, p.avg_cost)), 2),
            } 
            for t, p in self._positions.items()
        ]

    def get_history(self) -> list[dict]:
        return [t.to_dict() for t in reversed(self._history)]

    def get_summary(self, live_prices: dict[str, float] | None = None) -> dict:
        lp = live_prices or {}
        unrealised = sum(
            p.unrealised_pnl(lp.get(t, p.avg_cost))
            for t, p in self._positions.items()
        )
        invested = sum(
            p.quantity * p.avg_cost for p in self._positions.values()
        )
        portfolio_value = self._cash + invested

        sell_trades  = [t for t in self._history if t.action == "SELL"]
        winning      = [t for t in sell_trades   if t.realised_pnl > 0]
        win_rate     = len(winning) / len(sell_trades) if sell_trades else 0.0

        total_return = (portfolio_value + self._realised - INITIAL_CASH) / INITIAL_CASH * 100

        return {
            "cash_balance":       round(self._cash, 2),
            "invested_value":     round(invested, 2),
            "portfolio_value":    round(portfolio_value, 2),
            "unrealised_pnl":     round(unrealised, 2),
            "realised_pnl":       round(self._realised, 2),
            "total_return_pct":   round(total_return, 2),
            "win_rate":           round(win_rate * 100, 1),
            "trade_count":        len(self._history),
            "open_positions":     len(self._positions),
            "initial_capital":    INITIAL_CASH,
        }

    def reset(self) -> None:
        self._positions.clear()
        self._history.clear()
        self._cash     = INITIAL_CASH
        self._realised = 0.0

    # ─── Persistence ──────────────────────────────────────────────────────────

    def save_to_file(self, filepath: str) -> None:
        """Serialize entire state to JSON."""
        data = {
            "positions": {t: p.to_dict() for t, p in self._positions.items()},
            "history":   [t.to_dict() for t in self._history],
            "cash":      self._cash,
            "realised":  self._realised
        }
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)

    def load_from_file(self, filepath: str) -> bool:
        """Load state from JSON. Return True if successful."""
        if not os.path.exists(filepath):
            return False
        try:
            with open(filepath, "r") as f:
                data = json.load(f)
            self._cash     = data.get("cash", INITIAL_CASH)
            self._realised = data.get("realised", 0.0)
            self._positions = {
                t: _Position.from_dict(d) 
                for t, d in data.get("positions", {}).items()
            }
            self._history = [
                _Trade.from_dict(d)
                for d in data.get("history", [])
            ]
            return True
        except Exception:
            return False

    # ─── Internal ────────────────────────────────────────────────────────────

    def _update_position_buy(self, ticker: str, qty: int, price: float) -> None:
        if ticker in self._positions:
            pos = self._positions[ticker]
            total_qty  = pos.quantity + qty
            total_cost = pos.avg_cost * pos.quantity + price * qty
            pos.avg_cost = total_cost / total_qty
            pos.quantity = total_qty
        else:
            self._positions[ticker] = _Position(
                ticker    = ticker,
                quantity  = qty,
                avg_cost  = price,
                opened_at = _now_iso(),
            )

    def _update_position_sell(self, ticker: str, qty: int) -> None:
        pos = self._positions[ticker]
        pos.quantity -= qty
        if pos.quantity == 0:
            del self._positions[ticker]
