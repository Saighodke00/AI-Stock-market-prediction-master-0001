import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Briefcase, TrendingUp, TrendingDown, DollarSign,
    RefreshCw, Clock, Wallet, BarChart3, Loader2, AlertCircle
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const fmt = (v: number | undefined | null) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v ?? 0);
const fmtPrecise = (v: number | undefined | null) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(v ?? 0);
const fmtPct = (v: number | undefined | null) => `${(v ?? 0) >= 0 ? '+' : ''}${(v ?? 0).toFixed(2)}%`;

interface PortfolioData {
    cash_balance: number;
    market_value: number;
    total_value: number;
    total_return_pct: number;
    win_rate: number;
    num_trades: number;
    positions: {
        ticker: string;
        shares: number;
        entry: number;
        current: number;
        pnl: number;
        pnl_pct: number;
    }[];
}

interface Trade {
    ticker: string;
    action: string;
    shares: number;
    price: number;
    total_value: number;
    signal_confidence: number;
    pnl: number | null;
    opened_at: string;
    closed_at: string | null;
}

export default function PortfolioView() {
    const [data, setData] = useState<PortfolioData | null>(null);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [portRes, tradeRes] = await Promise.all([
                axios.get('/api/paper/portfolio'),
                axios.get('/api/paper/trades')
            ]);
            setData(portRes.data);
            setTrades(tradeRes.data);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch portfolio data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // 30s refresh
        return () => clearInterval(interval);
    }, []);

    const resetPortfolio = async () => {
        if (!window.confirm('Are you sure you want to reset your portfolio to $100,000? All history will be cleared.')) return;
        try {
            await axios.post('/api/paper/reset');
            fetchData();
        } catch (err: any) {
            alert('Reset failed: ' + err.message);
        }
    };

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981'];

    const chartData = (Array.isArray(data?.positions) ? data.positions : []).map(p => ({
        name: p.ticker,
        value: p.shares * p.current
    })) || [];

    if (data && data.cash_balance > 0) {
        chartData.push({ name: 'Cash', value: data.cash_balance });
    }

    return (
        <div className="p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
                <div>
                   <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                            <Briefcase className="w-5 h-5 text-indigo-400" />
                        </div>
                        <h1 className="text-3xl font-display font-black text-white tracking-tight uppercase">Strategy Ledger <span className="text-slate-600 ml-1 font-normal italic">/ Portfolio</span></h1>
                   </div>
                   <p className="text-slate-500 text-xs font-bold font-body tracking-[0.1em] uppercase max-w-xl leading-relaxed">
                        Real-time equity valuation engine &middot; <span className="text-indigo-400">Low-latency yfinance sync</span> &middot; Neural risk clusters
                   </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        className="group p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white transition-all shadow-xl"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : 'group-hover:rotate-180 transition-transform duration-700'}`} />
                    </button>
                    <button
                        onClick={resetPortfolio}
                        className="group flex items-center gap-3 bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white hover:border-rose-500/50 hover:bg-rose-500/10 px-6 py-3 rounded-2xl font-display font-black text-[10px] tracking-widest transition-all duration-500 shadow-xl uppercase"
                    >
                        <AlertCircle size={14} className="group-hover:text-rose-400 transition-colors" />
                        Purge Portfolio
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-400">
                    <AlertCircle className="w-4 h-4" />
                    <p className="text-xs font-semibold">{error}</p>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-card p-6 flex flex-col gap-1 transition-all duration-500 hover:scale-[1.02] bg-white/[0.03] border-white/10 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Wallet size={60} /></div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Net Liquidity</p>
                    <p className="text-2xl font-display font-black text-white tracking-tight">{fmt(data?.total_value || 0)}</p>
                    <p className={`text-[10px] font-black mt-1 uppercase tracking-widest ${(data?.total_return_pct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {fmtPct(data?.total_return_pct || 0)} Yield
                    </p>
                </div>
                <div className="glass-card p-6 flex flex-col gap-1 transition-all duration-500 hover:scale-[1.02] bg-white/[0.03] border-white/10 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><DollarSign size={60} /></div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Buying Power</p>
                    <p className="text-2xl font-display font-black text-white tracking-tight">{fmt(data?.cash_balance || 0)}</p>
                    <p className="text-[10px] font-black text-slate-600 mt-1 uppercase tracking-widest">Settled Assets</p>
                </div>
                <div className="glass-card p-6 flex flex-col gap-1 transition-all duration-500 hover:scale-[1.02] bg-white/[0.03] border-white/10 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><TrendingUp size={60} /></div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Market Exposure</p>
                    <p className="text-2xl font-display font-black text-white tracking-tight">{fmt(data?.market_value || 0)}</p>
                    <p className="text-[10px] font-black text-slate-600 mt-1 uppercase tracking-widest">{data?.positions?.length || 0} active clusters</p>
                </div>
                <div className="glass-card p-6 flex flex-col gap-1 transition-all duration-500 hover:scale-[1.02] bg-white/[0.03] border-white/10 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><BarChart3 size={60} /></div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Model Precision</p>
                    <p className="text-2xl font-display font-black text-indigo-400 tracking-tight">{(data?.win_rate || 0).toFixed(1)}%</p>
                    <p className="text-[10px] font-black text-slate-600 mt-1 uppercase tracking-widest">{data?.num_trades || 0} protocol archive</p>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Positions Table */}
                <div className="lg:col-span-2 glass-card p-0 border border-white/5 overflow-hidden shadow-2xl flex flex-col">
                    <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                             <TrendingUp size={14} className="text-indigo-400" />
                             Live Equity Clusters
                        </h3>
                        <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest flex items-center gap-1.5"><Clock size={12} />Updated 30s ago</span>
                    </div>
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/[0.01]">
                                    {["Instrument", "Holdings", "Avg Intake", "Spot Price", "Unrealised Alpha"].map(h => (
                                        <th key={h} className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.02]">
                                {(Array.isArray(data?.positions) ? data.positions : []).map((p, i) => (
                                    <tr key={i} className="hover:bg-white/[0.03] transition-all group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-black text-[10px] text-indigo-400 shadow-inner tracking-tighter">
                                                    {p.ticker.substring(0, 2)}
                                                </div>
                                                <span className="text-sm font-display font-black text-white uppercase group-hover:text-indigo-400 transition-colors tracking-tight">{p.ticker}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-mono font-bold text-slate-300">{(p.shares ?? 0).toFixed(2)}</td>
                                        <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">{fmtPrecise(p.entry ?? 0)}</td>
                                        <td className="px-6 py-4 text-xs font-mono font-black text-white">{fmtPrecise(p.current ?? 0)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <p className={`text-xs font-black font-mono ${(p?.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {(p?.pnl ?? 0) >= 0 ? '+' : '-'}{fmtPrecise(Math.abs(p?.pnl ?? 0))}
                                                </p>
                                                <p className={`text-[10px] font-black uppercase tracking-tighter ${p.pnl_pct >= 0 ? 'text-emerald-500/50' : 'text-rose-500/50'}`}>
                                                    {fmtPct(p.pnl_pct)}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {(!data || !Array.isArray(data.positions) || data.positions.length === 0) && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-32 text-center">
                                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6 border border-white/10">
                                                <Briefcase className="w-8 h-8 text-slate-600" />
                                            </div>
                                            <h3 className="text-white font-display font-black text-xl mb-2 uppercase tracking-tight">Vapor Clusters</h3>
                                            <p className="text-slate-500 font-body text-xs max-w-xs mx-auto leading-relaxed italic">No active risk detected. Initiate a protocol entry to monitor live equity clusters.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Allocation Chart */}
                <div className="glass-card p-8 border border-white/5 flex flex-col h-fit sticky top-24 shadow-2xl overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-30" />
                    <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                        <PieChart size={14} className="text-indigo-400" />
                        Asset Topology
                    </h3>
                    <div className="h-64 w-full relative group-hover:scale-105 transition-transform duration-700">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={75}
                                    outerRadius={95}
                                    paddingAngle={8}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="focus:outline-none" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }: any) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="glass-card p-4 border-indigo-500/20 shadow-2xl animate-in zoom-in-95 duration-300">
                                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{payload[0].name}</p>
                                                    <p className="text-sm font-display font-black text-white">{fmt(payload[0].value)}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Portfolio</p>
                            <p className="text-xl font-display font-black text-white tracking-tight">${(data?.total_value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                    </div>

                    <div className="mt-8 space-y-4">
                        {chartData.map((d, i) => (
                            <div key={i} className="flex items-center justify-between group/item">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] transition-all group-hover/item:scale-125" style={{ backgroundColor: COLORS[i % COLORS.length], color: COLORS[i % COLORS.length] }} />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover/item:text-white transition-colors">{d.name}</span>
                                </div>
                                <span className="text-[10px] font-mono font-black text-slate-600 group-hover/item:text-indigo-400 transition-colors">{((d.value / (data?.total_value || 1)) * 100).toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Trade History Log */}
            <div className="mt-8 glass-card p-0 border border-white/5 overflow-hidden shadow-2xl flex flex-col">
                <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                        <History size={14} className="text-indigo-400" />
                        Settlement Archive
                    </h3>
                </div>
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.01]">
                                {["Protocol Date", "Instrument", "Action", "Units", "Fill", "Settled P&L"].map(h => (
                                    <th key={h} className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                            {(Array.isArray(trades) ? trades : []).slice(0, 50).map((t, i) => (
                                <tr key={i} className="hover:bg-white/[0.03] transition-all group">
                                    <td className="px-6 py-4 text-[11px] font-mono font-bold text-slate-500 uppercase tracking-tighter">{new Date(t.opened_at).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                    <td className="px-6 py-4 text-xs font-display font-black text-slate-300 uppercase tracking-tight group-hover:text-indigo-400 transition-colors">{t.ticker}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest border border-current transition-colors ${t?.action === 'BUY' ? 'bg-indigo-500/5 text-indigo-400 border-indigo-500/20' : 'bg-rose-500/5 text-rose-400 border-rose-500/20'}`}>
                                            {t?.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-mono font-bold text-slate-500">{(t?.shares ?? 0).toFixed(2)}</td>
                                    <td className="px-6 py-4 text-xs font-mono font-bold text-slate-500">{fmtPrecise(t?.price ?? 0)}</td>
                                    <td className="px-6 py-4 text-right">
                                        {t.pnl !== null ? (
                                            <span className={`text-[11px] font-black font-mono transition-colors ${(t.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {(t.pnl ?? 0) >= 0 ? '+' : '-'}{fmtPrecise(Math.abs(t.pnl ?? 0))}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest italic animate-pulse">In-Flight</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {trades.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-32 text-center">
                                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6 border border-white/10">
                                            <History className="w-8 h-8 text-slate-600" />
                                        </div>
                                        <h3 className="text-white font-display font-black text-xl mb-2 uppercase tracking-tight">Archive Null</h3>
                                        <p className="text-slate-500 font-body text-xs max-w-xs mx-auto leading-relaxed italic">No historical trades found in the ledger. All executions will be permanently logged here.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
