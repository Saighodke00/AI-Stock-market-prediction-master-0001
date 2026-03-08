import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Briefcase, TrendingUp, TrendingDown, DollarSign,
    RefreshCw, Clock, Wallet, BarChart3, Loader2, AlertCircle
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const fmt = (v: number | undefined | null) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v ?? 0);
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
        <div className="p-4 md:p-5 lg:p-6 h-full overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                <div className="flex-1">
                    <h2 className="text-lg font-black text-white">Live Paper Portfolio</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Real-time valuation based on yfinance data feeds</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/40 text-slate-400 hover:text-white transition-all"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
                    </button>
                    <button
                        onClick={resetPortfolio}
                        className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500/20 transition-all"
                    >
                        Reset Portfolio
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="glass rounded-3xl p-5 border border-slate-800/60 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform"><Wallet className="w-8 h-8" /></div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-2">Total Value</p>
                    <p className="text-xl font-black text-white">{fmt(data?.total_value || 0)}</p>
                    <p className={`text-[10px] font-bold mt-1 ${(data?.total_return_pct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {fmtPct(data?.total_return_pct || 0)} All-time
                    </p>
                </div>
                <div className="glass rounded-3xl p-5 border border-slate-800/60 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform"><DollarSign className="w-8 h-8" /></div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-2">Buying Power</p>
                    <p className="text-xl font-black text-white">{fmt(data?.cash_balance || 0)}</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">Settled Cash</p>
                </div>
                <div className="glass rounded-3xl p-5 border border-slate-800/60 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform"><TrendingUp className="w-8 h-8" /></div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-2">Market Value</p>
                    <p className="text-xl font-black text-white">{fmt(data?.market_value || 0)}</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">{data?.positions?.length || 0} Positions</p>
                </div>
                <div className="glass rounded-3xl p-5 border border-slate-800/60 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform"><BarChart3 className="w-8 h-8" /></div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-2">Win Rate</p>
                    <p className="text-xl font-black text-indigo-400">{(data?.win_rate || 0).toFixed(1)}%</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">{data?.num_trades || 0} Closed Trades</p>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Positions Table */}
                <div className="lg:col-span-2 glass rounded-3xl border border-slate-800/60 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-200">Open Positions</h3>
                        <span className="text-[10px] text-slate-600 flex items-center gap-1.5"><Clock className="w-3 h-3" />Updated 30s ago</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-800/40 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                                    <th className="px-6 py-4">Ticker</th>
                                    <th className="px-6 py-4">Shares</th>
                                    <th className="px-6 py-4">Avg Cost</th>
                                    <th className="px-6 py-4">Current</th>
                                    <th className="px-6 py-4 text-right">PnL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(Array.isArray(data?.positions) ? data.positions : []).map((p, i) => (
                                    <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-900/40 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-black text-xs text-indigo-400">
                                                    {p.ticker.substring(0, 2)}
                                                </div>
                                                <span className="text-sm font-bold text-white uppercase">{p.ticker}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-mono text-slate-300">{(p.shares ?? 0).toFixed(2)}</td>
                                        <td className="px-6 py-4 text-xs font-mono text-slate-400">${(p.entry ?? 0).toFixed(2)}</td>
                                        <td className="px-6 py-4 text-xs font-mono text-white">${(p.current ?? 0).toFixed(2)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <p className={`text-xs font-black font-mono ${(p?.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {(p?.pnl ?? 0) >= 0 ? '+' : ''}{(p?.pnl ?? 0).toFixed(2)}
                                            </p>
                                            <p className={`text-[10px] font-bold ${p.pnl_pct >= 0 ? 'text-emerald-500/60' : 'text-rose-500/60'}`}>
                                                {fmtPct(p.pnl_pct)}
                                            </p>
                                        </td>
                                    </tr>
                                ))}
                                {(!data || !Array.isArray(data.positions) || data.positions.length === 0) && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center">
                                            <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center mx-auto mb-4 border border-slate-800">
                                                <Briefcase className="w-5 h-5 text-slate-700" />
                                            </div>
                                            <p className="text-sm font-bold text-slate-500">No open positions</p>
                                            <p className="text-xs text-slate-700 mt-1">Trades will appear here once AI signals are followed.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Allocation Chart */}
                <div className="glass rounded-3xl p-6 border border-slate-800/60 flex flex-col h-fit sticky top-20">
                    <h3 className="text-sm font-bold text-slate-200 mb-6">Asset Allocation</h3>
                    <div className="h-64 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }: any) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="glass rounded-xl p-3 border border-slate-700/60 shadow-2xl text-xs">
                                                    <p className="text-white font-bold mb-1">{payload[0].name}</p>
                                                    <p className="text-indigo-400">{fmt(payload[0].value)}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <p className="text-[9px] font-bold text-slate-600 uppercase">Total</p>
                            <p className="text-sm font-black text-white">${(data?.total_value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                    </div>

                    <div className="mt-6 space-y-3">
                        {chartData.map((d, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                    <span className="text-xs font-bold text-slate-400">{d.name}</span>
                                </div>
                                <span className="text-xs font-mono text-slate-500">{((d.value / (data?.total_value || 1)) * 100).toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Trade History Log */}
            <div className="mt-6 glass rounded-3xl border border-slate-800/60 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800/60 h-14 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-200">Closed Trades & History</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-800/40 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Ticker</th>
                                <th className="px-6 py-4">Action</th>
                                <th className="px-6 py-4">Shares</th>
                                <th className="px-6 py-4">Price</th>
                                <th className="px-6 py-4 text-right">Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(Array.isArray(trades) ? trades : []).slice(0, 50).map((t, i) => (
                                <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-900/40 transition-colors">
                                    <td className="px-6 py-4 text-[11px] text-slate-500">{new Date(t.opened_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-xs font-bold text-slate-300 uppercase">{t.ticker}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${t?.action === 'BUY' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                            {t?.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-mono text-slate-500">{(t?.shares ?? 0).toFixed(2)}</td>
                                    <td className="px-6 py-4 text-xs font-mono text-slate-500">${(t?.price ?? 0).toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right">
                                        {t.pnl !== null ? (
                                            <span className={`text-[11px] font-black font-mono ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-slate-700 italic">Open</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {trades.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-600 text-[11px]">
                                        No trading history recorded yet.
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
