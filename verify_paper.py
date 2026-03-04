import logging
from sqlalchemy.orm import Session
from models import PaperPortfolio, PaperPosition, PaperTrade, SessionLocal, init_db
from paper_trading import follow_signal, get_portfolio_summary, reset_portfolio

# ── SETUP ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("verify_paper")

def verify_paper_trading():
    logger.info("Starting Paper Trading Verification...")
    init_db()
    db = SessionLocal()
    
    try:
        # 1. Reset
        logger.info("Resetting portfolio...")
        reset_portfolio(db, portfolio_id=1)
        
        portfolio = db.query(PaperPortfolio).filter(PaperPortfolio.id == 1).first()
        assert portfolio.cash_balance == 100000.0
        logger.info("✓ Reset successful.")

        # 2. Simulate BUY Signal (e.g. NVDA @ $100)
        logger.info("Simulating BUY NVDA @ $100...")
        buy_res = follow_signal(db, 1, "NVDA", "BUY", 100.0, 0.9)
        assert buy_res["status"] == "success"
        
        summary = get_portfolio_summary(db, 1)
        # 10% of 100k = 10k allocated. 10k / 100 = 100 shares.
        # Cash = 90k. Position val = 10k (assuming current=entry here for instant check)
        logger.info(f"Summary after BUY: Cash=${summary['cash_balance']}, Value=${summary['total_value']}")
        assert len(summary['positions']) == 1
        assert summary['positions'][0]['ticker'] == "NVDA"
        assert summary['positions'][0]['shares'] == 100.0
        logger.info("✓ BUY logic verified.")

        # 3. Simulate Price Movement and SELL (NVDA @ $120)
        logger.info("Simulating SELL NVDA @ $120...")
        sell_res = follow_signal(db, 1, "NVDA", "SELL", 120.0, 0.8)
        assert sell_res["status"] == "success"
        assert sell_res["pnl"] == 2000.0 # (120-100) * 100
        
        summary = get_portfolio_summary(db, 1)
        # Cash should be 90k + (100 * 120) = 90k + 12k = 102k
        logger.info(f"Summary after SELL: Cash=${summary['cash_balance']}, PnL=${sell_res['pnl']}")
        assert summary['cash_balance'] == 102000.0
        assert summary['num_trades'] == 1
        assert summary['win_rate'] == 100.0
        logger.info("✓ SELL logic and PnL verified.")

        logger.info("\nALL PAPER TRADING BACKEND TESTS PASSED.")

    except Exception as e:
        logger.error(f"Verification Failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    verify_paper_trading()
