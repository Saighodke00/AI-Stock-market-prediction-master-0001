from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

# ── DATABASE SETUP ────────────────────────────────────────────────────────────
DB_PATH = "sqlite:///./paper_trading.db"
engine = create_engine(DB_PATH, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ── MODELS ───────────────────────────────────────────────────────────────────

class PaperPortfolio(Base):
    __tablename__ = "paper_portfolios"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True)
    cash_balance = Column(Float, default=100000.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    positions = relationship("PaperPosition", back_populates="portfolio")
    trades = relationship("PaperTrade", back_populates="portfolio")

class PaperPosition(Base):
    __tablename__ = "paper_positions"
    
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("paper_portfolios.id"))
    ticker = Column(String, index=True)
    shares = Column(Float)
    avg_entry_price = Column(Float)
    current_price = Column(Float, default=0.0)
    opened_at = Column(DateTime, default=datetime.utcnow)
    
    portfolio = relationship("PaperPortfolio", back_populates="positions")

class PaperTrade(Base):
    __tablename__ = "paper_trades"
    
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("paper_portfolios.id"))
    ticker = Column(String, index=True)
    action = Column(String)  # BUY or SELL
    shares = Column(Float)
    price = Column(Float)
    total_value = Column(Float)
    signal_confidence = Column(Float)
    pnl = Column(Float, nullable=True)  # Filled on SELL
    opened_at = Column(DateTime, default=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)
    
    portfolio = relationship("PaperPortfolio", back_populates="trades")
    
class SentimentHistory(Base):
    __tablename__ = "sentiment_history"
    
    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, index=True)
    source = Column(String)  # NEWS, SOCIAL, STATEMENT, BULK_DEAL, AGGREGATE
    score = Column(Float)
    label = Column(String)   # BULLISH, BEARISH, NEUTRAL
    timestamp = Column(DateTime, default=datetime.utcnow)

# ── DATABASE INITIALIZATION ───────────────────────────────────────────────────

def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Create default portfolio if none exists
    db = SessionLocal()
    try:
        default_p = db.query(PaperPortfolio).filter(PaperPortfolio.user_id == "default_user").first()
        if not default_p:
            new_p = PaperPortfolio(user_id="default_user", cash_balance=100000.0)
            db.add(new_p)
            db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    print("Initializing SQLite database...")
    init_db()
    print("Database ready.")
