import math
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel

from models import PaperPortfolio, PaperPosition, PaperTrade, User
from auth_utils import get_db, get_current_user

logger = logging.getLogger("apex")
router = APIRouter(prefix="/api/paper", tags=["paper"])

@router.get("/global-stats")
def get_global_paper_stats(db: Session = Depends(get_db)):
    """Public aggregated stats for the home dashboard (no individual user context)."""
    try:
        trades = db.query(PaperTrade).filter(PaperTrade.action == "SELL").all()
        total_pnl = sum(t.pnl for t in trades if t.pnl)
        num_trades = len(trades)
        wins = len([t for t in trades if t.pnl and t.pnl > 0.0])
        win_rate = (wins / num_trades * 100) if num_trades > 0 else 0.0
        
        return {
            "total_pnl": round(total_pnl, 2),
            "total_trades": num_trades,
            "win_rate": round(win_rate, 1),
            "status": "synchronized"
        }
    except Exception as e:
        logger.error(f"Global stats error: {e}")
        return {"error": "Failed to fetch global stats"}

def _fetch_live_prices(tickers: list[str]) -> dict[str, float]:
    """Batch-fetch current prices for a list of tickers via yfinance."""
    prices: dict[str, float] = {}
    if not tickers:
        return prices
    try:
        from utils.yf_utils import get_ticker
        for t in tickers:
            try:
                info = get_ticker(t)
                hist = info.history(period="1d")
                if not hist.empty:
                    prices[t] = float(hist["Close"].iloc[-1])
            except Exception:
                pass
    except Exception as e:
        logger.debug(f"Live price fetch failed: {e}")
    return prices

class TradeRequest(BaseModel):
    ticker: str
    action: str # "BUY", "SELL"
    quantity: int
    price: float
    confidence: float = 0.5
    notes: str = ""

def get_or_create_portfolio(db: Session, user_id: int):
    portfolio = db.query(PaperPortfolio).filter(PaperPortfolio.user_id == user_id).first()
    if not portfolio:
        try:
            portfolio = PaperPortfolio(user_id=user_id, cash_balance=1000000.0)
            db.add(portfolio)
            db.commit()
            db.refresh(portfolio)
        except Exception:
            # Race condition: another request created the portfolio first
            db.rollback()
            portfolio = db.query(PaperPortfolio).filter(PaperPortfolio.user_id == user_id).first()
    return portfolio

@router.get("/positions")
def get_positions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    portfolio = get_or_create_portfolio(db, current_user.id)
    positions = db.query(PaperPosition).filter(PaperPosition.portfolio_id == portfolio.id).all()
    
    # Refresh live prices
    tickers = [p.ticker for p in positions]
    live_prices = _fetch_live_prices(tickers)
    for p in positions:
        if p.ticker in live_prices:
            p.current_price = live_prices[p.ticker]
    try:
        db.commit()
    except Exception:
        db.rollback()
    
    return {"positions": [{
        "ticker": p.ticker,
        "quantity": p.shares,
        "avg_cost": p.avg_entry_price,
        "current_price": p.current_price or p.avg_entry_price,
        "market_value": (p.current_price or p.avg_entry_price) * p.shares,
        "unrealised_pnl": ((p.current_price or p.avg_entry_price) - p.avg_entry_price) * p.shares,
        "unrealised_pct": (((p.current_price or p.avg_entry_price) / p.avg_entry_price) - 1.0) * 100.0 if p.avg_entry_price > 0 else 0.0,
        "opened_at": p.opened_at.isoformat()
    } for p in positions]}

@router.get("/history")
def get_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    portfolio = get_or_create_portfolio(db, current_user.id)
    trades = db.query(PaperTrade).filter(PaperTrade.portfolio_id == portfolio.id).order_by(PaperTrade.opened_at.desc()).all()
    
    return {"history": [{
        "id": str(t.id),
        "ticker": t.ticker,
        "action": t.action,
        "quantity": t.shares,
        "price": t.price,
        "total": t.total_value,
        "realised_pnl": t.pnl or 0.0,
        "notes": "",
        "executed_at": t.opened_at.isoformat()
    } for t in trades]}

@router.get("/summary")
def get_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    portfolio = get_or_create_portfolio(db, current_user.id)
    positions = db.query(PaperPosition).filter(PaperPosition.portfolio_id == portfolio.id).all()
    trades = db.query(PaperTrade).filter(PaperTrade.portfolio_id == portfolio.id, PaperTrade.action == "SELL").all()
    
    cash = portfolio.cash_balance
    realised_pnl = sum(t.pnl for t in trades if t.pnl)
    
    # Use current_price if available (refreshed by /positions), otherwise fall back to avg_entry
    invested = sum(p.shares * p.avg_entry_price for p in positions)
    market_value = sum(p.shares * (p.current_price or p.avg_entry_price) for p in positions)
    unrealised_pnl = market_value - invested
    
    total = cash + market_value
    ret_pct = ((total / 1000000.0) - 1.0) * 100.0
    
    num_trades = len(trades)
    wins = len([t for t in trades if t.pnl and t.pnl > 0.0])
    win_rate = (wins / num_trades * 100) if num_trades > 0 else 0.0
    
    return {
        "cash_balance": cash,
        "invested_value": invested,
        "portfolio_value": total,
        "unrealised_pnl": round(unrealised_pnl, 2),
        "realised_pnl": round(realised_pnl, 2),
        "total_return_pct": round(ret_pct, 2),
        "win_rate": round(win_rate, 1),
        "trade_count": num_trades,
        "open_positions": len(positions),
        "initial_capital": 1000000.0,
        # Legacy aliases for backward compat
        "total_value": total,
        "win_rate_pct": round(win_rate, 1),
        "total_trades": num_trades
    }

@router.post("/trade")
def execute_trade(req: TradeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    portfolio = get_or_create_portfolio(db, current_user.id)
    total_val = req.quantity * req.price
    
    if req.action == "BUY":
        if portfolio.cash_balance < total_val:
            raise HTTPException(400, f"Insufficient funds. Have {portfolio.cash_balance}, need {total_val}")
        
        portfolio.cash_balance -= total_val
        
        # update or create position
        pos = db.query(PaperPosition).filter(PaperPosition.portfolio_id == portfolio.id, PaperPosition.ticker == req.ticker).first()
        if pos:
            new_qty = pos.shares + req.quantity
            pos.avg_entry_price = ((pos.shares * pos.avg_entry_price) + total_val) / new_qty
            pos.shares = new_qty
            pos.current_price = req.price
        else:
            pos = PaperPosition(portfolio_id=portfolio.id, ticker=req.ticker, shares=req.quantity, avg_entry_price=req.price, current_price=req.price)
            db.add(pos)
            
        trade = PaperTrade(portfolio_id=portfolio.id, ticker=req.ticker, action="BUY", shares=req.quantity, price=req.price, total_value=total_val, signal_confidence=req.confidence)
        db.add(trade)
        db.commit()
        return {"status": "success", "message": f"Bought {req.quantity} {req.ticker}"}
        
    elif req.action == "SELL":
        pos = db.query(PaperPosition).filter(PaperPosition.portfolio_id == portfolio.id, PaperPosition.ticker == req.ticker).first()
        if not pos or pos.shares < req.quantity:
            raise HTTPException(400, "Insufficient shares to sell")
        
        portfolio.cash_balance += total_val
        pnl = (req.price - pos.avg_entry_price) * req.quantity
        
        pos.shares -= req.quantity
        if pos.shares <= 0:
            db.delete(pos)
            
        trade = PaperTrade(portfolio_id=portfolio.id, ticker=req.ticker, action="SELL", shares=req.quantity, price=req.price, total_value=total_val, signal_confidence=req.confidence, pnl=pnl)
        db.add(trade)
        db.commit()
        return {"status": "success", "message": f"Sold {req.quantity} {req.ticker}", "pnl": pnl}
        
    raise HTTPException(400, "Invalid action")

@router.delete("/reset")
def reset_portfolio(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    portfolio = get_or_create_portfolio(db, current_user.id)
    db.query(PaperTrade).filter(PaperTrade.portfolio_id == portfolio.id).delete()
    db.query(PaperPosition).filter(PaperPosition.portfolio_id == portfolio.id).delete()
    portfolio.cash_balance = 1000000.0
    db.commit()
    return {"status": "reset"}
