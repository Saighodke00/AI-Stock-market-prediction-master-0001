# AI-Based Stock Price Prediction System

A professional implementation of an LSTM-based stock prediction dashboard.

## Features
- **Real-time Data**: Fetches live data using `yfinance`.
- **Advanced AI**: Uses LSTM (Long Short-Term Memory) neural networks.
- **Technical Analysis**: RSI, SMA, and MACD indicators.
- **Decision Engine**: Automated BUY/SELL/HOLD signals based on strict logic.
- **Backtesting**: Verify model performance on historical data.
- **Professional UI**: Dark-mode, glassmorphism design built with Streamlit.

## Installation

1. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

Run the dashboard:
```bash
streamlit run app.py
```

## System Architecture
- `app.py`: Main application interface.
- `utils/data_loader.py`: Data fetching and normalization.
- `utils/indicators.py`: Technical indicator calculations.
- `utils/model.py`: TensorFlow/Keras LSTM model definition.
- `utils/backtest.py`: Backtesting engine.

## Team
- **Sai Narendra Ghodke** - *Lead AI Architect & Developer*
- **Siddhartha Vijay Bhosale** - *Data Scientist & Quantitative Analyst*
- **Sunraj Shetty** - *Frontend Engineer & UI/UX Specialist*

## License
Educational Purpose Only.
