export interface HistoricalPoint {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface ForecastPoint {
    time: string;
    p10: number;
    p50: number;
    p90: number;
}

export interface ShapFeature {
    feature: string;
    impact: number;
}

export interface SentimentHeadline {
    text: string;
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
}

export interface APIResponse {
    ticker: string;
    current_price: number;
    pct_change: number;
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    regime: 'Bull' | 'Bear';
    historical_data: HistoricalPoint[];
    forecast_data: ForecastPoint[];
    shap_features: ShapFeature[];
    explanation: string;
    sentiment: {
        score: number; // 0 to 100
        headlines: SentimentHeadline[];
    };
    patterns?: any[];       // Add patterns
    insider_analysis?: any; // Add insider_analysis
    accuracy: number;       // Add accuracy
    sharpe_ratio: number;  // Add sharpe_ratio
    last_updated: string;
}

export interface ScreenerResponse {
    results: APIResponse[];
}

export interface BacktestMetrics {
    sharpe: number;
    sortino: number;
    accuracy: number;
}

export interface BacktestResponse {
    metrics: BacktestMetrics;
    trades: any[];
    equity_curve: { date: string; strategy: number; benchmark: number }[];
}
