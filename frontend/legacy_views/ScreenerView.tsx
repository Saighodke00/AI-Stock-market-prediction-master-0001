import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Search, TrendingUp, TrendingDown, Filter, RefreshCw,
    ChevronUp, ChevronDown, BarChart2, Clock, AlertCircle,
    Loader2
} from 'lucide-react';
import { APIResponse } from '../types';

const fmt2 = (v: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

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
        <div className="p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
                <div>
                   <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                            <Search className="w-5 h-5 text-indigo-400" />
                        </div>
                        <h1 className="text-3xl font-display font-black text-white tracking-tight uppercase">Alpha Scanner <span className="text-slate-600 ml-1 font-normal italic">/ Market Scan</span></h1>
                   </div>
                   <p className="text-slate-500 text-xs font-bold font-body tracking-[0.1em] uppercase max-w-xl leading-relaxed">
                        TFT Signal scan across <span className="text-indigo-400">NIFTY 500 &middot; S&P 500</span> &middot; Neural Regime Detection &middot; Real-time Synthesis
                   </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/[0.02] border border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest shadow-inner">
                        <Clock className="w-3 h-3 text-indigo-500/50" />
                        <span>Updated 14m ago</span>
                    </div>
                    <button
                        onClick={fetchData}
                        className={`group flex items-center gap-3 px-6 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] active:scale-95 ${loading ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-700 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Executing Scan…' : 'Initiate Scan'}
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                    { l: 'BULLISH SIGNALS', v: stats.buy, dotClass: 'bg-emerald-400 shadow-[0_0_10px_#10b981]', textClass: 'text-emerald-400', bgClass: 'bg-emerald-500/5 border-emerald-500/10' },
                    { l: 'BEARISH SIGNALS', v: stats.sell, dotClass: 'bg-rose-400 shadow-[0_0_10px_#f43f5e]', textClass: 'text-rose-400', bgClass: 'bg-rose-500/5 border-rose-500/10' },
                    { l: 'NEUTRAL STANCE', v: stats.hold, dotClass: 'bg-amber-400 shadow-[0_0_10px_#f59e0b]', textClass: 'text-amber-400', bgClass: 'bg-amber-500/5 border-amber-500/10' },
                ].map(s => (
                    <div key={s.l} className={`glass-card p-6 border transition-all duration-500 hover:scale-[1.02] shadow-2xl relative overflow-hidden group ${s.bgClass}`}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-2 h-2 rounded-full ${s.dotClass}`} />
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-slate-400 transition-colors">{s.l}</p>
                        </div>
                        <p className={`text-4xl font-display font-black tracking-tighter ${s.textClass}`}>{s.v}</p>
                    </div>
                ))}
            </div>

            {/* Filters + Search */}
            <div className="glass-card p-3 border border-white/5 flex flex-col sm:flex-row gap-4 shadow-xl">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 transition-colors group-focus-within:text-indigo-500" />
                    <input
                        type="text"
                        placeholder="Filter by Ticker, Sector, or Neural Metric..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-white/[0.02] border border-white/5 rounded-2xl pl-12 pr-4 py-3.5 text-xs font-bold text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/30 transition-all shadow-inner"
                    />
                </div>
                <div className="flex p-1 bg-white/[0.02] rounded-2xl border border-white/5">
                    {(['ALL', 'BUY', 'SELL', 'HOLD'] as const).map(f => {
                        const isActive = filter === f;
                        const cls = isActive
                            ? f === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                                : f === 'SELL' ? 'bg-rose-500/20 text-rose-400 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                                    : f === 'HOLD' ? 'bg-amber-500/20 text-amber-400 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                                        : 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                            : 'text-slate-600 hover:text-slate-400 hover:bg-white/[0.02]';
                        return (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${cls}`}
                            >
                                {f}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Table */}
            <div className="glass-card p-0 border border-white/5 overflow-hidden shadow-2xl flex flex-col relative group">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
                
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-0 px-8 py-5 border-b border-white/5 bg-white/[0.02]">
                    {['Ticker', 'Neural Signal', 'Confidence ↕', 'Regime', 'Daily Ret. ↕', 'Latency', 'Sentiment', 'Alpha'].map((h, i) => {
                        const isSort = (h.includes('Confidence') && sortKey === 'confidence') || (h.includes('Ret.') && sortKey === 'pct_change');
                        return (
                            <button
                                key={h}
                                onClick={() => h.includes('Confidence') ? handleSort('confidence') : h.includes('Ret.') ? handleSort('pct_change') : undefined}
                                className={`col-span-${[2, 2, 2, 2, 2, 1, 1, 0][i] || 1} text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 transition-all group/h ${isSort ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`}
                            >
                                {h.replace(' ↕', '')}
                                {h.includes('↕') && (
                                    <div className="flex flex-col -gap-1">
                                        <ChevronUp size={10} className={`${isSort && sortDir === 1 ? 'text-indigo-400' : 'opacity-20'}`} />
                                        <ChevronDown size={10} className={`${isSort && sortDir === -1 ? 'text-indigo-400' : 'opacity-20'}`} />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Rows */}
                <div className="divide-y divide-white/[0.02]">
                    {filtered.map((r, i) => {
                        const acColor = r.signal === 'BUY' ? 'text-emerald-400 bg-emerald-500/5 border-emerald-500/20'
                            : r.signal === 'SELL' ? 'text-rose-400 bg-rose-500/5 border-rose-500/20'
                                : 'text-amber-400 bg-amber-500/5 border-amber-500/20';
                        const retColor = r.pct_change >= 0 ? 'text-emerald-400' : 'text-rose-400';
                        const sentColor = r.sentiment.score > 70 ? 'text-emerald-400' : r.sentiment.score < 30 ? 'text-rose-400' : 'text-amber-400';
                        return (
                            <div key={r.ticker} className="grid grid-cols-12 gap-0 px-8 py-5 items-center hover:bg-white/[0.03] transition-all cursor-pointer group/row relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                                
                                <div className="col-span-2 flex items-center gap-4">
                                    <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover/row:scale-110 group-hover/row:bg-white/10 transition-all">
                                        <span className="text-[10px] font-black text-slate-400 group-hover/row:text-white transition-colors">{r.ticker.substring(0, 2)}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-display font-black text-white tracking-tight uppercase group-hover/row:text-indigo-400 transition-colors uppercase">{r.ticker}</span>
                                        <span className="text-[8px] text-slate-600 font-bold tracking-widest uppercase">Global Equities</span>
                                    </div>
                                </div>

                                <div className="col-span-2">
                                    <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase border tracking-[0.1em] shadow-inner transition-colors duration-500 ${acColor}`}>{r.signal}</span>
                                </div>

                                <div className="col-span-2 pr-8">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 bg-white/5 rounded-full h-1 overflow-hidden">
                                            <div className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-1000" style={{ width: `${r.confidence * 100}%` }} />
                                        </div>
                                        <span className="text-[10px] font-mono font-black text-slate-300">{(r.confidence * 100).toFixed(0)}%</span>
                                    </div>
                                </div>

                                <div className="col-span-2 flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{r.regime}</span>
                                    <span className="text-[8px] text-slate-700 font-bold uppercase tracking-widest mt-0.5">Probabilistic State</span>
                                </div>

                                <div className={`col-span-2 flex flex-col`}>
                                    <div className={`flex items-center gap-1.5 text-xs font-mono font-black ${retColor}`}>
                                        {r.pct_change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                        {r.pct_change >= 0 ? '+' : ''}{r.pct_change.toFixed(2)}%
                                    </div>
                                    <span className="text-[8px] text-slate-700 font-bold uppercase tracking-widest mt-0.5">24H Delta</span>
                                </div>

                                <div className="col-span-1">
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">{new Date(r.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>

                                <div className="col-span-1">
                                    <div className={`flex items-center gap-2 text-[10px] font-mono font-black ${sentColor}`}>
                                        <AlertCircle size={10} className="opacity-50" />
                                        {r.sentiment.score}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filtered.length === 0 && (
                    <div className="py-32 text-center flex flex-col items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10">
                            <Filter size={32} className="text-slate-600" />
                        </div>
                        <h3 className="text-white font-display font-black text-xl mb-2 uppercase tracking-tight">Scanner Passive</h3>
                        <p className="text-slate-500 font-body text-xs max-w-xs mx-auto leading-relaxed italic">No assets correlate with the signature "{search}" under the current {filter} filter constraint.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
