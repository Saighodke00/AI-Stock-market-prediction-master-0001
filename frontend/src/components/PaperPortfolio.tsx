import React, { useState, useEffect } from 'react';
import { PaperPortfolioSummary, PaperTradeSchema, PaperPositionSchema } from '../types/portfolio';

const PaperPortfolio: React.FC = () => {
    const [portfolio, setPortfolio] = useState<PaperPortfolioSummary | null>(null);
    const [trades, setTrades] = useState<PaperTradeSchema[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    const fetchPortfolio = async () => {
        try {
            const resp = await fetch('/api/paper/portfolio');
            if (!resp.ok) throw new Error('Failed to fetch portfolio');
            const data = await resp.ok ? await resp.json() : null;
            setPortfolio(data);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const fetchTrades = async () => {
        try {
            const resp = await fetch('/api/paper/trades');
            if (resp.ok) {
                const data = await resp.json();
                setTrades(data);
            }
        } catch (err) { }
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await Promise.all([fetchPortfolio(), fetchTrades()]);
            setLoading(false);
        };
        init();

        // Auto-refresh every 30 seconds for live feel
        const interval = setInterval(fetchPortfolio, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleReset = async () => {
        try {
            const resp = await fetch('/api/paper/reset', { method: 'POST' });
            if (resp.ok) {
                setShowResetConfirm(false);
                await Promise.all([fetchPortfolio(), fetchTrades()]);
            }
        } catch (err) {
            alert("Reset failed");
        }
    };

    if (loading) return <div className="p-8 text-center text-secondary animate-pulse">Loading Paper Portfolio...</div>;
    if (error) return <div className="p-8 text-center text-rose-500">Error: {error}</div>;
    if (!portfolio) return null;

    return (
        <div className="flex flex-col space-y-6 w-full max-w-6xl mx-auto p-6 bg-base/40 backdrop-blur-2xl rounded-3xl border border-dim shadow-3xl animate-in fade-in zoom-in-95 duration-500">

            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-6 rounded-2xl bg-white/5/50 border border-mid/50 flex flex-col justify-center">
                    <p className="text-[10px] text-muted uppercase tracking-widest font-bold mb-1">Total Portfolio Value</p>
                    <p className="text-3xl font-black text-white tracking-tighter">
                        ${(portfolio.total_value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className={`flex items-center mt-2 text-xs font-bold ${portfolio.total_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {portfolio.total_return_pct >= 0 ? '▲' : '▼'} {Math.abs(portfolio.total_return_pct).toFixed(2)}%
                    </div>
                </div>

                <div className="p-6 rounded-2xl bg-white/5/20 border border-dim/50">
                    <p className="text-[10px] text-muted uppercase tracking-widest font-bold mb-1">Available Cash</p>
                    <p className="text-xl font-bold text-primary">
                        ${(portfolio.cash_balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="p-6 rounded-2xl bg-white/5/20 border border-dim/50">
                    <p className="text-[10px] text-muted uppercase tracking-widest font-bold mb-1">Market Value</p>
                    <p className="text-xl font-bold text-primary">
                        ${(portfolio.market_value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="p-6 rounded-2xl bg-white/5/20 border border-dim/50">
                    <p className="text-[10px] text-muted uppercase tracking-widest font-bold mb-1">Signal Win Rate</p>
                    <p className="text-xl font-bold text-emerald-400">
                        {(portfolio.win_rate ?? 0).toFixed(1)}% <span className="text-[10px] text-muted ml-1">({portfolio.num_trades ?? 0} trades)</span>
                    </p>
                </div>
            </div>

            {/* Main Content: Positions & Trades */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Open Positions */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white flex items-center">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                            Open Positions
                        </h3>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-dim bg-void/40">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-base/80 text-[10px] font-black uppercase tracking-widest text-muted">
                                <tr>
                                    <th className="px-4 py-3">Ticker</th>
                                    <th className="px-4 py-3">Shares</th>
                                    <th className="px-4 py-3 text-right">Avg Entry</th>
                                    <th className="px-4 py-3 text-right">Current</th>
                                    <th className="px-4 py-3 text-right">PnL</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {(() => {
                                    const safeArray = <T,>(val: unknown): T[] => Array.isArray(val) ? (val as T[]) : [];
                                    const positions = safeArray<PaperPositionSchema>(portfolio.positions);
                                    if (positions.length === 0) {
                                        return (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-12 text-center text-muted italic">No open positions. Follow a signal to start.</td>
                                            </tr>
                                        );
                                    }
                                    return positions.map((pos) => (
                                        <tr key={pos.ticker} className="hover:bg-white/5/30 transition-colors group">
                                            <td className="px-4 py-4 font-bold text-white">{pos.ticker}</td>
                                            <td className="px-4 py-4 text-secondary font-mono text-xs">{(pos.shares ?? 0).toFixed(4)}</td>
                                            <td className="px-4 py-4 text-right text-secondary">${(pos.entry ?? 0).toFixed(2)}</td>
                                            <td className="px-4 py-4 text-right text-white font-semibold">${(pos.current ?? 0).toFixed(2)}</td>
                                            <td className={`px-4 py-4 text-right font-black ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                <div className="flex flex-col items-end">
                                                    <span>{(pos.pnl ?? 0) >= 0 ? '+' : ''}${Math.abs(pos.pnl ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                                    <span className="text-[10px] opacity-70">{(pos.pnl_pct ?? 0).toFixed(2)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ));
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Trades Sidebar */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white">Trade History</h3>
                        <button
                            onClick={() => setShowResetConfirm(true)}
                            className="text-[10px] font-bold text-rose-400 hover:text-rose-300 uppercase tracking-tighter bg-rose-500/5 border border-rose-500/20 px-2 py-1 rounded-md transition-all"
                        >
                            Reset Simulator
                        </button>
                    </div>

                    <div className="flex flex-col space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                        {(() => {
                            const safeArray = <T,>(val: unknown): T[] => Array.isArray(val) ? (val as T[]) : [];
                            const safeTrades = safeArray<PaperTradeSchema>(trades);
                            if (safeTrades.length === 0) {
                                return <div className="p-8 text-center text-muted text-xs italic border border-dashed border-dim rounded-xl">History is empty.</div>;
                            }
                            return safeTrades.map((trade, idx) => (
                                <div key={idx} className="p-3 rounded-xl bg-white/5/30 border border-dim/50 hover:border-mid transition-all">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${trade.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                            {trade.action}
                                        </span>
                                        <span className="text-[10px] text-muted font-mono">
                                            {new Date(trade.opened_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-sm font-bold text-white leading-tight">{trade.ticker}</p>
                                            <p className="text-[10px] text-muted">{(trade.shares ?? 0).toFixed(2)} shares @ ${(trade.price ?? 0).toFixed(2)}</p>
                                        </div>
                                        {trade.pnl !== null && (
                                            <div className={`text-xs font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {trade.pnl >= 0 ? '+' : '-'}${Math.abs(trade.pnl ?? 0).toFixed(2)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            </div>

            {/* Reset Confirmation Overlay */}
            {showResetConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-base border border-dim p-8 rounded-3xl shadow-3xl max-w-sm w-full text-center space-y-4">
                        <h4 className="text-xl font-bold text-white">Reset Portfolio?</h4>
                        <p className="text-sm text-secondary leading-relaxed">
                            This will permanently delete all positions and trade history, and reset your cash balance to $100,000.
                        </p>
                        <div className="flex flex-col space-y-3 pt-2">
                            <button
                                onClick={handleReset}
                                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-lg shadow-rose-600/20"
                            >
                                Yes, Reset Everything
                            </button>
                            <button
                                onClick={() => setShowResetConfirm(false)}
                                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-secondary font-bold transition-all"
                            >
                                Keep Trading
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaperPortfolio;
