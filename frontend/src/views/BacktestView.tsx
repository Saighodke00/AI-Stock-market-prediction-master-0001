import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
    ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, BarChart2, Clock, Loader2 } from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export default function BacktestView() {
    const [ticker, setTicker] = useState('AAPL');
    const [period, setPeriod] = useState('6M');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<{
        metrics: { sharpe: number; sortino: number; accuracy: number };
        equity_curve: { date: string; strategy: number; benchmark: number }[];
        trades: { date: string; ticker: string; dir: string; entry: number; exit: number; pnl: number; reason: string }[];
    } | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.post('/api/backtest', {
                ticker: ticker,
                start_date: '2023-01-01',
                end_date: '2024-01-01',
                config: {
                    initial_capital: 10000.0,
                    time_step: 60
                }
            });
            setData(response.data);
        } catch (err: any) {
            setError(err.message || 'Backtest failed');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [ticker]);

    const metrics = data?.metrics;
    const equityCurve = data?.equity_curve || [];
    const trades = data?.trades || [];

    const totalReturn = equityCurve.length > 0
        ? ((equityCurve[equityCurve.length - 1].strategy - 10000) / 10000) * 100
        : 0;

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

    const METRICS = [
        { l: 'Total Return', v: `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`, c: totalReturn >= 0 ? 'text-emerald-400' : 'text-rose-400' },
        { l: 'Sharpe Ratio', v: metrics?.sharpe.toFixed(2) || '0.00', c: 'text-indigo-400' },
        { l: 'Sortino Ratio', v: metrics?.sortino.toFixed(2) || '0.00', c: 'text-indigo-400' },
        { l: 'Win Rate', v: `${metrics?.accuracy.toFixed(1) || '0.0'}%`, c: 'text-emerald-400' },
        { l: 'Total Trades', v: trades.length.toString(), c: 'text-slate-300' },
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
                    <div className="relative group">
                        <input
                            value={ticker}
                            onChange={e => setTicker(e.target.value.toUpperCase())}
                            className="w-32 bg-slate-900/60 border border-slate-700/40 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/60 transition-all uppercase"
                            placeholder="Ticker"
                        />
                        {loading && <Loader2 className="absolute right-3 top-2.5 w-3 h-3 text-indigo-400 animate-spin" />}
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-400">
                    <Clock className="w-4 h-4" />
                    <p className="text-xs font-semibold">{error}</p>
                    <button onClick={fetchData} className="ml-auto underline text-[10px] uppercase font-bold tracking-widest">Retry</button>
                </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
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
                <div className="h-[280px] w-full relative">
                    {loading && !data && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 backdrop-blur-[2px] z-10 rounded-xl">
                            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        </div>
                    )}
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={equityCurve} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
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
                            <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={30} />
                            <YAxis tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(1)}K`} domain={['auto', 'auto']} />
                            <RechartsTooltip content={<CustomTooltip />} />
                            <ReferenceLine y={10000} stroke="rgba(99,102,241,0.2)" strokeDasharray="3 3" />
                            <Area type="monotone" dataKey="benchmark" name="Benchmark" stroke="#475569" strokeWidth={1.5} fill="url(#benchGrad)" dot={false} />
                            <Area type="monotone" dataKey="strategy" name="Strategy" stroke="#6366f1" strokeWidth={2.5} fill="url(#stratGrad)" dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Trade Log */}
            <div className="glass rounded-2xl border border-slate-800/60 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-200">Recent Trade Log</h3>
                    <span className="text-[10px] text-slate-600 flex items-center gap-1"><Clock className="w-3 h-3" />Showing {trades.length} trades</span>
                </div>
                <div>
                    {trades.map((t, i) => (
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
                    {trades.length === 0 && !loading && (
                        <div className="py-12 text-center text-slate-600">
                            <BarChart2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
                            <p className="text-xs">No trades executed in this period</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
