import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
    ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, BarChart2, Clock, Loader2 } from 'lucide-react';

const fmt = (v: number | undefined | null) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(v ?? 0);
const fmtPct = (v: number | undefined | null) => `${(v ?? 0) >= 0 ? '+' : ''}${(v ?? 0).toFixed(2)}%`;

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

    const safeArray = <T,>(val: unknown): T[] => Array.isArray(val) ? (val as T[]) : [];
    const metrics = data?.metrics;
    const equityCurve = safeArray<{ date: string; strategy: number; benchmark: number }>(data?.equity_curve);
    const trades = safeArray<{ date: string; ticker: string; dir: string; entry: number; exit: number; pnl: number; reason: string }>(data?.trades);

    const totalReturn = equityCurve.length > 0
        ? ((equityCurve[equityCurve.length - 1].strategy - 10000) / 10000) * 100
        : 0;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="glass-card p-4 border-indigo-500/20 shadow-2xl animate-in zoom-in-95 duration-300">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">{label}</p>
                {payload.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-8 mb-2 last:mb-0 group">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ background: p.color, color: p.color }} />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter group-hover:text-white transition-colors">{p.name}</span>
                        </div>
                        <span className="text-xs font-mono font-black text-white">{fmt(p.value)}</span>
                    </div>
                ))}
            </div>
        );
    };

    const METRICS = [
        { l: 'Total Return', v: `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`, c: totalReturn >= 0 ? 'text-emerald-400' : 'text-rose-400' },
        { l: 'Sharpe Ratio', v: (metrics?.sharpe ?? 0).toFixed(2), c: 'text-indigo-400' },
        { l: 'Sortino Ratio', v: (metrics?.sortino ?? 0).toFixed(2), c: 'text-indigo-400' },
        { l: 'Win Rate', v: `${(metrics?.accuracy ?? 0).toFixed(1)}%`, c: 'text-emerald-400' },
        { l: 'Total Trades', v: (trades?.length ?? 0).toString(), c: 'text-slate-300' },
    ];

    return (
        <div className="p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
                <div>
                   <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                            <BarChart2 className="w-5 h-5 text-indigo-400" />
                        </div>
                        <h1 className="text-3xl font-display font-black text-white tracking-tight uppercase">Strategy Lab <span className="text-slate-600 ml-1 font-normal italic">/ Backtest</span></h1>
                   </div>
                   <p className="text-slate-500 text-xs font-bold font-body tracking-[0.1em] uppercase max-w-xl leading-relaxed">
                        Vectorized walk-forward validation &middot; <span className="text-indigo-400">Monte Carlo simulation support</span> &middot; Synthetic market dynamics
                   </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative group">
                        <input
                            value={ticker}
                            onChange={e => setTicker(e.target.value.toUpperCase())}
                            className="w-48 bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-3 font-display font-black text-white text-sm focus:outline-none focus:border-indigo-500/50 shadow-xl transition-all uppercase placeholder-slate-600"
                            placeholder="RELIANCE"
                        />
                        {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />}
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
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-6">
                {METRICS.map(m => (
                    <div key={m.l} className="glass-card p-6 flex flex-col gap-1 transition-all duration-500 hover:scale-[1.02] bg-white/[0.03] border-white/10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                            {m.l.includes('Return') ? <TrendingUp size={40} /> : <BarChart2 size={40} />}
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">{m.l}</p>
                        <p className={`text-2xl font-display font-black tracking-tight ${m.c}`}>{m.v}</p>
                    </div>
                ))}
            </div>

            {/* Equity Curve Chart */}
            <div className="glass-card p-8 border border-white/5 shadow-2xl overflow-hidden relative group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-20" />
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>
                        <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2 mb-2">
                            <TrendingUp size={14} className="text-indigo-400" />
                            Equity Trajectory: {ticker}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">Strategy vs. Buy & Hold Benchmark &middot; ₹10.0L Baseline</p>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                             <div className="w-3 h-1 bg-indigo-500 rounded-full shadow-[0_0_10px_#6366f1]" />
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Neural Strategy</span>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="w-3 h-1 bg-slate-700 rounded-full" />
                             <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Market Proxy</span>
                        </div>
                    </div>
                </div>
                <div className="h-[320px] w-full relative group-hover:scale-[1.01] transition-transform duration-700">
                    {loading && !data && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-10 rounded-2xl animate-in fade-in duration-500 border border-white/5">
                            <RefreshCw size={32} className="text-indigo-500 animate-spin" />
                        </div>
                    )}
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={equityCurve} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                            <defs>
                                <linearGradient id="stratGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#64748b" stopOpacity={0.1} />
                                    <stop offset="100%" stopColor="#64748b" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.03)" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                tick={{ fill: '#475569', fontSize: 9, fontWeight: 900 }} 
                                tickLine={false} 
                                axisLine={false} 
                                interval="preserveStartEnd" 
                                minTickGap={40}
                                padding={{ left: 10, right: 10 }}
                            />
                            <YAxis 
                                tick={{ fill: '#475569', fontSize: 9, fontWeight: 900 }} 
                                tickLine={false} 
                                axisLine={false} 
                                tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} 
                                domain={['auto', 'auto']}
                                orientation="right"
                            />
                            <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(99,102,241,0.2)', strokeWidth: 2 }} />
                            <ReferenceLine y={10000} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                            <Area type="monotone" dataKey="benchmark" name="Benchmark" stroke="#475569" strokeWidth={1.5} fill="url(#benchGrad)" dot={false} activeDot={false} />
                            <Area type="monotone" dataKey="strategy" name="Strategy" stroke="#6366f1" strokeWidth={3} fill="url(#stratGrad)" dot={false} activeDot={{ r: 4, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Trade Log */}
            <div className="glass-card p-0 border border-white/5 overflow-hidden shadow-2xl flex flex-col">
                <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                        <Clock size={14} className="text-indigo-400" />
                        Execution Journal
                    </h3>
                    <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Archive of {trades.length} Validations</span>
                </div>
                <div className="divide-y divide-white/[0.02]">
                    {trades.map((t, i) => (
                        <div key={i} className="flex flex-col md:flex-row md:items-center gap-4 px-6 py-5 hover:bg-white/[0.03] transition-all group relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            
                            <div className="w-24 shrink-0 flex flex-col">
                                <span className="text-[10px] text-slate-600 font-mono font-bold tracking-tight uppercase">{t.date}</span>
                                <span className="text-[8px] text-slate-800 font-black uppercase tracking-widest mt-0.5">Recorded UTC</span>
                            </div>

                            <div className="w-32 flex items-center gap-3 shrink-0">
                                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                                    <span className="text-[10px] font-black text-indigo-400">{t.ticker.substring(0, 2)}</span>
                                </div>
                                <span className="text-sm font-display font-black text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors">{t.ticker}</span>
                            </div>

                            <div className="w-24 shrink-0">
                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest border border-current transition-colors ${t.dir === 'BUY' ? 'bg-indigo-500/5 text-indigo-400 border-indigo-500/20' : 'bg-rose-500/5 text-rose-400 border-rose-500/20'}`}>
                                    {t.dir}
                                </span>
                            </div>

                            <div className="flex-1 flex items-center gap-6 justify-between md:justify-start">
                                <div className="flex items-center gap-4 text-xs font-mono font-bold text-slate-400">
                                    <span>{fmt(t.entry)}</span>
                                    <TrendingUp size={12} className="text-slate-700 -rotate-90" />
                                    <span>{fmt(t.exit)}</span>
                                </div>
                                <span className={`text-xs font-mono font-black transition-colors ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {t.pnl >= 0 ? '+' : ''}{(t.pnl ?? 0).toFixed(2)}% Alpha
                                </span>
                            </div>

                            <div className="md:w-64 text-right md:text-right">
                                <span className="text-[10px] text-slate-500 font-bold italic tracking-tight italic opacity-70 group-hover:opacity-100 transition-opacity leading-tight block">"{t.reason}"</span>
                            </div>
                        </div>
                    ))}
                    {trades.length === 0 && !loading && (
                        <div className="py-32 text-center flex flex-col items-center justify-center">
                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10">
                                <BarChart2 size={32} className="text-slate-600" />
                            </div>
                            <h3 className="text-white font-display font-black text-xl mb-2 uppercase tracking-tight">Journal Empty</h3>
                            <p className="text-slate-500 font-body text-xs max-w-xs mx-auto leading-relaxed italic">Initiate a backtest protocol for {ticker} to generate vectorized execution logs.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
