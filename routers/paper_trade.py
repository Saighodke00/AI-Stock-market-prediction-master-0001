import math
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel

from models import PaperPortfolio, PaperPosition, PaperTrade, User
from auth_utils import get_db, get_current_user

router = APIRouter(prefix="/api/paper", tags=["paper"])

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
    
    # We send back simple JSON array
    return {"positions": [{
        "ticker": p.ticker,
        "quantity": p.shares,
        "avg_cost": p.avg_entry_price,
        "current_price": p.current_price,
        "market_value": p.current_price * p.shares,
        "unrealised_pnl": (p.current_price - p.avg_entry_price) * p.shares,
        "unrealised_pct": ((p.current_price / p.avg_entry_price) - 1.0) * 100.0 if p.avg_entry_price > 0 else 0.0,
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
    
    # Needs live prices to truly get unrealised, but we'll approximate with cost
    invested = sum(p.shares * p.avg_entry_price for p in positions)
    unrealised_pnl = 0.0 # Without live prices right here.
    
    total = cash + invested + unrealised_pnl
    ret_pct = ((total / 1000000.0) - 1.0) * 100.0
    
    num_trades = len(trades)
    wins = len([t for t in trades if t.pnl and t.pnl > 0.0])
    win_rate = (wins / num_trades * 100) if num_trades > 0 else 0.0
    
    return {
        "cash_balance": cash,
        "invested_value": invested,
        "portfolio_value": total,
        "unrealised_pnl": unrealised_pnl,
        "realised_pnl": realised_pnl,
        "total_return_pct": ret_pct,
        "win_rate": win_rate,
        "trade_count": num_trades,
        "open_positions": len(positions),
        "initial_capital": 1000000.0,
        # Legacy aliases for backward compat
        "total_value": total,
        "win_rate_pct": win_rate,
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
        else:
            pos = PaperPosition(portfolio_id=portfolio.id, ticker=req.ticker, shares=req.quantity, avg_entry_price=req.price)
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
