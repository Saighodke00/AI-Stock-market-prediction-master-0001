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

    if (!stats) return <div className="h-40 bg-surface/30 animate-pulse rounded-2xl p-6 flex flex-col items-center justify-center font-data text-[10px] text-secondary tracking-widest uppercase border border-white/5">Linking Neural Portfolio...</div>;

    const isProfit = stats.pnl >= 0;

    return (
        <div className="bg-surface/30 border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full ${isProfit ? 'bg-emerald' : 'bg-rose'}`} />
            
            <div className="flex justify-between items-center mb-6">
                <div className="flex flex-col gap-1">
                    <span className="font-data text-[10px] text-secondary tracking-widest uppercase">Portfolio Snapshot</span>
                    <h3 className="font-display font-black text-white text-xs tracking-widest uppercase">Live Command P&L</h3>
                </div>
                <div className={`p-2 rounded-lg bg-void/50 border border-white/5 ${isProfit ? 'text-emerald' : 'text-rose'}`}>
                    <Activity size={18} />
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex flex-col">
                    <span className="font-data text-[9px] text-muted tracking-widest uppercase mb-1">Unrealised / Realised Delta</span>
                    <div className={`font-display text-4xl font-black ${isProfit ? 'text-emerald glow-emerald' : 'text-rose glow-rose'} tabular-nums`}>
                        {isProfit ? '+' : ''}₹{Math.abs(stats.pnl || 0).toLocaleString('en-IN')}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-void/40 p-3 rounded-xl border border-white/5">
                        <span className="font-data text-[8px] text-secondary uppercase tracking-widest block mb-1">ROE Index</span>
                        <span className={`font-display font-bold text-sm ${isProfit ? 'text-emerald' : 'text-rose'}`}>
                            {isProfit ? '▲' : '▼'} {(stats.return_pct || 0).toFixed(2)}%
                        </span>
                    </div>
                    <div className="bg-void/40 p-3 rounded-xl border border-white/5">
                        <span className="font-data text-[8px] text-secondary uppercase tracking-widest block mb-1">Open Tactics</span>
                        <span className="font-display font-bold text-white text-sm">
                            {stats.active_positions} Active
                        </span>
                    </div>
                </div>

                <div className="h-1.5 w-full bg-void rounded-full overflow-hidden border border-white/5 mt-2">
                    <div 
                        className={`h-full ${isProfit ? 'bg-emerald' : 'bg-rose'} transition-all duration-1000`} 
                        style={{ width: `${Math.min(Math.abs(stats.return_pct) * 5, 100)}%` }} 
                    />
                </div>
            </div>
            
            <div className="absolute -bottom-6 -right-6 text-emerald/5 rotate-12 pointer-events-none">
                <Zap size={100} strokeWidth={1} />
            </div>
        </div>
    );
};
