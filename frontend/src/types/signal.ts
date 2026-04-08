export type SignalAction = "BUY" | "SELL" | "HOLD" | "NEUTRAL";

export interface SignalResponse {
  ticker:           string;
  action:           SignalAction;
  current_price:    number;       // ✅ was 'price' — renamed to match backend
  p10:              number;
  p50:              number;
  p90:              number;
  confidence:       number;       // 0.0 – 1.0
  expected_return:  number;       // percentage
  reason:           string;       // plain english from get_signal_reason()
  sentiment_score:  number;
  regime:           string;
  adx:              number;
  rsi:              number;
}
