# APEX AI: Advanced Stock Market Intelligence v3.0

![APEX AI Hero](assets/hero.png)

**APEX AI** is a professional-grade stock market analysis and prediction system. It combines deep learning (LSTM/TCN), real-time data orchestration, and a 3-gate confluence engine to deliver high-conviction trading signals.

## 🚀 Key Features

- **3-Gate Confluence Engine**: Signals only pass if they clear three distinct hurdles:
  - **Gate 1 (Volatility)**: Predictive "cone" width must be within stable bounds.
  - **Gate 2 (Sentiment)**: Real-time FinBERT analysis of latest news must align with the signal.
  - **Gate 3 (Technical)**: RSI and momentum indicators must confirm the entry/exit.
- **Async High-Performance Screener**: Concurrently analyzes the entire NSE watch-list in seconds using `asyncio`.
- **Mission Control Dashboard**: A premium, real-time interface featuring:
  - Live Market Pulse (Nifty 50, VIX, FII/DII Flows).
  - Neural Forecast Charts with P10/P50/P90 confidence intervals.
  - Interactive Sparklines and Sentiment Gauges.
- **Paper Trading Simulator**: Realistic portfolio management with historical performance tracking.
- **SEBI Bulk Deal Integration**: Track institutional footprints directly from NSE data.

## 🛠️ Tech Stack

### Backend
- **Core**: Python 3.10+ & FastAPI
- **AI/ML**: TensorFlow 2.15, TFLite (with Flex Ops), Scikit-Learn
- **Data**: yfinance (Hardened Session), Pandas, NumPy
- **NLP**: Transformers (FinBERT) for sentiment analysis

### Frontend
- **Framework**: React 18 (Vite) + TypeScript
- **Styling**: Tailwind CSS (Glassmorphism UI)
- **Charts**: Lightweight Charts (TradingView), Recharts
- **State Management**: Zustand
- **Icons**: Lucide React

## 📦 Installation

### Prerequisites
- Node.js 18+
- Python 3.10+

### 1. Setup Backend
```bash
git clone https://github.com/Saighodke00/AI-Stock-market-prediction-master-0001.git
cd AI-Stock-market-prediction-master-0001
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### 2. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🏗️ System Architecture

- `main.py`: FastAPI backend entry point and signal orchestration.
- `utils/data_pipeline.py`: Robust data fetching and feature engineering.
- `utils/sentiment.py`: News scraping and FinBERT sentiment scoring.
- `models/`: Pre-trained LSTM and TCN models (Keras & TFLite).
- `frontend/src/`: Modern React dashboard components.

## 👥 The Team

- **Sai Narendra Ghodke** - *Lead AI Architect*
- **Sunraj Shetty           ** - *Quantitative Analyst*
- **Siddhartha Vijay Bhosale** - *Full-Stack Engineer*

## 📜 License
Educational Purpose Only. Built with ❤️ for financial intelligence.
