import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, BarChart, Bar, Cell,
  ComposedChart, Scatter, ScatterChart
} from 'recharts';
import {
  TrendingUp, TrendingDown, Shield, Activity,
  RefreshCw, ChevronDown, AlertTriangle, CheckCircle2,
  XCircle, Target, BarChart2, Cpu, Zap
} from 'lucide-react';

const TICKERS = ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS'];
const TFS = ['1D', '1W'];

const isBullish = (action: string): boolean => action === "BUY";
const isBearish = (action: string): boolean => action === "SELL";
const isActive  = (action: string): boolean => action === "BUY" || action === "SELL";


function genDailyCandles(n = 90) {
  let price = 1350;
  const base = Date.now() - n * 24 * 3600 * 1000;
  return Array.from({ length: n }, (_, i) => {
    const o = price;
    price += (Math.random() - 0.475) * 18;
    const h = Math.max(o, price) + Math.random() * 8;
    const l = Math.min(o, price) - Math.random() * 8;
    return {
      i,
      date: new Date(base + i * 24 * 3600 * 1000).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      open: +o.toFixed(2), close: +price.toFixed(2),
      high: +h.toFixed(2), low: +l.toFixed(2),
      volume: Math.floor(Math.random() * 8000000 + 2000000),
      bullish: price >= o,
      ema9: +(price + (Math.random() - 0.5) * 5).toFixed(2),
      sma50: +(price - 10 + i * 0.12).toFixed(2),
    };
  });
}

const candles = genDailyCandles(90);
const last = candles[candles.length - 1];
const prev = candles[candles.length - 2];
const cur = last.close;
const pChange = ((cur - prev.close) / prev.close * 100);
const fmt = (v: number) => v.toLocaleString('en-IN', { maximumFractionDigits: 2 });

function GateBadge({ label, pass, detail }: { label: string; pass: boolean; detail: string }) {
  const color = pass ? '#00f5a0' : '#ff4560';
  const Icon = pass ? CheckCircle2 : XCircle;
  return (
    <div style={{ background: pass ? 'rgba(0,245,160,0.05)' : 'rgba(255,69,96,0.05)', border: `1px solid ${color}25`, borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
      <Icon size={15} color={color} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: 1 }}>{label}</div>
        <div style={{ fontSize: 10, color: '#4a6080', marginTop: 2 }}>{detail}</div>
      </div>
      <div style={{ fontSize: 9, color, fontWeight: 700 }}>{pass ? 'PASS' : 'FAIL'}</div>
    </div>
  );
}

function Kpi({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={{ background: '#060d1a', borderRadius: 8, padding: '10px 12px' }}>
      <p style={{ fontSize: 9, color: '#3a5070', letterSpacing: 1.5, marginBottom: 5 }}>{label}</p>
      <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <p style={{ fontSize: 9, color: '#3a5070', marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

export default function SwingTradingView() {
  const [ticker, setTicker] = useState('RELIANCE.NS');
  const [tf, setTf] = useState('1D');
  const [capital, setCapital] = useState(500000);
  const [riskPct, setRiskPct] = useState(1.5);
  const [architectOpen, setArchitectOpen] = useState(true);

  const p10 = +(cur * 0.987).toFixed(2);
  const p50 = +(cur * 1.021).toFixed(2);
  const p90 = +(cur * 1.048).toFixed(2);
  const action = 'HOLD';
  const confidence = 90;
  const signalColor = action === 'BUY' ? '#00f5a0' : action === 'SELL' ? '#ff4560' : '#f59e0b';

  const gates = [
    { label: 'FORECAST CONE', pass: true, detail: `Cone width ${((p90 - p10) / cur * 100).toFixed(1)}% < 12% threshold` },
    { label: 'SENTIMENT', pass: false, detail: 'FinBERT +0.02 marginally neutral — SELL blocked' },
    { label: 'RSI CONFIRM', pass: true, detail: 'RSI 51.2 — in neutral/bearish zone < 55' },
  ];

  const stopLoss = +(cur * 0.985).toFixed(2);
  const stopDist = +(cur - stopLoss).toFixed(2);
  const riskAmount = +(capital * riskPct / 100).toFixed(2);
  const shares = Math.floor(riskAmount / stopDist);
  const totalExposure = +(shares * cur).toFixed(2);
  const exposurePct = +(totalExposure / capital * 100).toFixed(1);
  const rr = (((p50 - cur) / stopDist)).toFixed(1);

  const xaiDrivers = [
    { name: 'SP500', val: 18.3, color: '#00f5a0' },
    { name: 'BBU_20_2', val: 15.1, color: '#00e5ff' },
    { name: 'NSEI', val: 12.4, color: '#00e5ff' },
    { name: 'VIX', val: 10.8, color: '#f59e0b' },
    { name: 'MACD_12_26_9', val: 8.2, color: '#a78bfa' },
    { name: 'RSI_14', val: 6.5, color: '#34d399' },
  ];

  const equity = Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    value: 10000 * (1 + 0.002 * i + (Math.random() - 0.45) * 0.03),
  }));

  return (
    <div style={{ background: '#050a14', minHeight: '100vh', color: '#c8d8f0', fontFamily: "'Space Grotesk', sans-serif", display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 20px' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <select value={ticker} onChange={e => setTicker(e.target.value)} style={{ background: '#0e1825', border: '1px solid #1a3050', color: '#fff', borderRadius: 8, padding: '9px 36px 9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', appearance: 'none' }}>
            {TICKERS.map(t => <option key={t}>{t}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#4a6080', pointerEvents: 'none' }} />
        </div>
        <div style={{ display: 'flex', background: '#0e1825', border: '1px solid #1a3050', borderRadius: 8, overflow: 'hidden' }}>
          {TFS.map(t => (
            <button key={t} onClick={() => setTf(t)} style={{ padding: '8px 20px', fontSize: 11, fontWeight: 700, border: 'none', background: tf === t ? '#00e5ff' : 'transparent', color: tf === t ? '#050a14' : '#4a6080', cursor: 'pointer', letterSpacing: 0.5 }}>{t}</button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#00f5a0', background: 'rgba(0,245,160,0.08)', border: '1px solid rgba(0,245,160,0.2)', borderRadius: 6, padding: '5px 12px' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00f5a0', animation: 'pulse 1.5s infinite' }} />
          NEURAL REFRESH: DAILY
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#00e5ff', color: '#050a14', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 900, fontSize: 12, cursor: 'pointer', letterSpacing: 1 }}>
          <Zap size={14} /> EXECUTE INFERENCE
        </button>
      </div>

      {/* ── Main layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14 }}>

        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Signal card */}
          <div style={{ background: '#0a1525', border: `1px solid ${signalColor}30`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{ticker}</span>
                  <span style={{ background: '#00e5ff15', border: '1px solid #00e5ff30', color: '#00e5ff', fontSize: 9, padding: '3px 8px', borderRadius: 4, fontWeight: 700, letterSpacing: 1 }}>NEURAL V3.0</span>
                  <span style={{ background: '#1a3050', color: '#4a6080', fontSize: 9, padding: '3px 8px', borderRadius: 4 }}>STREAM: {tf} SWING</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontSize: 26, fontWeight: 900, color: '#fff' }}>₹{fmt(cur)}</span>
                  <span style={{ fontSize: 13, color: pChange >= 0 ? '#00f5a0' : '#ff4560', fontWeight: 700 }}>{pChange >= 0 ? '▲' : '▼'} {Math.abs(pChange).toFixed(2)}%</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#4a6080', marginBottom: 2 }}>RECOMMENDED ACTION</div>
                <div style={{ fontSize: 38, fontWeight: 900, color: signalColor, lineHeight: 1 }}>{action}</div>
                <div style={{ fontSize: 10, color: '#4a6080', marginTop: 4 }}>INFERENCE CONFIDENCE</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{confidence}%</div>
                <div style={{ height: 5, background: '#1a3050', borderRadius: 3, marginTop: 5, overflow: 'hidden', width: 120, marginLeft: 'auto' }}>
                  <div style={{ width: `${confidence}%`, height: '100%', background: signalColor }} />
                </div>
              </div>
            </div>

            {/* P10/P50/P90 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[{ l: 'BEAR (P10)', v: p10, c: '#ff4560' }, { l: 'BASE (P50)', v: p50, c: '#00e5ff' }, { l: 'BULL (P90)', v: p90, c: '#00f5a0' }].map(p => (
                <div key={p.l} style={{ background: '#060d1a', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#3a5070', letterSpacing: 2, marginBottom: 5 }}>{p.l}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: p.c }}>₹{fmt(p.v)}</div>
                </div>
              ))}
            </div>

            {/* Gate pills */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {gates.map(g => (
                <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 5, background: g.pass ? 'rgba(0,245,160,0.08)' : 'rgba(255,69,96,0.08)', border: `1px solid ${g.pass ? '#00f5a0' : '#ff4560'}30`, borderRadius: 6, padding: '5px 10px', fontSize: 10, fontWeight: 700, color: g.pass ? '#00f5a0' : '#ff4560' }}>
                  {g.pass ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                  {g.label}
                </div>
              ))}
            </div>
          </div>

          {/* Daily chart */}
          <div style={{ background: '#0a1525', border: '1px solid #1a3050', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#00e5ff' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#8aa0c0', letterSpacing: 1 }}>NEURAL TERMINAL</span>
              <span style={{ fontSize: 9, color: '#3a5070' }}>LIVE INFERENCE</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 10, color: '#3a5070' }}>
                <span>O {fmt(last.open)}</span><span>H {fmt(last.high)}</span><span>L {fmt(last.low)}</span><span>C {fmt(last.close)}</span><span>V {(last.volume / 1e6).toFixed(2)}M</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={candles.slice(-60)} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="swingGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#00e5ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="date" tick={{ fill: '#2a4060', fontSize: 9 }} tickLine={false} axisLine={false} interval={9} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: '#2a4060', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v.toFixed(0)}`} />
                <RechartsTip contentStyle={{ background: '#0e1825', border: '1px solid #1a3050', borderRadius: 8, fontSize: 11 }} />
                <ReferenceLine y={1320} stroke="rgba(0,245,160,0.3)" strokeDasharray="4 4" />
                <ReferenceLine y={1370} stroke="rgba(255,69,96,0.3)" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="close" stroke="#00e5ff" strokeWidth={2} fill="url(#swingGrad)" dot={false} />
                <Area type="monotone" dataKey="sma50" stroke="#f59e0b" strokeWidth={1} fill="none" dot={false} strokeDasharray="4 4" />
                <Area type="monotone" dataKey="ema9" stroke="#a78bfa" strokeWidth={1} fill="none" dot={false} strokeDasharray="2 2" />
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, color: '#4a6080' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 16, height: 2, background: '#00e5ff' }} /> Price</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 16, height: 2, background: '#f59e0b', borderStyle: 'dashed' }} /> SMA50</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 16, height: 2, background: '#a78bfa' }} /> EMA9</span>
            </div>

            {/* volume */}
            <ResponsiveContainer width="100%" height={35} style={{ marginTop: 4 }}>
              <BarChart data={candles.slice(-60)} margin={{ top: 0, right: 5, bottom: 0, left: 0 }}>
                <Bar dataKey="volume">
                  {candles.slice(-60).map((c, i) => <Cell key={i} fill={c.bullish ? 'rgba(0,245,160,0.35)' : 'rgba(255,69,96,0.35)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* AI explanation */}
            <div style={{ marginTop: 12, background: '#060d1a', border: '1px solid #1a3050', borderLeft: '3px solid #00e5ff', borderRadius: '0 8px 8px 0', padding: '10px 14px' }}>
              <p style={{ fontSize: 10, color: '#4a6080', letterSpacing: 1, marginBottom: 5 }}>AI SIGNAL RATIONALE</p>
              <p style={{ fontSize: 11, color: '#8aa0c0', lineHeight: 1.6 }}>
                The model identified <span style={{ color: '#00e5ff' }}>SP500</span> and <span style={{ color: '#00e5ff' }}>BBU_20_2</span> as primary stabilising indicators, projecting a <span style={{ color: '#f59e0b' }}>+0.0%</span> move over 14 days. Sentiment is <span style={{ color: '#f59e0b' }}>NEUTRAL</span>, contradicting the technical signal. Key risk: <span style={{ color: '#ff4560' }}>MACD_12_26_9</span> adds uncertainty — consider reducing position size.
              </p>
            </div>
          </div>

          {/* Equity curve */}
          <div style={{ background: '#0a1525', border: '1px solid #1a3050', borderRadius: 12, padding: '14px 16px' }}>
            <p style={{ fontSize: 10, color: '#4a6080', letterSpacing: 2, marginBottom: 12 }}>BACKTEST EQUITY CURVE</p>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={equity} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Area type="monotone" dataKey="value" stroke="#a78bfa" strokeWidth={2} fill="url(#eqGrad)" dot={false} />
                <ReferenceLine y={10000} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 10 }}>
              <Kpi label="SHARPE" value="1.81" color="#a78bfa" />
              <Kpi label="WIN RATE" value="58.2%" color="#00f5a0" />
              <Kpi label="MAX DD" value="8.4%" color="#ff4560" />
              <Kpi label="PROFIT FACTOR" value="1.74" color="#00e5ff" />
            </div>
          </div>

          {/* Trade Architect */}
          <div style={{ background: '#0a1525', border: '1px solid #1a3050', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: '1px solid #1a3050', cursor: 'pointer' }} onClick={() => setArchitectOpen(o => !o)}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#00e5ff15', border: '1px solid #00e5ff30', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={14} color="#00e5ff" />
              </div>
              <span style={{ fontWeight: 900, color: '#fff', fontSize: 14 }}>TRADE ARCHITECT</span>
              <span style={{ fontSize: 10, color: '#4a6080' }}>/ V3.0</span>
              <ChevronDown size={14} color="#4a6080" style={{ marginLeft: 'auto', transform: architectOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
            </div>
            {architectOpen && (
              <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
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
                    <input type="range" min={0.5} max={5} step={0.5} value={riskPct} onChange={e => setRiskPct(+e.target.value)} style={{ width: '100%', accentColor: '#00e5ff', cursor: 'pointer' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#2a4060', marginTop: 4 }}>
                      <span>CONSERVATIVE</span><span>AGGRESSIVE</span>
                    </div>
                  </div>
                </div>
                <div style={{ background: `${signalColor}08`, border: `1px solid ${signalColor}25`, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 10, color: signalColor, fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>PRIME ALLOCATION</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 14 }}>
                    <span style={{ color: signalColor }}>{action}</span> {shares} units of {ticker}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { l: 'STRATEGIC ENTRY', sub: 'Market Exec', v: `₹${fmt(cur)}`, c: '#fff' },
                      { l: 'STOP SACRIFICE', sub: `Total Exposure`, v: `₹${fmt(riskAmount)}`, c: '#ff4560' },
                      { l: 'SAFETY FLOOR', sub: 'ATR × 2.0', v: `₹${fmt(stopLoss)}`, c: '#fff' },
                      { l: 'INFERENCE GAIN', sub: `Potential R:R ${rr}`, v: `₹${fmt(shares * (p50 - cur))}`, c: '#00f5a0' },
                      { l: 'EXIT ALPHA', sub: 'P50 Neural Target', v: `₹${fmt(p50)}`, c: '#00e5ff' },
                      { l: 'KELLY CRITERION', sub: 'Risk Limit', v: `${(riskPct * 5.6).toFixed(1)}%`, c: '#a78bfa' },
                    ].map(row => (
                      <div key={row.l} style={{ borderBottom: '1px solid #1a3050', paddingBottom: 8 }}>
                        <div style={{ fontSize: 9, color: '#3a5070', letterSpacing: 1 }}>{row.l}</div>
                        <div style={{ fontSize: 9, color: '#2a4060', marginBottom: 3 }}>{row.sub}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: row.c }}>{row.v}</div>
                      </div>
                    ))}
                  </div>
                  {exposurePct > 20 && (
                    <div style={{ marginTop: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '8px 12px', display: 'flex', gap: 8 }}>
                      <AlertTriangle size={13} color="#f59e0b" />
                      <span style={{ fontSize: 10, color: '#f59e0b', lineHeight: 1.5 }}>
                        Total position value ({exposurePct}%) exceeds institutional guardrail (20%). Reduce allocation for proper hedge ratios.
                      </span>
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
            <div style={{ fontSize: 10, color: '#4a6080', letterSpacing: 2, marginBottom: 6 }}>ENGINE DECISION</div>
            <div style={{ fontSize: 54, fontWeight: 900, color: signalColor, lineHeight: 1, textShadow: `0 0 40px ${signalColor}50` }}>{action}</div>
            <div style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)', borderRadius: 8, padding: '8px 12px', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 10, color: '#00e5ff', fontWeight: 700 }}>
              <Activity size={12} /> NEURAL CONFIRMATION SYNC
            </div>
          </div>

          {/* Neural guardrails */}
          <div style={{ background: '#0a1525', border: '1px solid #1a3050', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Shield size={13} color="#4a6080" />
              <span style={{ fontSize: 10, color: '#4a6080', letterSpacing: 2, fontWeight: 700 }}>NEURAL GUARDRAILS</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gates.map(g => <GateBadge key={g.label} {...g} />)}
            </div>
          </div>

          {/* Metrics */}
          <div style={{ background: '#0a1525', border: '1px solid #1a3050', borderRadius: 12, padding: 16 }}>
            <p style={{ fontSize: 10, color: '#4a6080', letterSpacing: 2, marginBottom: 12 }}>STRATEGY METRICS</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Kpi label="WIN RATE" value="58.2%" color="#00f5a0" />
              <Kpi label="PROFIT FACTOR" value="1.74" color="#00e5ff" />
              <Kpi label="MAX DRAWDOWN" value="8.4%" color="#ff4560" />
              <Kpi label="SHARPE RATIO" value="1.81" color="#a78bfa" />
              <Kpi label="SORTINO" value="2.14" color="#34d399" />
              <Kpi label="FORECAST ACU" value="52.1%" color="#f59e0b" />
            </div>
          </div>

          {/* XAI Drivers */}
          <div style={{ background: '#0a1525', border: '1px solid #1a3050', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: '#4a6080', letterSpacing: 2 }}>NEURAL DRIVERS</p>
              <span style={{ fontSize: 9, background: '#00e5ff15', color: '#00e5ff', border: '1px solid #00e5ff30', borderRadius: 4, padding: '3px 8px', fontWeight: 700 }}>XAI ENGINE</span>
            </div>
            {xaiDrivers.map(d => (
              <div key={d.name} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: '#8aa0c0' }}>{d.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: d.color }}>+{d.val}%</span>
                </div>
                <div style={{ height: 4, background: '#1a3050', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${d.val}%`, height: '100%', background: d.color, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Sentiment */}
          <div style={{ background: '#0a1525', border: '1px solid #1a3050', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 10, color: '#4a6080', letterSpacing: 2 }}>MARKET SENTIMENT</p>
              <span style={{ fontSize: 9, background: '#1a3050', color: '#4a6080', borderRadius: 4, padding: '3px 8px' }}>GLOBAL NLP</span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, color: '#f59e0b' }}>+0.02</div>
            <div style={{ fontSize: 10, color: '#f59e0b', marginBottom: 10 }}>NEUTRAL ANALYSIS</div>
            <div style={{ background: 'rgba(255,69,96,0.08)', border: '1px solid rgba(255,69,96,0.2)', borderRadius: 8, padding: '8px 10px', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
              <XCircle size={12} color="#ff4560" />
              <span style={{ fontSize: 10, color: '#ff4560', fontWeight: 700 }}>GATE 3 BLOCKED — SENTIMENT OVERRIDES SELL → HOLD</span>
            </div>
            {[
              { title: "India diesel exports to SE Asia hit 7-year high...", score: -0.6 },
              { title: "OpenAI Appoints JioStar CEO to Lead Asia...", score: +0.3 },
              { title: "Reliance buys 5 million barrels of Iranian oil...", score: -0.6 },
            ].map((n, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1a3050' }}>
                <p style={{ fontSize: 10, color: '#5a7090', flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</p>
                <span style={{ fontSize: 11, fontWeight: 700, color: n.score > 0 ? '#00f5a0' : '#ff4560', flexShrink: 0 }}>{n.score > 0 ? '+' : ''}{n.score.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1a3050; border-radius: 4px; }
      `}</style>
    </div>
  );
}
