import React, { useEffect, useState } from 'react';
import { EquityCurveChart } from '../trading/EquityCurveChart';
import { Activity, Zap } from 'lucide-react';

export const PortfolioSnapshot: React.FC = () => {
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        const fetchPortfolio = () => {
            fetch('/api/portfolio/stats')
                .then(res => res.json())
                .then(setStats)
                .catch(err => console.error("Portfolio fetch error:", err));
        };

        fetchPortfolio();
        const interval = setInterval(fetchPortfolio, 30000);
        return () => clearInterval(interval);
    }, []);

    if (!stats) return <div className="h-40 bg-surface/30 animate-pulse rounded-2xl p-6 flex flex-col items-center justify-center font-data text-[10px] text-secondary tracking-widest uppercase border border-dim">Linking Neural Portfolio...</div>;

    const isProfit = stats.pnl >= 0;

    return (
        <div className="neon-frame rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full ${isProfit ? 'bg-emerald shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-rose shadow-[0_0_15px_rgba(244,63,94,0.4)]'}`} />
            
            <div className="flex justify-between items-center mb-8">
                <div className="flex flex-col gap-1">
                    <span className="neon-label">Portfolio Snapshot</span>
                    <h3 className="font-display font-black text-white text-[11px] tracking-[0.2em] uppercase">Live Command P&L</h3>
                </div>
                <div className={`p-2.5 rounded-xl bg-void/50 border border-dim ${isProfit ? 'text-emerald glow-emerald' : 'text-rose glow-rose'}`}>
                    <Activity size={18} />
                </div>
            </div>

            <div className="flex flex-col gap-6">
                <div className="flex flex-col">
                    <span className="neon-label text-[7px] mb-2 opacity-60">Unrealized / Realized Delta</span>
                    <div className={`font-display text-5xl font-black ${isProfit ? 'text-emerald glow-emerald' : 'text-rose glow-rose'} tabular-nums tracking-tighter`}>
                        {isProfit ? '+' : ''}₹{Math.abs(stats.pnl || 0).toLocaleString('en-IN')}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-void/40 p-4 rounded-2xl border border-dim group-hover:border-mid transition-colors">
                        <span className="neon-label text-[7px] mb-1.5 block opacity-50">ROE Index</span>
                        <span className={`font-display font-black text-lg ${isProfit ? 'text-emerald' : 'text-rose'}`}>
                            {isProfit ? '▲' : '▼'} {(stats.return_pct || 0).toFixed(2)}%
                        </span>
                    </div>
                    <div className="bg-void/40 p-4 rounded-2xl border border-dim group-hover:border-mid transition-colors">
                        <span className="neon-label text-[7px] mb-1.5 block opacity-50">Open Tactics</span>
                        <span className="font-display font-black text-white text-lg">
                            {stats.active_positions} Active
                        </span>
                    </div>
                </div>

                <div className="h-1 w-full bg-void/50 rounded-full overflow-hidden mt-2">
                    <div 
                        className={`h-full ${isProfit ? 'bg-emerald glow-emerald' : 'bg-rose glow-rose'} transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)]`} 
                        style={{ width: `${Math.min(Math.abs(stats.return_pct) * 5, 100)}%` }} 
                    />
                </div>
            </div>
            
            <div className="absolute -bottom-10 -right-10 text-white/[0.02] rotate-[25deg] pointer-events-none group-hover:text-white/[0.04] transition-all duration-700">
                <Zap size={140} strokeWidth={1} />
            </div>
        </div>
    );

};
