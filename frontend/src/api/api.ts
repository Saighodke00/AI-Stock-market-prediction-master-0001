export const API_BASE_URL = 'http://localhost:8000/api';

export interface GateResults {
    gate1_attention: boolean;
    gate2_cone: boolean;
    gate3_sentiment: boolean;
    gate4_pattern: boolean;
}

export interface Pattern {
    name: string;
    direction: string;
    confidence: number;
    breakout_level: number;
}

export interface SignalResponse {
    ticker: string;
    action: "BUY" | "SELL" | "HOLD";
    confidence: number; // 0.0 - 1.0
    expected_return: number; // 0.024 = 2.4%
    p10: number; // bear case
    p50: number; // base case
    p90: number; // bull case
    ohlcv: Array<{ time: string | number, open: number, high: number, low: number, close: number, volume: number }>;
    forecast: Array<{ time: string | number, p10: number, p50: number, p90: number }>;
    gate_results: GateResults;
    sentiment_score: number; // -1.0 to +1.0
    explanation: string;
    patterns: Pattern[];
    current_price: number;
    price_change_pct: number;
}

export interface Position {
    id: number;
    ticker: string;
    action: string;
    entry_price: number;
    current_price: number;
    quantity: number;
    pnl_pct: number;
    stop_loss?: number;
    target_price?: number;
    timestamp: string;
}

export interface ScreenerRow extends SignalResponse {
    sector: string;
}

export interface SentimentData {
    ticker: string;
    aggregate_score: number;
    news: Array<{
        headline: string;
        score: number;
        source: string;
        time: string;
    }>;
}

export interface BacktestMetrics {
    sharpe_ratio: number;
    win_rate: number;
    max_drawdown: number;
    profit_factor: number;
    forecast_accuracy: number;
    confidence_score: number;
}

export interface XAIReport {
    feature: string;
    importance: number; // -1 to 1 (negative/positive impact)
}

export const fetchSignal = async (ticker: string, tf: string = '1D'): Promise<SignalResponse> => {
    const res = await fetch(`${API_BASE_URL}/signal/${ticker}?tf=${tf}`);
    if (!res.ok) throw new Error(`Failed to fetch signal for ${ticker}`);
    return res.json();
};

export const fetchScreener = async (): Promise<ScreenerRow[]> => {
    const res = await fetch(`${API_BASE_URL}/screener`);
    if (!res.ok) throw new Error('Failed to fetch screener data');
    const data = await res.json();
    return data.results || [];
};

export const fetchSentiment = async (ticker: string): Promise<SentimentData> => {
    const res = await fetch(`${API_BASE_URL}/sentiment/${ticker}`);
    if (!res.ok) throw new Error(`Failed to fetch sentiment for ${ticker}`);
    return res.json();
};

export const fetchBacktest = async (ticker: string, tf: string = '1D'): Promise<BacktestMetrics> => {
    const res = await fetch(`${API_BASE_URL}/backtest?ticker=${ticker}&tf=${tf}`);
    if (!res.ok) throw new Error(`Failed to fetch backtest for ${ticker}`);
    return res.json();
};

export const fetchExplainability = async (ticker: string, tf: string = '1D'): Promise<XAIReport[]> => {
    const res = await fetch(`${API_BASE_URL}/explainability/${ticker}?tf=${tf}`);
    if (!res.ok) throw new Error(`Failed to fetch explainability for ${ticker}`);
    return res.json();
};

export const fetchPositions = async (): Promise<Position[]> => {
    const res = await fetch(`${API_BASE_URL}/paper/positions`);
    if (!res.ok) throw new Error('Failed to fetch paper trading positions');
    return res.json();
};
