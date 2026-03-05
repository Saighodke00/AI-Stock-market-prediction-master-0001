import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Search, TrendingUp, TrendingDown, Filter, RefreshCw,
    ChevronUp, ChevronDown, BarChart2, Clock, AlertCircle,
    Loader2
} from 'lucide-react';
import { APIResponse } from '../types';

const fmt2 = (v: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

export default function ScreenerView() {
    const [results, setResults] = useState<APIResponse[]>([]);
    const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'HOLD'>('ALL');
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<'confidence' | 'pct_change'>('confidence');
    const [sortDir, setSortDir] = useState<1 | -1>(-1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get<{ results: APIResponse[] }>('/api/screener');
            setResults(response.data.results);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch screener data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filtered = results
        .filter(r => filter === 'ALL' || r.signal === filter)
        .filter(r => r.ticker.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            const valA = a[sortKey as keyof APIResponse] as number;
            const valB = b[sortKey as keyof APIResponse] as number;
            return sortDir * (valB - valA);
        });

    const handleSort = (key: typeof sortKey) => {
        if (sortKey === key) setSortDir(d => d === 1 ? -1 : 1);
        else { setSortKey(key); setSortDir(-1); }
    };

    const stats = {
        buy: results.filter(r => r.signal === 'BUY').length,
        sell: results.filter(r => r.signal === 'SELL').length,
        hold: results.filter(r => r.signal === 'HOLD').length,
    };

    return (
        <div className="p-4 md:p-5 lg:p-6 h-full overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                <div className="flex-1">
                    <h2 className="text-lg font-black text-white">Market Screener</h2>
                    <p className="text-xs text-slate-500 mt-0.5">TFT signal scan across S&P 500 + NSE universe · Auto-refreshes every 6 hours</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-[10px] text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span>Updated 14 min ago</span>
                    </div>
                    <button
                        onClick={fetchData}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-400 text-xs font-semibold transition-all ${loading ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Scanning…' : 'Re-scan Now'}
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                    { l: 'BUY Signals', v: stats.buy, dotClass: 'bg-emerald-400', textClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10 border-emerald-500/20' },
                    { l: 'SELL Signals', v: stats.sell, dotClass: 'bg-rose-400', textClass: 'text-rose-400', bgClass: 'bg-rose-500/10 border-rose-500/20' },
                    { l: 'HOLD Signals', v: stats.hold, dotClass: 'bg-amber-400', textClass: 'text-amber-400', bgClass: 'bg-amber-500/10 border-amber-500/20' },
                ].map(s => (
                    <div key={s.l} className={`glass rounded-2xl p-4 border ${s.bgClass}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-2 h-2 rounded-full ${s.dotClass}`} />
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{s.l}</p>
                        </div>
                        <p className={`text-3xl font-black ${s.textClass}`}>{s.v}</p>
                    </div>
                ))}
            </div>

            {/* Filters + Search */}
            <div className="glass rounded-2xl p-4 border border-slate-800/60 mb-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search ticker or sector..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-slate-900/60 border border-slate-700/40 rounded-xl pl-8 pr-3 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 transition-all"
                    />
                </div>
                <div className="flex gap-1.5">
                    {(['ALL', 'BUY', 'SELL', 'HOLD'] as const).map(f => {
                        const isActive = filter === f;
                        const cls = isActive
                            ? f === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                : f === 'SELL' ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                    : f === 'HOLD' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                        : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40'
                            : 'text-slate-500 hover:text-slate-300 border-slate-700/40 hover:bg-slate-800/60';
                        return (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${cls}`}
                            >
                                {f}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Table */}
            <div className="glass rounded-2xl border border-slate-800/60 overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-0 px-4 py-3 border-b border-slate-800/60 bg-slate-900/40">
                    {['Ticker', 'Action', 'Confidence ↕', 'Regime', 'Daily % ↕', 'Last Updated', 'Sentiment', 'Accuracy'].map((h, i) => {
                        const isSort = (h.includes('Confidence') && sortKey === 'confidence') || (h.includes('%') && sortKey === 'pct_change');
                        return (
                            <button
                                key={h}
                                onClick={() => h.includes('Confidence') ? handleSort('confidence') : h.includes('%') ? handleSort('pct_change') : undefined}
                                className={`col-span-${[2, 2, 2, 2, 2, 2, 1, 1][i]} text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 transition-colors text-left ${isSort ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`}
                            >
                                {h.replace(' ↕', '')}
                                {h.includes('↕') && (sortDir === -1 ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronUp className="w-2.5 h-2.5" />)}
                            </button>
                        );
                    })}
                </div>

                {/* Rows */}
                {filtered.map((r, i) => {
                    const acColor = r.signal === 'BUY' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                        : r.signal === 'SELL' ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                            : 'text-amber-400 bg-amber-500/10 border-amber-500/30';
                    const retColor = r.pct_change >= 0 ? 'text-emerald-400' : 'text-rose-400';
                    const sentColor = r.sentiment.score > 70 ? 'text-emerald-400' : r.sentiment.score < 30 ? 'text-rose-400' : 'text-amber-400';
                    return (
                        <div key={r.ticker} className={`grid grid-cols-12 gap-0 px-4 py-3.5 items-center border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors cursor-pointer group ${i % 2 === 0 ? 'bg-slate-950/20' : ''}`}>
                            <div className="col-span-2 flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center">
                                    <span className="text-[8px] font-black text-indigo-300">{r.ticker.substring(0, 2)}</span>
                                </div>
                                <span className="text-xs font-bold text-slate-200">{r.ticker}</span>
                            </div>
                            <div className="col-span-2">
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${acColor}`}>{r.signal}</span>
                            </div>
                            <div className="col-span-2">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                                        <div className="bg-indigo-400 h-1.5 rounded-full" style={{ width: `${r.confidence * 100}%` }} />
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-300">{(r.confidence * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                            <div className="col-span-2 text-xs font-mono text-slate-200">{r.regime}</div>
                            <div className={`col-span-2 text-xs font-mono font-bold ${retColor}`}>
                                {r.pct_change >= 0 ? '+' : ''}{r.pct_change.toFixed(2)}%
                            </div>
                            <div className="col-span-2 text-[10px] text-slate-500 truncate">{new Date(r.last_updated).toLocaleTimeString()}</div>
                            <div className={`col-span-1 text-[10px] font-mono font-bold ${sentColor}`}>
                                {r.sentiment.score}
                            </div>
                            <div className="col-span-1 text-[10px] font-mono text-slate-400">{r.accuracy.toFixed(1)}%</div>
                        </div>
                    );
                })}

                {filtered.length === 0 && (
                    <div className="py-16 text-center text-slate-600">
                        <BarChart2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No signals match the current filter</p>
                    </div>
                )}
            </div>
        </div>
    );
}
