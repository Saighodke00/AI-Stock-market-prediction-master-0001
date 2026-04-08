import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, BarChart, Bar, Cell
} from 'recharts';
import {
  Zap, TrendingUp, TrendingDown, Shield, Activity,
  RefreshCw, ChevronDown, AlertTriangle, CheckCircle2,
  XCircle, BarChart2, Target, Clock, Cpu
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
const TICKERS = ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS', 'BAJFINANCE.NS'];
const TIMEFRAMES = ['1M', '5M', '15M', '30M', '1H', '4H'];

const isBullish = (action: string): boolean => action === "BUY";
const isBearish = (action: string): boolean => action === "SELL";
const isActive  = (action: string): boolean => action === "BUY" || action === "SELL";


function genCandles(n = 80) {
  let price = 1350;
  return Array.from({ length: n }, (_, i) => {
    const o = price;
    const move = (Math.random() - 0.48) * 8;
    price += move;
    const h = Math.max(o, price) + Math.random() * 4;
    const l = Math.min(o, price) - Math.random() * 4;
    return {
      i,
      time: new Date(Date.now() - (n - i) * 5 * 60 * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      open: parseFloat(o.toFixed(2)),
      close: parseFloat(price.toFixed(2)),
      high: parseFloat(h.toFixed(2)),
      low: parseFloat(l.toFixed(2)),
      volume: Math.floor(Math.random() * 5000000 + 1000000),
      bullish: price >= o,
    };
  });
}

function genVolume(candles: ReturnType<typeof genCandles>) {
  return candles.map(c => ({ time: c.time, volume: c.volume, color: c.bullish ? '#00f5a0' : '#ff4560' }));
}

const fmt = (v: number) => v.toLocaleString('en-IN', { maximumFractionDigits: 2 });

// ── Gate Badge ────────────────────────────────────────────────────────────────
function GateBadge({ label, pass, detail }: { label: string; pass: boolean; detail: string }) {
  const color = pass ? '#00f5a0' : '#ff4560';
  const Icon = pass ? CheckCircle2 : XCircle;
  return (
    <div style={{ background: pass ? 'rgba(0,245,160,0.06)' : 'rgba(255,69,96,0.06)', border: `1px solid ${color}30`, borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
      <Icon size={16} color={color} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 1 }}>{label}</div>
        <div style={{ fontSize: 10, color: '#4a6080', marginTop: 2 }}>{detail}</div>
      </div>
      <div style={{ marginLeft: 'auto', fontSize: 10, color, fontWeight: 700 }}>{pass ? 'PASS' : 'FAIL'}</div>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function Kpi({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ background: '#0a1525', border: '1px solid #1a3050', borderRadius: 10, padding: '12px 14px' }}>
      <p style={{ fontSize: 9, color: '#3a5070', letterSpacing: 2, marginBottom: 6 }}>{label}</p>
      <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <p style={{ fontSize: 10, color: '#3a5070', marginTop: 5 }}>{sub}</p>}
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function IntradayView() {
  const [ticker, setTicker] = useState('RELIANCE.NS');
  const [tf, setTf] = useState('5M');
  const [candles, setCandles] = useState(() => genCandles(80));
  const [loading, setLoading] = useState(false);
  const [capital, setCapital] = useState(500000);
  const [riskPct, setRiskPct] = useState(1.5);
  const [architectOpen, setArchitectOpen] = useState(true);

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const currentPrice = last.close;
  const pChange = ((currentPrice - prev.close) / prev.close * 100);

  const p10 = +(currentPrice * 0.990).toFixed(2);
  const p50 = +(currentPrice * 1.021).toFixed(2);
  const p90 = +(currentPrice * 1.045).toFixed(2);
  const action = 'HOLD'; // from API in real usage
  const confidence = 71;

  const gates = [
    { label: 'CONE WIDTH', pass: true, detail: `Spread ${((p90 - p10) / currentPrice * 100).toFixed(1)}% < 12% threshold` },
    { label: 'SENTIMENT', pass: false, detail: 'FinBERT score -0.02 opposes signal' },
    { label: 'RSI CONFIRM', pass: true, detail: `RSI 54.3 — in valid buy zone 40–70` },
  ];

  const stopLoss = +(currentPrice - 2 * 13.5).toFixed(2);
  const stopDist = +(currentPrice - stopLoss).toFixed(2);
  const riskAmount = +(capital * riskPct / 100).toFixed(2);
  const shares = Math.floor(riskAmount / stopDist);
  const totalExposure = +(shares * currentPrice).toFixed(2);
  const exposurePct = +(totalExposure / capital * 100).toFixed(1);

  const xaiDrivers = [
    { name: 'SP500', val: 15.9, color: '#00f5a0' },
    { name: 'BBU_20_2', val: 14.7, color: '#00e5ff' },
    { name: 'BBM_20_2', val: 11.8, color: '#00e5ff' },
    { name: 'VIX', val: 10.1, color: '#f59e0b' },
    { name: 'BBL_20_2', val: 9.4, color: '#00e5ff' },
    { name: 'NSEI', val: 3.5, color: '#a78bfa' },
  ];

  const refresh = () => {
    setLoading(true);
    setTimeout(() => { setCandles(genCandles(80)); setLoading(false); }, 800);
  };

  const signalColor = action === 'BUY' ? '#00f5a0' : action === 'SELL' ? '#ff4560' : '#f59e0b';

  return (
    <div style={{ background: '#050a14', minHeight: '100vh', color: '#c8d8f0', fontFamily: "'Space Grotesk', sans-serif", display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 20px' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Ticker selector */}
        <div style={{ position: 'relative' }}>
          <select value={ticker} onChange={e => setTicker(e.target.value)} style={{ background: '#0e1825', border: '1px solid #1a3050', color: '#fff', borderRadius: 8, padding: '9px 36px 9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', appearance: 'none' }}>
            {TICKERS.map(t => <option key={t}>{t}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#4a6080', pointerEvents: 'none' }} />
        </div>

        {/* Timeframe pills */}
        <div style={{ display: 'flex', background: '#0e1825', border: '1px solid #1a3050', borderRadius: 8, overflow: 'hidden' }}>
          {TIMEFRAMES.map(t => (
            <button key={t} onClick={() => setTf(t)} style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, border: 'none', background: tf === t ? '#00e5ff' : 'transparent', color: tf === t ? '#050a14' : '#4a6080', cursor: 'pointer', transition: 'all 0.2s', letterSpacing: 0.5 }}>{t}</button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#00f5a0', background: 'rgba(0,245,160,0.08)', border: '1px solid rgba(0,245,160,0.2)', borderRadius: 6, padding: '5px 12px' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00f5a0', animation: 'pulse 1.5s infinite' }} />
          NEURAL REFRESH: 60S
        </div>

        <button onClick={refresh} style={{ display: 'flex', alignItems: 'center', gap: 8, background: signalColor, color: '#050a14', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 900, fontSize: 12, cursor: 'pointer', letterSpacing: 1 }}>
          <Zap size={14} /> EXECUTE INFERENCE
        </button>
      </div>

      {/* ── Main layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, flex: 1 }}>

        {/* Left: chart + sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Signal header */}
          <div style={{ background: '#0a1525', border: `1px solid ${signalColor}30`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{ticker}</span>
                  <span style={{ background: '#00e5ff20', border: '1px solid #00e5ff40', color: '#00e5ff', fontSize: 9, padding: '3px 8px', borderRadius: 4, fontWeight: 700, letterSpacing: 1 }}>NEURAL V3.0</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>₹{fmt(currentPrice)}</span>
                  <span style={{ fontSize: 13, color: pChange >= 0 ? '#00f5a0' : '#ff4560', fontWeight: 700 }}>{pChange >= 0 ? '▲' : '▼'} {Math.abs(pChange).toFixed(2)}%</span>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#4a6080', letterSpacing: 1, marginBottom: 4 }}>RECOMMENDED ACTION</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: signalColor, lineHeight: 1 }}>{action}</div>
                <div style={{ fontSize: 10, color: '#4a6080', marginTop: 4 }}>INFERENCE CONFIDENCE</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{confidence}<span style={{ fontSize: 14 }}>%</span></div>
                <div style={{ height: 6, background: '#1a3050', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${confidence}%`, height: '100%', background: signalColor, borderRadius: 3 }} />
                </div>
              </div>
            </div>

            {/* P10/P50/P90 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
              {[{ l: 'BEAR (P10)', v: p10, c: '#ff4560' }, { l: 'BASE (P50)', v: p50, c: '#00e5ff' }, { l: 'BULL (P90)', v: p90, c: '#00f5a0' }].map(p => (
                <div key={p.l} style={{ background: '#060d1a', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#3a5070', letterSpacing: 2, marginBottom: 6 }}>{p.l}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: p.c }}>₹{fmt(p.v)}</div>
                </div>
              ))}
            </div>

            {/* Gate pills */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {gates.map(g => (
                <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 5, background: g.pass ? 'rgba(0,245,160,0.08)' : 'rgba(255,69,96,0.08)', border: `1px solid ${g.pass ? '#00f5a0' : '#ff4560'}30`, borderRadius: 6, padding: '5px 10px', fontSize: 10, fontWeight: 700, color: g.pass ? '#00f5a0' : '#ff4560' }}>
                  {g.pass ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                  {g.label}
                </div>
              ))}
              <div style={{ marginLeft: 'auto', fontSize: 10, color: '#4a6080' }}>VERIFIED INFERENCE: PENDING</div>
            </div>
          </div>

          {/* Chart */}
          <div style={{ background: '#0a1525', border: '1px solid #1a3050', borderRadius: 12, padding: '14px 16px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#00e5ff' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#8aa0c0', letterSpacing: 1 }}>NEURAL TERMINAL</span>
              <span style={{ fontSize: 9, color: '#3a5070', marginLeft: 4 }}>LIVE INFERENCE</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#3a5070' }}>O {fmt(last.open)} H {fmt(last.high)} L {fmt(last.low)} C {fmt(last.close)} V {(last.volume / 1e6).toFixed(2)}M</span>
            </div>
            {/* Price area chart (simplified — real candlesticks need custom renderer) */}
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={candles} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#00e5ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="time" tick={{ fill: '#2a4060', fontSize: 9 }} tickLine={false} axisLine={false} interval={9} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#2a4060', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v.toFixed(0)}`} />
                <RechartsTip contentStyle={{ background: '#0e1825', border: '1px solid #1a3050', borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [`₹${fmt(v)}`, 'Price']} />
                {/* support/resistance lines */}
                <ReferenceLine y={1340} stroke="rgba(0,245,160,0.3)" strokeDasharray="4 4" label={{ value: 'SUP', fill: '#00f5a060', fontSize: 9 }} />
                <ReferenceLine y={1360} stroke="rgba(255,69,96,0.3)" strokeDasharray="4 4" label={{ value: 'RES', fill: '#ff456060', fontSize: 9 }} />
                {/* signal marker */}
                <ReferenceLine x={candles[60]?.time} stroke={signalColor} strokeDasharray="3 3" label={{ value: 'SIGNAL', fill: signalColor, fontSize: 9 }} />
                {/* P10/P50/P90 target lines */}
                <ReferenceLine y={p10} stroke="#ff456040" />
                <ReferenceLine y={p50} stroke="#00e5ff60" />
                <ReferenceLine y={p90} stroke="#00f5a040" />
                <Area type="monotone" dataKey="close" stroke="#00e5ff" strokeWidth={2} fill="url(#priceGrad)" dot={false} activeDot={{ r: 3, fill: '#00e5ff' }} />
              </AreaChart>
            </ResponsiveContainer>
            {/* volume mini chart */}
            <ResponsiveContainer width="100%" height={40}>
              <BarChart data={candles.slice(-40)} margin={{ top: 2, right: 5, bottom: 0, left: 0 }}>
                <Bar dataKey="volume" radius={[1, 1, 0, 0]}>
                  {candles.slice(-40).map((c, i) => <Cell key={i} fill={c.bullish ? 'rgba(0,245,160,0.4)' : 'rgba(255,69,96,0.4)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Trade Architect — ALWAYS OPEN */}
          <div style={{ background: '#0a1525', border: '1px solid #1a3050', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: '1px solid #1a3050', cursor: 'pointer' }} onClick={() => setArchitectOpen(o => !o)}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#00e5ff15', border: '1px solid #00e5ff30', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={14} color="#00e5ff" />
              </div>
              <span style={{ fontWeight: 900, color: '#fff', fontSize: 14 }}>TRADE ARCHITECT</span>
              <span style={{ fontSize: 10, color: '#4a6080' }}>/ V3.0</span>
              <ChevronDown size={14} color="#4a6080" style={{ marginLeft: 'auto', transform: architectOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>
            {architectOpen && (
              <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
                {/* Inputs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 10, color: '#4a6080', letterSpacing: 1, display: 'block', marginBottom: 5 }}>DEPLOYMENT CAPITAL</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#060d1a', border: '1px solid #1a3050', borderRadius: 8, padding: '8px 12px' }}>
                      <span style={{ color: '#4a6080', fontSize: 13 }}>₹</span>
                      <input value={capital} onChange={e => setCapital(+e.target.value)} type="number" style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, outline: 'none', width: '100%' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <label style={{ fontSize: 10, color: '#4a6080', letterSpacing: 1 }}>RISK ALLOCATION</label>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#00e5ff' }}>{riskPct}%</span>
                    </div>
                    <input type="range" min={0.5} max={5} step={0.5} value={riskPct} onChange={e => setRiskPct(+e.target.value)} style={{ width: '100%', accentColor: '#00e5ff', height: 4, cursor: 'pointer' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#2a4060', marginTop: 4 }}>
                      <span>CONSERVATIVE</span><span>AGGRESSIVE</span>
                    </div>
                  </div>
                </div>

                {/* Result card */}
                <div style={{ background: signalColor === '#f59e0b' ? 'rgba(245,158,11,0.06)' : signalColor === '#00f5a0' ? 'rgba(0,245,160,0.06)' : 'rgba(255,69,96,0.06)', border: `1px solid ${signalColor}25`, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 10, color: signalColor, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>PRIME ALLOCATION</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 12 }}>
                    <span style={{ color: signalColor }}>{action}</span> {shares} units of {ticker}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { l: 'STRATEGIC ENTRY', sub: 'Market Exec', v: `₹${fmt(currentPrice)}`, c: '#fff' },
                      { l: 'STOP SACRIFICE', sub: 'Total Exposure', v: `₹${fmt(riskAmount)}`, c: '#ff4560', vsub: `(${riskPct}%)` },
                      { l: 'SAFETY FLOOR', sub: 'ATR × 2.0', v: `₹${fmt(stopLoss)}`, c: '#fff' },
                      { l: 'INFERENCE GAIN', sub: `Potential R:R ${(((p50 - currentPrice) / stopDist)).toFixed(1)}`, v: `₹${fmt(shares * (p50 - currentPrice))}`, c: '#00f5a0' },
                      { l: 'EXIT ALPHA', sub: 'P50 Neural Target', v: `₹${fmt(p50)}`, c: '#00e5ff' },
                      { l: 'KELLY CRITERION', sub: 'Risk Limit', v: `${(riskPct * 5.6).toFixed(1)}%`, c: '#a78bfa' },
                    ].map(row => (
                      <div key={row.l} style={{ borderBottom: '1px solid #1a3050', paddingBottom: 8 }}>
                        <div style={{ fontSize: 9, color: '#3a5070', letterSpacing: 1 }}>{row.l}</div>
                        <div style={{ fontSize: 9, color: '#2a4060', marginBottom: 3 }}>{row.sub}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: row.c }}>{row.v}{row.vsub && <span style={{ fontSize: 10, color: '#4a6080', marginLeft: 4 }}>{row.vsub}</span>}</div>
                      </div>
                    ))}
                  </div>
                  {exposurePct > 20 && (
                    <div style={{ marginTop: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <AlertTriangle size={14} color="#f59e0b" style={{ marginTop: 2 }} />
                      <div style={{ fontSize: 10, color: '#f59e0b', lineHeight: 1.5 }}>
                        <strong>EXPOSURE WARNING</strong><br />
                        Total position value ({exposurePct}%) exceeds institutional guardrail (20%). Reduce allocation for proper hedge ratios.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Engine decision */}
          <div style={{ background: '#0a1525', border: `1px solid ${signalColor}40`, borderRadius: 12, padding: 18, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#4a6080', letterSpacing: 2, marginBottom: 8 }}>ENGINE DECISION</div>
            <div style={{ fontSize: 52, fontWeight: 900, color: signalColor, lineHeight: 1, marginBottom: 8, textShadow: `0 0 30px ${signalColor}60` }}>{action}</div>
            <div style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', fontSize: 10, color: '#00e5ff', fontWeight: 700 }}>
              <Activity size={12} /> NEURAL CONFIRMATION SYNC
            </div>
          </div>

          {/* Neural Guardrails */}
          <div style={{ background: '#0a1525', border: '1px solid #1a3050', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Shield size={13} color="#4a6080" />
              <span style={{ fontSize: 10, color: '#4a6080', letterSpacing: 2, fontWeight: 700 }}>NEURAL GUARDRAILS</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gates.map(g => <GateBadge key={g.label} {...g} />)}
            </div>
          </div>

          {/* Strategy metrics */}
          <div style={{ background: '#0a1525', border: '1px solid #1a3050', borderRadius: 12, padding: 16 }}>
            <p style={{ fontSize: 10, color: '#4a6080', letterSpacing: 2, marginBottom: 12 }}>STRATEGY METRICS</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Kpi label="SCALP WIN RATE" value="70.6%" color="#00f5a0" />
              <Kpi label="PROFIT FACTOR" value="1.82" color="#00e5ff" />
              <Kpi label="MAX INTRADAY DD" value="6.7%" color="#ff4560" />
              <Kpi label="SHARPE RATIO" value="1.24" color="#a78bfa" />
              <Kpi label="FORECAST ACU" value="50.0%" color="#f59e0b" sub="Live inference" />
              <Kpi label="SORTINO" value="1.58" color="#34d399" />
            </div>
          </div>

          {/* Neural drivers */}
          <div style={{ background: '#0a1525', border: '1px solid #1a3050', borderRadius: 12, padding: 16, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: '#4a6080', letterSpacing: 2 }}>NEURAL DRIVERS</p>
              <span style={{ fontSize: 9, background: '#00e5ff15', color: '#00e5ff', border: '1px solid #00e5ff30', borderRadius: 4, padding: '3px 8px', fontWeight: 700 }}>XAI ENGINE</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {xaiDrivers.map(d => (
                <div key={d.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8aa0c0' }}>{d.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: d.color }}>+{d.val}%</span>
                  </div>
                  <div style={{ height: 4, background: '#1a3050', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${d.val}%`, height: '100%', background: d.color, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Market sentiment */}
          <div style={{ background: '#0a1525', border: '1px solid #1a3050', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 10, color: '#4a6080', letterSpacing: 2 }}>MARKET SENTIMENT</p>
              <span style={{ fontSize: 9, background: '#1a3050', color: '#4a6080', borderRadius: 4, padding: '3px 8px' }}>GLOBAL NLP</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#f59e0b' }}>+0.02</div>
            <div style={{ fontSize: 10, color: '#f59e0b', marginBottom: 10 }}>NEUTRAL ANALYSIS</div>
            <div style={{ background: 'rgba(255,69,96,0.08)', border: '1px solid rgba(255,69,96,0.2)', borderRadius: 8, padding: '8px 10px', display: 'flex', gap: 6, alignItems: 'center' }}>
              <XCircle size={12} color="#ff4560" />
              <span style={{ fontSize: 10, color: '#ff4560', fontWeight: 700 }}>GATE 3 BLOCKED — SENTIMENT OVERRIDES SELL → HOLD</span>
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { title: "India diesel exports to SE Asia hit 7-year high in March...", score: -0.6 },
                { title: "OpenAI Appoints JioStar CEO to Lead Asia Expansion...", score: +0.3 },
                { title: "Exclusive-India's Reliance buys 5 million barrels of Iranian...", score: -0.6 },
              ].map((n, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1a3050' }}>
                  <p style={{ fontSize: 10, color: '#5a7090', flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</p>
                  <span style={{ fontSize: 11, fontWeight: 700, color: n.score > 0 ? '#00f5a0' : '#ff4560', flexShrink: 0 }}>{n.score > 0 ? '+' : ''}{n.score.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input[type="range"]::-webkit-slider-thumb { cursor: pointer; }
      `}</style>
    </div>
  );
}
