from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, ForeignKey, Text, Boolean
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

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="USER") # "USER" or "ADMIN"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    portfolios = relationship("PaperPortfolio", back_populates="user")
    activities = relationship("UserActivity", back_populates="user")

class UserActivity(Base):
    __tablename__ = "user_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action_type = Column(String) # e.g. "LOGIN", "SIGN_REQ", "PAPER_TRADE", "SCREENER"
    details = Column(String, nullable=True) # JSON or text details
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="activities")

class PaperPortfolio(Base):
    __tablename__ = "paper_portfolios"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id")) # Changed to relation
    cash_balance = Column(Float, default=100000.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="portfolios")
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

if __name__ == "__main__":
    print("Initializing SQLite database...")
    init_db()
    print("Database ready.")
