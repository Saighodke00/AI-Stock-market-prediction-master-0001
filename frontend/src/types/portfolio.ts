export interface CorrelationData {
    matrix: { [key: string]: { [key: string]: number } };
    tickers: string[];
    period: string;
    computed_at: string;
}

export interface RiskAssessment {
    avg_correlation: number;
    concentration_risk: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
    most_correlated_pair: [string, string] | null;
    most_correlated_value: number;
    suggestion: string;
}

export interface PortfolioCorrelationResponse {
    correlation: CorrelationData;
    risk: RiskAssessment;
}

// -- Paper Trading --
export interface PaperPositionSchema {
    ticker: string;
    shares: number;
    entry: number;
    current: number;
    pnl: number;
    pnl_pct: number;
}

export interface PaperPortfolioSummary {
    cash_balance: number;
    market_value: number;
    total_value: number;
    total_return_pct: number;
    win_rate: number;
    num_trades: number;
    positions: PaperPositionSchema[];
}

export interface PaperTradeSchema {
    ticker: string;
    action: 'BUY' | 'SELL';
    shares: number;
    price: number;
    total_value: number;
    signal_confidence: number;
    pnl: number | null;
    opened_at: string;
    closed_at: string | null;
}
