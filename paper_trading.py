import logging
import yfinance as yf
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Dict, Any, List, Optional
from models import PaperPortfolio, PaperPosition, PaperTrade, SessionLocal, init_db

# ── LOGGING ──────────────────────────────────────────────────────────────────
logger = logging.getLogger("apex_ai.paper_trading")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(name)s — %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

# ── CORE FUNCTIONS ──────────────────────────────────────────────────────────

def get_current_price(ticker: str) -> float:
    """Fetch the latest price for a ticker using yfinance."""
    try:
        data = yf.download(ticker, period="1d", interval="1m", progress=False)
        if not data.empty:
            return float(data['Close'].iloc[-1])
        # Fallback to last day close if intraday fails
        ticker_obj = yf.Ticker(ticker)
        return float(ticker_obj.info.get('regularMarketPrice') or ticker_obj.fast_info['lastPrice'])
    except Exception as e:
        logger.error(f"Error fetching price for {ticker}: {e}")
        return 0.0

def follow_signal(db: Session, portfolio_id: int, ticker: str, action: str, current_price: float, confidence: float) -> Dict[str, Any]:
    """
    Executes a paper trade based on a signal.
    BUY: Allocates 10% of total portfolio value.
    SELL: Closes the entire position.
    """
    portfolio = db.query(PaperPortfolio).filter(PaperPortfolio.id == portfolio_id).first()
    if not portfolio:
        raise ValueError(f"Portfolio ID {portfolio_id} not found.")

    # Calculate Total Portfolio Value (Cash + Current Positions Value)
    open_positions = db.query(PaperPosition).filter(PaperPosition.portfolio_id == portfolio_id).all()
    positions_value = 0.0
    for pos in open_positions:
        # For allocation calc, we use entry price or can fetch live. Let's use cash+positions entry for stability or live for accuracy.
        # User requested: "allocate 10% of current portfolio value"
        price = get_current_price(pos.ticker)
        positions_value += pos.shares * (price if price > 0 else pos.avg_entry_price)
    
    total_value = portfolio.cash_balance + positions_value

    if action.upper() == "BUY":
        allocation = total_value * 0.10
        if allocation > portfolio.cash_balance:
            allocation = portfolio.cash_balance # Cap at available cash
        
        if allocation <= 0 or current_price <= 0:
            return {"status": "error", "message": "Inadequate cash or invalid price"}

        shares_to_buy = allocation / current_price
        
        # Update/Create Position
        existing_pos = db.query(PaperPosition).filter(PaperPosition.portfolio_id == portfolio_id, PaperPosition.ticker == ticker).first()
        if existing_pos:
            # Scale in (average up/down)
            total_shares = existing_pos.shares + shares_to_buy
            new_avg_price = ((existing_pos.shares * existing_pos.avg_entry_price) + (shares_to_buy * current_price)) / total_shares
            existing_pos.shares = total_shares
            existing_pos.avg_entry_price = new_avg_price
        else:
            new_pos = PaperPosition(
                portfolio_id=portfolio_id,
                ticker=ticker,
                shares=shares_to_buy,
                avg_entry_price=current_price,
                current_price=current_price
            )
            db.add(new_pos)

        # Deduct cash
        portfolio.cash_balance -= (shares_to_buy * current_price)

        # Record Trade
        trade = PaperTrade(
            portfolio_id=portfolio_id,
            ticker=ticker,
            action="BUY",
            shares=shares_to_buy,
            price=current_price,
            total_value=shares_to_buy * current_price,
            signal_confidence=confidence,
            opened_at=datetime.utcnow()
        )
        db.add(trade)
        db.commit()
        return {"status": "success", "action": "BUY", "ticker": ticker, "shares": shares_to_buy}

    elif action.upper() == "SELL":
        pos = db.query(PaperPosition).filter(PaperPosition.portfolio_id == portfolio_id, PaperPosition.ticker == ticker).first()
        if not pos:
            return {"status": "error", "message": f"No open position in {ticker} to sell."}

        # Realize PnL
        proceeds = pos.shares * current_price
        pnl = (current_price - pos.avg_entry_price) * pos.shares
        
        # Add to cash
        portfolio.cash_balance += proceeds

        # Record Trade
        trade = PaperTrade(
            portfolio_id=portfolio_id,
            ticker=ticker,
            action="SELL",
            shares=pos.shares,
            price=current_price,
            total_value=proceeds,
            signal_confidence=confidence,
            pnl=pnl,
            opened_at=pos.opened_at,
            closed_at=datetime.utcnow()
        )
        db.add(trade)
        
        # Remove Position
        db.delete(pos)
        db.commit()
        return {"status": "success", "action": "SELL", "ticker": ticker, "pnl": pnl}

    return {"status": "error", "message": "Invalid action"}

def get_portfolio_summary(db: Session, portfolio_id: int) -> Dict[str, Any]:
    """Fetches full snapshot of portfolio with live performance metrics."""
    portfolio = db.query(PaperPortfolio).filter(PaperPortfolio.id == portfolio_id).first()
    if not portfolio:
        return {}

    open_positions = db.query(PaperPosition).filter(PaperPosition.portfolio_id == portfolio_id).all()
    
    positions_data = []
    total_unrealized_pnl = 0.0
    current_market_value = 0.0

    for pos in open_positions:
        # Use stored current_price (updated by background task)
        cur_price = pos.current_price if pos.current_price > 0 else pos.avg_entry_price
        unrealized_pnl = (cur_price - pos.avg_entry_price) * pos.shares
        pnl_pct = (cur_price / pos.avg_entry_price - 1) * 100 if pos.avg_entry_price > 0 else 0
        
        positions_data.append({
            "ticker": pos.ticker,
            "shares": pos.shares,
            "entry": pos.avg_entry_price,
            "current": cur_price,
            "pnl": unrealized_pnl,
            "pnl_pct": pnl_pct
        })
        
        total_unrealized_pnl += unrealized_pnl
        current_market_value += (pos.shares * cur_price)

    # Performance Stats
    trades = db.query(PaperTrade).filter(PaperTrade.portfolio_id == portfolio_id, PaperTrade.action == "SELL").all()
    total_trades = len(trades)
    winning_trades = len([t for t in trades if (t.pnl or 0) > 0])
    win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
    
    total_value = portfolio.cash_balance + current_market_value
    total_return_pct = (total_value / 100000.0 - 1) * 100 # Assuming 100k start

    return {
        "cash_balance": portfolio.cash_balance,
        "market_value": current_market_value,
        "total_value": total_value,
        "total_return_pct": total_return_pct,
        "win_rate": win_rate,
        "num_trades": total_trades,
        "positions": positions_data
    }

def reset_portfolio(db: Session, portfolio_id: int):
    """Resets portfolio to initial 100k state."""
    portfolio = db.query(PaperPortfolio).filter(PaperPortfolio.id == portfolio_id).first()
    if portfolio:
        portfolio.cash_balance = 100000.0
        # Clear positions and trades
        db.query(PaperPosition).filter(PaperPosition.portfolio_id == portfolio_id).delete()
        db.query(PaperTrade).filter(PaperTrade.portfolio_id == portfolio_id).delete()
        db.commit()

def update_all_position_prices(db: Session):
    """Background task to refresh all open position prices."""
    positions = db.query(PaperPosition).all()
    if not positions:
        return
    
    unique_tickers = list(set(p.ticker for p in positions))
    prices = {}
    
    # Batch fetch for efficiency
    try:
        if len(unique_tickers) > 1:
            data = yf.download(unique_tickers, period="1d", interval="1m", progress=False)
            for ticker in unique_tickers:
                if ticker in data['Close']:
                    prices[ticker] = float(data['Close'][ticker].iloc[-1])
        else:
            prices[unique_tickers[0]] = get_current_price(unique_tickers[0])
    except Exception as e:
        logger.error(f"Bulk price update failed: {e}")

    for pos in positions:
        price = prices.get(pos.ticker)
        if price:
            pos.current_price = price
    
    db.commit()
    logger.info(f"Updated prices for {len(positions)} positions.")
