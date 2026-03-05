import React, { useState } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
    ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, BarChart2, Clock } from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

// Mock equity curve data
function buildEquity() {
    const points = [];
    let equity = 10000;
    let benchmark = 10000;
    const base = Date.now() - 180 * 24 * 3600 * 1000;
    for (let i = 0; i < 180; i++) {
        equity *= 1 + (Math.random() - 0.44) * 0.012;
        benchmark *= 1 + (Math.random() - 0.47) * 0.009;
        points.push({
            date: new Date(base + i * 24 * 3600 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            strategy: Math.round(equity * 100) / 100,
            benchmark: Math.round(benchmark * 100) / 100,
        });
    }
    return points;
}

const EQUITY = buildEquity();
const TRADE_LOG = [
    { date: 'Feb 12', ticker: 'AAPL', dir: 'LONG', entry: 182.40, exit: 193.10, pnl: 5.87, reason: 'Signal Reversal' },
    { date: 'Feb 08', ticker: 'NVDA', dir: 'LONG', entry: 788.20, exit: 821.40, pnl: 4.21, reason: 'Signal Reversal' },
    { date: 'Jan 29', ticker: 'TSLA', dir: 'LONG', entry: 192.30, exit: 178.90, pnl: -6.97, reason: 'Stop Loss' },
    { date: 'Jan 22', ticker: 'MSFT', dir: 'LONG', entry: 404.80, exit: 412.60, pnl: 1.93, reason: 'Signal Reversal' },
    { date: 'Jan 18', ticker: 'GOOGL', dir: 'LONG', entry: 168.20, exit: 172.40, pnl: 2.50, reason: 'Take Profit' },
];

const finalEquity = EQUITY[EQUITY.length - 1].strategy;
const startEquity = 10000;
const totalReturn = ((finalEquity - startEquity) / startEquity) * 100;

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="glass rounded-xl p-3 border border-slate-700/60 shadow-2xl text-xs">
            <p className="text-slate-400 mb-2 font-medium">{label}</p>
            {payload.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2 mb-0.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-slate-400">{p.name}:</span>
                    <span className="text-white font-mono">${fmt(p.value)}</span>
                </div>
            ))}
        </div>
    );
};

export default function BacktestView() {
    const [ticker, setTicker] = useState('AAPL');
    const [period, setPeriod] = useState('6M');

    const METRICS = [
        { l: 'Total Return', v: `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`, c: totalReturn >= 0 ? 'text-emerald-400' : 'text-rose-400' },
        { l: 'CAGR', v: '+28.4%', c: 'text-emerald-400' },
        { l: 'Max Drawdown', v: '-8.3%', c: 'text-rose-400' },
        { l: 'Sharpe Ratio', v: '1.84', c: 'text-indigo-400' },
        { l: 'Sortino Ratio', v: '2.31', c: 'text-indigo-400' },
        { l: 'Win Rate', v: '64.2%', c: 'text-emerald-400' },
        { l: 'Profit Factor', v: '2.14', c: 'text-violet-400' },
        { l: 'Total Trades', v: '48', c: 'text-slate-300' },
    ];

    return (
        <div className="p-4 md:p-5 lg:p-6 h-full overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                <div className="flex-1">
                    <h2 className="text-lg font-black text-white">Strategy Backtester</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Vectorized walk-forward validation · Monte Carlo simulation support</p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        value={ticker}
                        onChange={e => setTicker(e.target.value.toUpperCase())}
                        className="w-32 bg-slate-900/60 border border-slate-700/40 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/60 transition-all uppercase"
                        placeholder="Ticker"
                    />
                    {['1M', '3M', '6M', '1Y', '2Y'].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${period === p ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40' : 'text-slate-500 border-slate-700/40 hover:text-slate-300 hover:bg-slate-800/60'}`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {METRICS.map(m => (
                    <div key={m.l} className="glass rounded-2xl p-4 border border-slate-800/60">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-2">{m.l}</p>
                        <p className={`text-xl font-black ${m.c}`}>{m.v}</p>
                    </div>
                ))}
            </div>

            {/* Equity Curve Chart */}
            <div className="glass rounded-2xl p-5 border border-slate-800/60 mb-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-bold text-slate-200">Equity Curve · {ticker}</h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Strategy vs. Buy & Hold Benchmark · $10,000 initial capital</p>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-indigo-400 inline-block rounded"></span>Strategy</span>
                        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-slate-500 inline-block rounded"></span>Benchmark</span>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={EQUITY} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                        <defs>
                            <linearGradient id="stratGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#475569" stopOpacity={0.2} />
                                <stop offset="100%" stopColor="#475569" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" />
                        <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} interval={29} />
                        <YAxis tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(1)}K`} domain={['auto', 'auto']} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <ReferenceLine y={10000} stroke="rgba(99,102,241,0.2)" strokeDasharray="3 3" />
                        <Area type="monotone" dataKey="benchmark" name="Benchmark" stroke="#475569" strokeWidth={1.5} fill="url(#benchGrad)" dot={false} />
                        <Area type="monotone" dataKey="strategy" name="Strategy" stroke="#6366f1" strokeWidth={2.5} fill="url(#stratGrad)" dot={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Trade Log */}
            <div className="glass rounded-2xl border border-slate-800/60 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-200">Recent Trade Log</h3>
                    <span className="text-[10px] text-slate-600 flex items-center gap-1"><Clock className="w-3 h-3" />Showing last 5 trades</span>
                </div>
                <div>
                    {TRADE_LOG.map((t, i) => (
                        <div key={i} className={`flex items-center gap-4 px-5 py-3.5 border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors ${i % 2 === 0 ? 'bg-slate-950/20' : ''}`}>
                            <span className="text-[10px] text-slate-600 w-14 shrink-0">{t.date}</span>
                            <div className="w-16 flex items-center gap-1.5 shrink-0">
                                <div className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center">
                                    <span className="text-[8px] font-black text-indigo-300">{t.ticker.substring(0, 2)}</span>
                                </div>
                                <span className="text-xs font-bold text-slate-300">{t.ticker}</span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded shrink-0">
                                {t.dir}
                            </span>
                            <span className="text-xs font-mono text-slate-400 shrink-0">${fmt(t.entry)}</span>
                            <span className="text-slate-700 shrink-0">→</span>
                            <span className="text-xs font-mono text-slate-400 shrink-0">${fmt(t.exit)}</span>
                            <span className={`ml-auto text-xs font-mono font-black shrink-0 ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}%
                            </span>
                            <span className="text-[10px] text-slate-600 w-28 text-right shrink-0">{t.reason}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
