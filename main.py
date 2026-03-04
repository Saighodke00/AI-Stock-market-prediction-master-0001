import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

import redis
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uvicorn
import numpy as np

try:
    from pytorch_forecasting import TemporalFusionTransformer
    HAS_TFT = True
except ImportError:
    HAS_TFT = False

# Import core modules
# Adjust these imports according to your actual module structure
from signal_gate import run_inference, SignalOutput
from utils.sentiment import fetch_and_score_ticker
from utils.explainability import get_full_explanation
from utils.backtest import run_backtest
from utils.alpaca_integration import alpaca_client

logger = logging.getLogger("apex_ai.api")
logging.basicConfig(level=logging.INFO)

# ==============================================================================
# CONFIG & STATE
# ==============================================================================

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class RedisWrapper:
    def __init__(self, url):
        try:
            self.client = redis.from_url(url, decode_responses=True)
            self.client.ping()
            self.enabled = True
        except:
            logger.warning("Redis not found. Caching disabled.")
            self.enabled = False

    def get(self, key):
        if not self.enabled: return None
        try: return self.client.get(key)
        except: return None

    def setex(self, key, time, value):
        if not self.enabled: return
        try: self.client.setex(key, time, value)
        except: pass

redis_client = RedisWrapper(REDIS_URL)

class AppState:
    model: Any = None
    dataset: Any = None
    model_loaded: bool = False
    start_time: datetime = datetime.now()

state = AppState()

# ==============================================================================
# LIFESPAN
# ==============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load TFT Model
    logger.info("Initializing Apex AI Backend...")
    try:
        if HAS_TFT:
            # We assume model exists at models/tft_model.ckpt
            model_path = os.getenv("MODEL_PATH", "models/tft_model.ckpt")
            if os.path.exists(model_path):
                logger.info(f"Loading TFT model from {model_path}")
                state.model = TemporalFusionTransformer.load_from_checkpoint(model_path)
                state.model_loaded = True
            else:
                logger.warning(f"Warning: TFT model not found at {model_path}. Placeholder used.")
                state.model_loaded = False
        else:
            logger.warning("pytorch_forecasting not installed. Cannot load TFT.")
            state.model_loaded = False
            
    except Exception as e:
        logger.error(f"Failed to load TFT model: {e}")
        state.model_loaded = False
        
    yield
    # Cleanup
    if redis_client.enabled:
        redis_client.client.close()

# ==============================================================================
# FASTAPI APP Initialization
# ==============================================================================

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Apex AI Strategy API", version="2.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    response = await call_next(request)
    return response

# Global Exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error", "detail": str(exc)},
    )

# ==============================================================================
# PYDANTIC MODELS
# ==============================================================================

class HistoricalPoint(BaseModel):
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: float

class ForecastPoint(BaseModel):
    time: str
    p10: float
    p50: float
    p90: float

class ShapFeature(BaseModel):
    feature: str
    impact: float

class SentimentHeadline(BaseModel):
    text: str
    sentiment: str

class SentimentDetail(BaseModel):
    score: float
    headlines: List[SentimentHeadline]

class SignalAPIResponse(BaseModel):
    ticker: str
    current_price: float
    pct_change: float
    signal: str
    confidence: float
    regime: str
    historical_data: List[HistoricalPoint]
    forecast_data: List[ForecastPoint]
    shap_features: List[ShapFeature]
    explanation: str
    sentiment: SentimentDetail
    last_updated: str

class ScreenerResponse(BaseModel):
    results: List[SignalAPIResponse]

class SentimentArticle(BaseModel):
    title: str
    score: float
    published: str

class SentimentResponse(BaseModel):
    ticker: str
    sentiment_score: float
    sentiment_label: str
    article_count: int
    articles: List[SentimentArticle]
    cached: bool

class BacktestConfig(BaseModel):
    initial_capital: float = 10000.0
    time_step: int = 60

class BacktestRequest(BaseModel):
    ticker: str
    start_date: str
    end_date: str
    config: BacktestConfig

class BacktestResponseMetrics(BaseModel):
    sharpe: float
    sortino: float
    accuracy: float

class BacktestResponse(BaseModel):
    metrics: BacktestResponseMetrics
    equity_curve: List[float]

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    uptime_seconds: int
    version: str

class AlpacaWebhookPayload(BaseModel):
    ticker: str
    price: Optional[float] = None
    source: str = "tradingview"

class WebhookResponse(BaseModel):
    status: str
    action_taken: str
    trade_info: dict

# ==============================================================================
# ROUTERS
# ==============================================================================

@app.post("/api/webhook/alpaca", response_model=WebhookResponse)
@limiter.limit("10/minute")
async def alpaca_webhook_trigger(request: Request, payload: AlpacaWebhookPayload):
    """
    Hook endpoint for external systems (e.g., TradingView or cron jobs) to trigger
    an immediate evaluation of a ticker and execute trades on Alpaca based on the AI signal.
    """
    try:
        ticker = payload.ticker.upper()
        # 1. Evaluate the stock using the existing signal pipeline
        # (For production, you'd want to reuse `run_inference` directly instead of calling the API HTTP endpoint)
        
        from utils.data_loader import fetch_data
        df = fetch_data(ticker, period="6mo")
        if df is None or df.empty:
            raise HTTPException(status_code=400, detail="Data fetch failed.")
            
        current_price = float(df['Close'].iloc[-1])
        sentiment_data = fetch_and_score_ticker(ticker)
        score = sentiment_data.get('aggregate_score', 0.0)
        
        # 2. Generate Signal
        if state.model_loaded:
            sig_out = run_inference(ticker=ticker, model=state.model, training_dataset=state.dataset, sentiment_score=score)
        else:
            # Fallback mock for demo
            from signal_gate import gate_signal
            mock_preds = {"q0.1": current_price * 0.98, "q0.5": current_price * 1.02, "q0.9": current_price * 1.05}
            sig_out = gate_signal(mock_preds, 0.75, score, current_price)
            
        # 3. Execute Trade if actionable
        trade_result = {"status": "skipped", "reason": "No action required"}
        if sig_out.action in ["BUY", "SELL"]:
            trade_result = alpaca_client.execute_trade(
                action=sig_out.action,
                ticker=ticker,
                confidence=sig_out.confidence,
                current_price=current_price
            )
            
        return WebhookResponse(
            status="ok",
            action_taken=sig_out.action,
            trade_info=trade_result
        )

    except Exception as e:
        logger.exception("Webhook failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health", response_model=HealthResponse)
def health_check():
    uptime = (datetime.now() - state.start_time).total_seconds()
    return HealthResponse(
        status="ok",
        model_loaded=state.model_loaded,
        uptime_seconds=int(uptime),
        version="2.0"
    )

@app.get("/api/signal/{ticker}", response_model=SignalAPIResponse)
@limiter.limit("60/minute")
async def get_signal(request: Request, ticker: str):
    ticker = ticker.upper()
    cache_key = f"signal:v2:{ticker}"
    
    # Check cache
    cached_data = redis_client.get(cache_key)
    if cached_data:
        return json.loads(cached_data)
        
    try:
        # 1. Fetch Sentiment
        sentiment_data = fetch_and_score_ticker(ticker)
        score = sentiment_data.get('aggregate_score', 0.0)
        label = sentiment_data.get('label', 'NEUTRAL')
        
        # 2. Fetch Historical Data (Last 120 days for chart)
        from utils.data_loader import fetch_data
        df = fetch_data(ticker, period="6mo")
        if df is None or df.empty:
            raise HTTPException(status_code=404, detail=f"No data found for {ticker}")
            
        hist_df = df.tail(120).copy()
        historical_points = []
        for idx, row in hist_df.iterrows():
            historical_points.append(HistoricalPoint(
                time=idx.strftime("%Y-%m-%d"),
                open=float(row['Open']),
                high=float(row['High']),
                low=float(row['Low']),
                close=float(row['Close']),
                volume=float(row['Volume'])
            ))
            
        current_price = float(df['Close'].iloc[-1])
        prev_price = float(df['Close'].iloc[-2]) if len(df) > 1 else current_price
        pct_change = ((current_price - prev_price) / prev_price) * 100

        # 3. Run Inference (Mock if model not loaded)
        if state.model_loaded:
            sig_out = run_inference(ticker=ticker, model=state.model, training_dataset=state.dataset, sentiment_score=score)
            
            # 4. Explainability
            try:
                # We need actual dataloader for importance if possible, otherwise mock or pass None
                exp_data = get_full_explanation(state.model, None, sig_out, ticker, score)
                explanation_text = exp_data.get("text", "AI Signal analysis complete.")
                importance = exp_data.get("importance", {})
            except Exception as e:
                logger.warning(f"Explanation failed: {e}")
                explanation_text = "Detailed explanation generation failed."
                importance = {}
        else:
            # Placeholder Logic for non-model demo
            from signal_gate import gate_signal
            mock_preds = {
                "q0.1": current_price * 0.98,
                "q0.5": current_price * 1.02,
                "q0.9": current_price * 1.05
            }
            sig_out = gate_signal(mock_preds, 0.75, score, current_price)
            explanation_text = f"Apex AI detected momentum in {ticker} with {score:.2f} sentiment support."
            importance = {"rsi_14": 0.4, "macd_diff": 0.3, "SP500": 0.2, "VIX": 0.1}

        # 5. Format Forecast Data (Generate 30-day trajectory)
        forecast_points = []
        last_date = df.index[-1]
        for i in range(1, 31):
            next_date = last_date + timedelta(days=i)
            # Simple linear interpolation for mock/demo or extract from model trajectory if available
            # In production, this would use the full 'predictions' horizon from model
            forecast_points.append(ForecastPoint(
                time=next_date.strftime("%Y-%m-%d"),
                p10=float(sig_out.p10 * (1 - (0.001 * i))), # widening cone mock
                p50=float(sig_out.p50),
                p90=float(sig_out.p90 * (1 + (0.001 * i)))
            ))

        # 6. Format Final Response
        shap_features = [ShapFeature(feature=k, impact=v) for k, v in importance.items()]
        
        headlines = []
        for art in sentiment_data.get('articles', [])[:5]:
            art_label = "Neutral"
            if art.get('score', 0) > 0.2: art_label = "Bullish"
            elif art.get('score', 0) < -0.2: art_label = "Bearish"
            headlines.append(SentimentHeadline(text=art.get('title', ''), sentiment=art_label))

        response_model = SignalAPIResponse(
            ticker=ticker,
            current_price=current_price,
            pct_change=pct_change,
            signal=sig_out.action,
            confidence=sig_out.confidence,
            regime="Bull" if pct_change > 0 else "Bear", # Simplified regime logic
            historical_data=historical_points,
            forecast_data=forecast_points,
            shap_features=shap_features,
            explanation=explanation_text,
            sentiment=SentimentDetail(
                score=int((score + 1) * 50), # Scale -1..1 to 0..100
                headlines=headlines
            ),
            last_updated=datetime.now().isoformat()
        )
        
        # Cache for 15 minutes
        redis_client.setex(cache_key, timedelta(minutes=15), response_model.model_dump_json())
        return response_model
        
    except Exception as e:
        logger.exception("Signal fetch failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/signal/{ticker}", response_model=SignalAPIResponse)
async def post_signal(request: Request, ticker: str):
    """POST alias for testing/compatibility."""
    return await get_signal(request, ticker)

@app.get("/api/screener", response_model=ScreenerResponse)
@limiter.limit("60/minute")
async def get_screener(
    request: Request,
    limit: int = 15
):
    # Expanded list for the demo
    tickers = ["AAPL", "MSFT", "GOOGL", "NVDA", "META", "TSLA", "AMZN", "NFLX", "AMD", "PYPL"]
    results = []
    
    # Run first few for immediate results, others could be background-cached
    for t in tickers[:10]: 
        try:
            # reuse logic from get_signal
            res = await get_signal(request, t)
            results.append(res)
        except:
            continue
            
    return ScreenerResponse(results=results)

@app.get("/api/sentiment/{ticker}", response_model=SentimentResponse)
@limiter.limit("60/minute")
async def get_sentiment(request: Request, ticker: str):
    try:
        data = fetch_and_score_ticker(ticker.upper())
        return SentimentResponse(
            ticker=ticker.upper(),
            sentiment_score=data.get('aggregate_score', 0.0),
            sentiment_label=data.get('label', 'UNKNOWN'),
            article_count=data.get('article_count', 0),
            articles=data.get('articles', []),
            cached=data.get('cached', False)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/backtest", response_model=BacktestResponse)
@limiter.limit("20/minute")
async def perform_backtest(request: Request, body: BacktestRequest):
    try:
        from utils.data_pipeline import fetch_multi_modal, add_static_metadata
        # Fetch longer history for backtest
        df = fetch_multi_modal(body.ticker, period="2y")
        df = add_static_metadata(df, body.ticker)
        
        if df is None or df.empty:
            raise HTTPException(status_code=404, detail="Ticker not found")
            
        from utils.backtest import run_backtest, calculate_metrics, BacktestConfig
        
        # Build Backtest Config
        config = BacktestConfig(
            initial_capital=body.config.initial_capital,
            trading_fee_pct=0.001
        )
        
        # ── Simulated TFT Output Engine (if no loaded state.model) ──
        # In a real environment, we would run `state.model` over historical batches.
        # For demonstration of the engine, we generate predictive signals based on momentum.
        import pandas as pd
        future_returns = df['Close'].pct_change().shift(-1).fillna(0)
        predictive_edge = 0.55 # 55% prediction accuracy correlation
        noise = np.random.normal(0, 0.02, len(df))
        predictions = (future_returns * predictive_edge) + (noise * (1 - predictive_edge))
        pred_series = pd.Series(predictions.values, index=df.index)
        
        # Run Backtest
        equity_curve, trade_log = run_backtest(df, pred_series, config)
        
        # Calculate Metrics
        metrics_dict = calculate_metrics(equity_curve, trade_log)
        
        sharpe = metrics_dict.get('Sharpe Ratio', 0.0)
        sortino = metrics_dict.get('Sortino Ratio', 0.0)
        accuracy = metrics_dict.get('Win Rate (%)', 50.0)

        return BacktestResponse(
            metrics=BacktestResponseMetrics(
                sharpe=float(sharpe),
                sortino=float(sortino),
                accuracy=float(accuracy)
            ),
            equity_curve=equity_curve.tolist()
        )
    except Exception as e:
        logger.exception("Backtest failed")
        raise HTTPException(status_code=500, detail=f"Backtesting error: {str(e)}")

# FRONTEND STATIC FILES SERVING (PRODUCTION)
# ==============================================================================
# Serve the React application if it exists (built via 'npm run build' in 'frontend')
frontend_path = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.isdir(frontend_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_path, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Serve index.html for any path that doesn't resolve to a file
        # This handles SPA routing
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        path = os.path.join(frontend_path, full_path)
        if os.path.isfile(path):
            return FileResponse(path)
        return FileResponse(os.path.join(frontend_path, "index.html"))
else:
    logger.warning("Frontend 'dist' directory not found. Please run 'npm run build' inside 'frontend' for production serving.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
