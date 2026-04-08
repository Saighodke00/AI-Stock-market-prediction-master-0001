import React, { useState, useEffect, useRef } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTip,
  ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell,
  LineChart, Line, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Globe, Zap, RefreshCw, ExternalLink, Activity, Radio } from 'lucide-react';

// ─── types ───────────────────────────────────────────────────────────────────
interface NewsItem {
  title: string;
  score: number;
  label: string;
  publisher: string;
  published?: string;
  url?: string;
}

// ─── mock data helpers ────────────────────────────────────────────────────────
const TICKERS = ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS'];

function genTimeline() {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, i) => ({
    t: new Date(now - (29 - i) * 6 * 60 * 60 * 1000).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit' }),
    score: parseFloat((Math.sin(i / 4) * 0.4 + (Math.random() - 0.5) * 0.3).toFixed(3)),
  }));
}

function genSectorRadar() {
  return [
    { sector: 'Energy', value: 62 },
    { sector: 'IT', value: 78 },
    { sector: 'Banking', value: 55 },
    { sector: 'FMCG', value: 70 },
    { sector: 'Pharma', value: 45 },
    { sector: 'Auto', value: 67 },
    { sector: 'Metals', value: 38 },
    { sector: 'Infra', value: 59 },
  ];
}

const MOCK_NEWS: NewsItem[] = [
  { title: 'India diesel exports to SE Asia hit 7-year high in March due to Iran war', score: -6.0, label: 'BEARISH', publisher: 'Reuters', published: 'Just now' },
  { title: 'OpenAI Appoints JioStar CEO to Lead Asia Expansion Targeting 1.4 Billion India Market', score: 3.4, label: 'BULLISH', publisher: 'Bloomberg', published: '12 min ago' },
  { title: "Exclusive-India's Reliance buys 5 million barrels of Iranian oil after US waiver", score: -5.7, label: 'BEARISH', publisher: 'Reuters', published: '28 min ago' },
  { title: "Factbox-Ambani's Reliance Jio: businesses and investors of the IPO-bound firm", score: 0.0, label: 'NEUTRAL', publisher: 'Reuters', published: '45 min ago' },
  { title: 'FII flows turn positive as Nifty targets 23,000; Sensex up 0.4%', score: 4.2, label: 'BULLISH', publisher: 'Mint', published: '1h ago' },
  { title: 'RBI holds rates, signals cautious easing amid global uncertainty', score: 1.8, label: 'BULLISH', publisher: 'ET', published: '2h ago' },
  { title: 'Tech Mahindra Q4 results disappoint; margin pressure persists', score: -3.1, label: 'BEARISH', publisher: 'Moneycontrol', published: '3h ago' },
  { title: 'India GDP growth forecast revised upward to 7.2% for FY25', score: 5.5, label: 'BULLISH', publisher: 'CNBC-TV18', published: '4h ago' },
];

// ─── sub-components ───────────────────────────────────────────────────────────

function ArcGauge({ score, size = 200 }: { score: number; size?: number }) {
  const pct = Math.min(Math.max((score + 10) / 20, 0), 1);
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size * 0.58;
  const startAngle = Math.PI;
  const endAngle = 0;
  const angle = startAngle + pct * (endAngle - startAngle); // goes right
  const needleX = cx + r * Math.cos(angle);
  const needleY = cy - r * Math.sin(Math.abs(angle - Math.PI));

  const arc = (a1: number, a2: number, col: string) => {
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy - r * Math.sin(Math.PI - a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy - r * Math.sin(Math.PI - a2);
    return <path d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`} stroke={col} strokeWidth={size * 0.08} fill="none" strokeLinecap="round" />;
  };

  const label = score > 2 ? 'BULLISH' : score < -2 ? 'BEARISH' : 'NEUTRAL';
  const color = score > 2 ? '#00f5a0' : score < -2 ? '#ff4560' : '#f59e0b';

  return (
    <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
      <defs>
        <linearGradient id="arcBull" x1="0" x2="1"><stop stopColor="#ff4560" /><stop offset="0.5" stopColor="#f59e0b" /><stop offset="1" stopColor="#00f5a0" /></linearGradient>
      </defs>
      {/* background arc */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} stroke="rgba(255,255,255,0.06)" strokeWidth={size * 0.08} fill="none" />
      {/* coloured arc */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} stroke="url(#arcBull)" strokeWidth={size * 0.06} fill="none" opacity={0.25} />
      {/* needle */}
      <line x1={cx} y1={cy} x2={cx + (r - 10) * Math.cos(Math.PI - pct * Math.PI)} y2={cy - (r - 10) * Math.sin(pct * Math.PI)} stroke={color} strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={size * 0.035} fill={color} />
      {/* labels */}
      <text x={cx} y={cy - r - 8} textAnchor="middle" fill={color} fontSize={size * 0.12} fontWeight="900" fontFamily="'Space Grotesk', sans-serif">{score > 0 ? '+' : ''}{score.toFixed(2)}</text>
      <text x={cx} y={cy - r + size * 0.1} textAnchor="middle" fill={color} fontSize={size * 0.08} fontFamily="monospace" letterSpacing={2}>{label}</text>
    </svg>
  );
}

function ScorePill({ score }: { score: number }) {
  const abs = Math.abs(score);
  const color = score > 1 ? '#00f5a0' : score < -1 ? '#ff4560' : '#f59e0b';
  const bg = score > 1 ? 'rgba(0,245,160,0.1)' : score < -1 ? 'rgba(255,69,96,0.1)' : 'rgba(245,158,11,0.1)';
  return (
    <span style={{ background: bg, color, border: `1px solid ${color}40`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontFamily: 'monospace', fontWeight: 700 }}>
      {score > 0 ? '+' : ''}{score.toFixed(1)}
    </span>
  );
}

// ─── MAIN VIEW ────────────────────────────────────────────────────────────────
export default function SentimentView() {
  const [ticker, setTicker] = useState('RELIANCE.NS');
  const [timeline] = useState(genTimeline);
  const [radar] = useState(genSectorRadar);
  const [pulse, setPulse] = useState(0);

  const aggregateScore = parseFloat((
    MOCK_NEWS.reduce((s, n) => s + n.score, 0) / MOCK_NEWS.length
  ).toFixed(2));

  useEffect(() => {
    const t = setInterval(() => setPulse(p => p + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const scoreDistrib = [
    { range: '< -5', count: MOCK_NEWS.filter(n => n.score < -5).length, color: '#ff4560' },
    { range: '-5 to -2', count: MOCK_NEWS.filter(n => n.score >= -5 && n.score < -2).length, color: '#ff7043' },
    { range: '-2 to 0', count: MOCK_NEWS.filter(n => n.score >= -2 && n.score < 0).length, color: '#ffa726' },
    { range: '0 to 2', count: MOCK_NEWS.filter(n => n.score >= 0 && n.score < 2).length, color: '#66bb6a' },
    { range: '2 to 5', count: MOCK_NEWS.filter(n => n.score >= 2 && n.score < 5).length, color: '#00e5ff' },
    { range: '> 5', count: MOCK_NEWS.filter(n => n.score >= 5).length, color: '#00f5a0' },
  ];

  return (
    <div style={{ background: '#050a14', minHeight: '100vh', color: '#c8d8f0', fontFamily: "'Space Grotesk', sans-serif", padding: '24px 28px', overflowX: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00f5a0', boxShadow: '0 0 10px #00f5a0', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, color: '#00f5a0', letterSpacing: 3, fontWeight: 700 }}>LIVE NLP ENGINE</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: '6px 0 2px', letterSpacing: -0.5 }}>
            Sentiment <span style={{ color: '#00e5ff' }}>Intelligence</span>
          </h1>
          <p style={{ fontSize: 11, color: '#4a6080', letterSpacing: 2 }}>FINBERT NEURAL · MARKET INTERPRETATION</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={ticker}
            onChange={e => setTicker(e.target.value)}
            style={{ background: '#0e1825', border: '1px solid #1a3050', color: '#c8d8f0', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {TICKERS.map(t => <option key={t}>{t}</option>)}
          </select>
          <button style={{ background: '#0e1825', border: '1px solid #1a3050', borderRadius: 8, color: '#00e5ff', padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Row 1: Gauge + Score cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, marginBottom: 16 }}>

        {/* Gauge card */}
        <div style={{ background: '#0a1220', border: '1px solid #1a3050', borderRadius: 14, padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontSize: 10, color: '#4a6080', letterSpacing: 2, marginBottom: 8 }}>AGGREGATE SENTIMENT</p>
          <ArcGauge score={aggregateScore} size={220} />
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            {[{ l: 'Bull', v: MOCK_NEWS.filter(n => n.score > 0).length, c: '#00f5a0' }, { l: 'Bear', v: MOCK_NEWS.filter(n => n.score < 0).length, c: '#ff4560' }, { l: 'Neutral', v: MOCK_NEWS.filter(n => n.score === 0).length, c: '#f59e0b' }].map(x => (
              <div key={x.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: x.c }}>{x.v}</div>
                <div style={{ fontSize: 9, color: '#4a6080', letterSpacing: 1 }}>{x.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* KPI metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Bullish Momentum', value: '68.4%', sub: '+4.2pp from yesterday', color: '#00f5a0', icon: <TrendingUp size={18} /> },
            { label: 'Fear Index', value: '2.3 / 10', sub: 'Low market anxiety', color: '#00e5ff', icon: <Activity size={18} /> },
            { label: 'Signal Confidence', value: '76%', sub: '3-gate verified', color: '#a78bfa', icon: <Zap size={18} /> },
            { label: 'Headlines Scanned', value: `${MOCK_NEWS.length * 12}`, sub: 'Last 24 hours', color: '#f59e0b', icon: <Globe size={18} /> },
            { label: 'Bearish Pressure', value: '31.6%', sub: '2 bearish signals today', color: '#ff4560', icon: <TrendingDown size={18} /> },
            { label: 'Divergence Score', value: '0.41', sub: 'Price vs sentiment gap', color: '#34d399', icon: <Radio size={18} /> },
          ].map(k => (
            <div key={k.label} style={{ background: '#0a1220', border: '1px solid #1a3050', borderRadius: 12, padding: '16px 14px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 12, right: 12, color: k.color, opacity: 0.5 }}>{k.icon}</div>
              <p style={{ fontSize: 9, color: '#4a6080', letterSpacing: 2, marginBottom: 8 }}>{k.label.toUpperCase()}</p>
              <div style={{ fontSize: 22, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <p style={{ fontSize: 10, color: '#4a6080', marginTop: 6 }}>{k.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Row 2: Timeline chart + Score Distribution ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 16 }}>

        {/* Sentiment timeline */}
        <div style={{ background: '#0a1220', border: '1px solid #1a3050', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 10, color: '#4a6080', letterSpacing: 2, marginBottom: 4 }}>SENTIMENT TIMELINE — {ticker}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>30-Period Rolling Score</p>
            </div>
            <div style={{ fontSize: 10, color: '#4a6080', border: '1px solid #1a3050', borderRadius: 6, padding: '4px 10px' }}>6H INTERVALS</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={timeline} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#00e5ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="t" tick={{ fill: '#3a5070', fontSize: 9 }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fill: '#3a5070', fontSize: 9 }} tickLine={false} axisLine={false} domain={[-1, 1]} />
              <RechartsTip contentStyle={{ background: '#0e1825', border: '1px solid #1a3050', borderRadius: 8, fontSize: 11 }} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="score" stroke="#00e5ff" strokeWidth={2} fill="url(#sentGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Score distribution bar */}
        <div style={{ background: '#0a1220', border: '1px solid #1a3050', borderRadius: 14, padding: 20 }}>
          <p style={{ fontSize: 10, color: '#4a6080', letterSpacing: 2, marginBottom: 4 }}>SCORE DISTRIBUTION</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Headlines by Sentiment Band</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={scoreDistrib} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <XAxis dataKey="range" tick={{ fill: '#3a5070', fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#3a5070', fontSize: 9 }} tickLine={false} axisLine={false} />
              <RechartsTip contentStyle={{ background: '#0e1825', border: '1px solid #1a3050', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {scoreDistrib.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 3: Sector Radar + News feed ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>

        {/* Sector sentiment radar */}
        <div style={{ background: '#0a1220', border: '1px solid #1a3050', borderRadius: 14, padding: 20 }}>
          <p style={{ fontSize: 10, color: '#4a6080', letterSpacing: 2, marginBottom: 4 }}>SECTOR HEATMAP</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 10 }}>Sector Sentiment Radar</p>
          <ResponsiveContainer width="100%" height={230}>
            <RadarChart data={radar} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="sector" tick={{ fill: '#4a6080', fontSize: 10 }} />
              <Radar name="Sentiment" dataKey="value" stroke="#00e5ff" fill="#00e5ff" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
          {/* legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {radar.sort((a, b) => b.value - a.value).slice(0, 4).map(s => (
              <div key={s.sector} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#0e1825', borderRadius: 6, padding: '3px 8px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.value > 65 ? '#00f5a0' : s.value > 50 ? '#00e5ff' : '#f59e0b' }} />
                <span style={{ fontSize: 10, color: '#8a9dc0' }}>{s.sector} <span style={{ color: '#fff', fontWeight: 700 }}>{s.value}</span></span>
              </div>
            ))}
          </div>
        </div>

        {/* News feed */}
        <div style={{ background: '#0a1220', border: '1px solid #1a3050', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 10, color: '#4a6080', letterSpacing: 2, marginBottom: 2 }}>SIGNAL STREAM</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Live FinBERT News Feed — {ticker}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#00f5a0' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00f5a0', animation: 'pulse 1.5s infinite' }} />
              LIVE FEED
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MOCK_NEWS.map((n, i) => {
              const color = n.score > 1 ? '#00f5a0' : n.score < -1 ? '#ff4560' : '#f59e0b';
              const bg = n.score > 1 ? 'rgba(0,245,160,0.04)' : n.score < -1 ? 'rgba(255,69,96,0.04)' : 'rgba(245,158,11,0.04)';
              return (
                <div key={i} style={{ background: bg, border: `1px solid ${color}20`, borderLeft: `3px solid ${color}`, borderRadius: '0 8px 8px 0', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: '#c8d8f0', fontWeight: 600, lineHeight: 1.4, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 9, color: '#4a6080', letterSpacing: 1 }}>· {n.publisher.toUpperCase()}</span>
                      <span style={{ fontSize: 9, color: '#4a6080' }}>{n.published}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <ScorePill score={n.score} />
                    <span style={{ fontSize: 9, color: color, fontWeight: 700, letterSpacing: 1 }}>{n.label}</span>
                  </div>
                </div>
              );
            })}
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
