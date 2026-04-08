// api/api.ts  v3.0
// All fetch calls + TypeScript interfaces for APEX AI backend.
// Aligned with main.py v3.0 response shapes.

/// <reference types="vite/client" />
const BASE = (import.meta as any).env?.VITE_API_URL ?? ""; // Use proxy in dev, or VITE_API_URL if set

// ─────────────────────────────────────────────────────────────────────────────
//  Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    let errorMsg = `API ${res.status}: ${res.statusText}`;
    try {
      const data = await res.json();
      if (data && data.detail) {
        errorMsg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      } else if (data && data.message) {
        errorMsg = data.message;
      }
    } catch (e) {
      // Fallback to text if not JSON
      const text = await res.text().catch(() => "");
      if (text) errorMsg = text.length > 100 ? text.substring(0, 100) + "..." : text;
    }
    throw new Error(errorMsg);
  }
  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Types — Signal
// ─────────────────────────────────────────────────────────────────────────────

export type Action    = "BUY" | "SELL" | "HOLD" | "NEUTRAL";
export type Direction = "BUY" | "SELL" | "NEUTRAL";

export interface GateResults {
  gate1_cone:      boolean;   // (P90-P10)/P50 < 12%
  gate2_sentiment: boolean;   // FinBERT direction agrees
  gate3_technical: boolean;   // RSI in target band
  gates_passed:    boolean;   // all three pass
  cone_width:      number;    // raw ratio e.g. 0.084
}

export interface NewsArticle {
  title:     string;
  url:       string;
  source:    string;
  published: string;
  score:     number;   // FinBERT score for this article [-1, +1]
}

export interface SentimentData {
  score:            number;               // aggregate [-1, +1]
  aggregate_score?: number;               // alias for score, v2 compat
  label:            "BULLISH" | "BEARISH" | "NEUTRAL";
  articles:         NewsArticle[];
  ticker?:          string;               // echoed back from /api/sentiment
}

export interface FeatureImportance {
  [feature: string]: number;  // feature name → normalised importance [0,1]
}

export interface SignalResponse {
  ticker:           string;
  action:           Action;
  direction:        Direction;
  confidence:       number;         // [0.50, 0.95]
  current_price:    number;
  price_change_pct: number;
  pct_change:       number;         // legacy alias — same as price_change_pct
  p10:              number;
  p50:              number;
  p90:              number;
  rsi:              number;
  adx:              number;         // added in v3.1
  atr:              number;
  accuracy:         number;         // 54.0 honest in-sample
  gate_results:     GateResults;
  sentiment:        SentimentData;
  sentiment_score:  number;         // added in v3.1 (alias for sentiment.score)
  explanation:      string;
  reason:           string;         // added in v3.1 (plain english from backend)
  importance:       FeatureImportance;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Types — Screener
// ─────────────────────────────────────────────────────────────────────────────

export interface ScreenerResult extends SignalResponse {}  // same shape

export interface ScreenerResponse {
  results: ScreenerResult[];
  count:   number;
  total:   number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Types — SEBI Bulk Deals
// ─────────────────────────────────────────────────────────────────────────────

export type DealType = "BLOCK" | "BULK";
export type BuySell  = "BUY" | "SELL" | "B" | "S" | string;

export interface BulkDeal {
  deal_type:  DealType;
  symbol:     string;
  client:     string;
  buy_sell:   BuySell;
  quantity:   number;
  price:      number;
  trade_date: string;
  exchange:   string;
  series:     string;
}

export interface BulkDealsResponse {
  deals: BulkDeal[];
  count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Types — Paper Trading
// ─────────────────────────────────────────────────────────────────────────────

export interface Position {
  ticker:          string;
  quantity:        number;
  avg_cost:        number;
  current_price:   number;
  market_value:    number;
  unrealised_pnl:  number;
  unrealised_pct:  number;
  opened_at:       string;
}

export interface Trade {
  id:            string;
  ticker:        string;
  action:        "BUY" | "SELL";
  quantity:      number;
  price:         number;
  total:         number;
  realised_pnl:  number;
  notes:         string;
  executed_at:   string;
}

export interface PortfolioSummary {
  cash_balance:     number;
  invested_value:   number;
  portfolio_value:  number;
  unrealised_pnl:   number;
  realised_pnl:     number;
  total_return_pct: number;
  win_rate:         number;
  trade_count:      number;
  open_positions:   number;
  initial_capital:  number;
}

export interface TradeResult {
  status:          "ok";
  trade:           Trade;
  cash_remaining:  number;
  realised_pnl:    number;
}

export interface TradeRequest {
  ticker:   string;
  action:   "BUY" | "SELL";
  quantity: number;
  price:    number;
  notes?:   string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Types — Health
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status:          "ok" | "error";
  scaler_loaded:   boolean;
  tflite_models:   string[];
  keras_models:    string[];
  paper_positions: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  API functions — Signal
// ─────────────────────────────────────────────────────────────────────────────

export function fetchSignal(ticker: string, mode: "swing" | "intraday" = "swing") {
  return apiFetch<SignalResponse>(`/api/signal/${encodeURIComponent(ticker)}?mode=${mode}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  API functions — Screener
// ─────────────────────────────────────────────────────────────────────────────

export function fetchScreener(mode: "swing" | "intraday" = "swing") {
  return apiFetch<ScreenerResponse>(`/api/screener?mode=${mode}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  API functions — Sentiment
// ─────────────────────────────────────────────────────────────────────────────

export function fetchSentiment(ticker: string) {
  return apiFetch<SentimentData>(`/api/sentiment/${encodeURIComponent(ticker)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  API functions — SEBI Bulk Deals
// ─────────────────────────────────────────────────────────────────────────────

export function fetchBulkDeals(ticker?: string, days = 7) {
  const params = new URLSearchParams({ days: String(days) });
  if (ticker) params.append("ticker", ticker);
  return apiFetch<BulkDealsResponse>(`/api/sebi/bulk-deals?${params}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  API functions — Paper Trading
// ─────────────────────────────────────────────────────────────────────────────

export function fetchPositions() {
  return apiFetch<{ positions: Position[] }>("/api/paper/positions");
}

export function fetchTradeHistory() {
  return apiFetch<{ history: Trade[] }>("/api/paper/history");
}

export function fetchPortfolioSummary() {
  return apiFetch<PortfolioSummary>("/api/paper/summary");
}

export function executeTrade(req: TradeRequest) {
  return apiFetch<TradeResult>("/api/paper/trade", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(req),
  });
}

export function resetPortfolio() {
  return apiFetch<{ status: string }>("/api/paper/reset", { method: "DELETE" });
}

// ─────────────────────────────────────────────────────────────────────────────
//  API functions — Health
// ─────────────────────────────────────────────────────────────────────────────

export function fetchHealth() {
  return apiFetch<HealthResponse>("/api/health");
}

// ─────────────────────────────────────────────────────────────────────────────
//  Backward-compat shims
//  (existing pages not yet updated to v3.0 still compile without changes)
// ─────────────────────────────────────────────────────────────────────────────

/** XAIReport — used by XAIPanel.tsx, SwingTrading.tsx, IntradayTrading.tsx.
 *  The backend no longer sends an array; importance is a dict in SignalResponse.
 *  This type keeps existing components compiling; derive from FeatureImportance.
 */
export interface XAIReport {
  feature:     string;
  impact:      number;  // positive = bullish driver, negative = bearish driver
  value?:      string | number;
  description?: string;
}

/** Convert the flat FeatureImportance dict → XAIReport array for XAIPanel. */
export function importanceToXAI(imp: FeatureImportance): XAIReport[] {
  return Object.entries(imp)
    .map(([feature, v]) => ({ feature, impact: v }))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 8);
}

/** BacktestMetrics — returned by /api/backtest endpoint (still exists). */
export interface BacktestMetrics {
  sharpe_ratio:       number;
  win_rate:           number;
  max_drawdown:       number;
  profit_factor:      number;
  forecast_accuracy?: number;
}

export function fetchBacktest(ticker: string, mode = "swing") {
  return apiFetch<BacktestMetrics>(`/api/backtest?ticker=${encodeURIComponent(ticker)}&mode=${mode}`);
}

export function fetchExplainability(ticker: string, mode = "swing") {
  return apiFetch<{ top_features?: FeatureImportance; importance?: FeatureImportance }>(
    `/api/explainability/${encodeURIComponent(ticker)}?mode=${mode}`
  ).then(d => importanceToXAI(d.top_features ?? d.importance ?? {} as FeatureImportance));
}

// ─────────────────────────────────────────────────────────────────────────────
//  Extended SignalResponse fields used by older page components
//  (added as optional so they don't break if backend doesn't send them)
// ─────────────────────────────────────────────────────────────────────────────
declare module "./api" {
  interface SignalResponse {
    ohlcv?:           Array<{ time: string|number; open: number; high: number; low: number; close: number; volume: number }>;
    forecast?:        Array<{ time: string|number; p10: number; p50: number; p90: number }>;
    expected_return?: number;
    sector?:          string;
    regime?:          string;
    patterns?:        unknown[];
    sharpe_ratio?:    number;
    last_updated?:    string;
  }
  interface SentimentData {
    /** aggregate_score is an alias for score — v2 component compat — already in main interface */
    ticker?: string;
  }
}

