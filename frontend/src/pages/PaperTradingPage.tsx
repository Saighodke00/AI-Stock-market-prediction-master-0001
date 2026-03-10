import React, { useState, useEffect } from 'react';
import { fetchPositions, Position } from '../api/api';

export const PaperTradingPage: React.FC = () => {
    const [positions, setPositions] = useState<Position[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetchPositions();
                setPositions(res);
            } catch (e) {
                setError('Failed to connect to Neural Trading Engine');
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
        const interval = setInterval(load, 30000); // refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const totalPnL = positions.reduce((acc, p) => acc + (p.pnl_pct * p.quantity * p.entry_price / 100), 0);

    return (
        <div className="p-8 flex flex-col gap-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="font-display text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan to-white select-none">
                        PAPER <span className="text-secondary text-2xl font-normal not-italic tracking-normal">TRADING ENGINE</span>
                    </h1>
                    <p className="font-body text-muted text-sm mt-2 tracking-wide uppercase font-semibold">Real-time simulation environment</p>
                </div>

                <div className="bg-surface border border-dim rounded-lg p-4 flex flex-col gap-1 text-right min-w-[200px]">
                    <span className="font-data text-[10px] text-muted tracking-widest uppercase">Portfolio Net P&L</span>
                    <span className={`font-display font-bold text-2xl ${totalPnL >= 0 ? 'text-green' : 'text-red'}`}>
                        {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                </div>
            </div>

            {isLoading && positions.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                    <div className="w-12 h-12 border-2 border-t-cyan border-r-cyan border-b-transparent border-l-transparent rounded-full animate-spin" />
                    <span className="font-data text-cyan tracking-widest text-sm animate-pulse">SYNCING WITH EXCHANGE...</span>
                </div>
            ) : error ? (
                <div className="p-12 border border-red/30 bg-red-dim/10 rounded-xl text-center">
                    <p className="text-red font-body">{error}</p>
                    <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-red-dim/20 border border-red/50 rounded text-red text-sm">RE-INITIALIZE ENGINE</button>
                </div>
            ) : positions.length === 0 ? (
                <div className="p-20 border border-dashed border-dim rounded-2xl flex flex-col items-center justify-center text-center gap-4 bg-void/20">
                    <div className="text-4xl">📉</div>
                    <h3 className="font-display text-xl text-primary font-bold">No Active Positions</h3>
                    <p className="font-body text-secondary max-w-md italic">
                        Open the Swing or Intraday trading pages to execute new AI-powered paper trades.
                    </p>
                </div>
            ) : (
                <div className="bg-surface border border-dim rounded-xl overflow-hidden shadow-2xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-void/50 border-b border-dim">
                                <th className="p-4 font-data text-[10px] text-muted tracking-widest uppercase">Ticker</th>
                                <th className="p-4 font-data text-[10px] text-muted tracking-widest uppercase">Action</th>
                                <th className="p-4 font-data text-[10px] text-muted tracking-widest uppercase text-right">Entry Price</th>
                                <th className="p-4 font-data text-[10px] text-muted tracking-widest uppercase text-right">Current Price</th>
                                <th className="p-4 font-data text-[10px] text-muted tracking-widest uppercase text-right">Qty</th>
                                <th className="p-4 font-data text-[10px] text-muted tracking-widest uppercase text-right">P&L %</th>
                                <th className="p-4 font-data text-[10px] text-muted tracking-widest uppercase text-right">P&L Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dim/30">
                            {positions.map((p) => {
                                const pnlVal = (p.pnl_pct * p.quantity * p.entry_price) / 100;
                                return (
                                    <tr key={p.id} className="hover:bg-raised/30 transition-colors group">
                                        <td className="p-4 font-display font-bold text-primary tracking-wider group-hover:text-cyan transition-colors">{p.ticker}</td>
                                        <td className="p-4">
                                            <span className={`font-data text-[10px] px-2 py-0.5 rounded border ${p.action === 'BUY' ? 'text-green border-green/30 bg-green/5' : 'text-red border-red/30 bg-red/5'}`}>
                                                {p.action}
                                            </span>
                                        </td>
                                        <td className="p-4 font-data text-sm text-secondary text-right">₹{p.entry_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        <td className="p-4 font-data text-sm text-primary text-right font-semibold">₹{p.current_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        <td className="p-4 font-data text-sm text-muted text-right">{p.quantity}</td>
                                        <td className={`p-4 font-data text-sm text-right font-bold ${p.pnl_pct >= 0 ? 'text-green' : 'text-red'}`}>
                                            {p.pnl_pct >= 0 ? '+' : ''}{p.pnl_pct.toFixed(2)}%
                                        </td>
                                        <td className={`p-4 font-data text-sm text-right font-bold ${pnlVal >= 0 ? 'text-green' : 'text-red'}`}>
                                            {pnlVal >= 0 ? '+' : ''}₹{pnlVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
