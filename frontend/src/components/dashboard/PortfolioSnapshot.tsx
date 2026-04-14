import React, { useEffect, useState } from 'react';
import { Activity, Zap } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

export const PortfolioSnapshot: React.FC = () => {
    const [stats, setStats] = useState<any>(null);

    const token = useAuthStore((s: any) => s.token);

    useEffect(() => {
        if (!token) return;

        const fetchPortfolio = () => {
            fetch('/api/paper/summary', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
                .then(res => res.json())
                .then(setStats)
                .catch(err => console.error("Portfolio fetch error:", err));
        };

        fetchPortfolio();
        const interval = setInterval(fetchPortfolio, 30000);
        return () => clearInterval(interval);
    }, [token]);

    if (!stats) return <div className="h-40 bg-surface/30 animate-pulse rounded-2xl p-6 flex flex-col items-center justify-center font-data text-[10px] text-secondary tracking-widest uppercase border border-dim">Linking Neural Portfolio...</div>;

    const totalPnl = (stats.unrealised_pnl || 0) + (stats.realised_pnl || 0);
    const isProfit = totalPnl >= 0;

    return (
        <div className="neon-frame rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full ${isProfit ? 'bg-emerald shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-rose shadow-[0_0_15px_rgba(244,63,94,0.4)]'}`} />
            
            <div className="flex justify-between items-center mb-8">
                <div className="flex flex-col gap-1">
                    <span className="neon-label text-cyan">Portfolio Snapshot</span>
                    <h3 className="font-display font-black text-white text-[11px] tracking-[0.2em] uppercase">Live Command P&L</h3>
                </div>
                <div className={`p-2.5 rounded-xl bg-void/50 border border-dim ${isProfit ? 'text-emerald' : 'text-rose'}`}>
                    <Activity size={18} />
                </div>
            </div>

            <div className="flex flex-col gap-6">
                <div className="flex flex-col">
                    <span className="neon-label text-[7px] mb-2 opacity-60">Cumulative Performance</span>
                    <div className={`font-display text-5xl font-black ${isProfit ? 'text-emerald glow-emerald' : 'text-rose glow-rose'} tabular-nums tracking-tighter`}>
                        {totalPnl >= 0 ? '+' : ''}₹{Math.abs(totalPnl).toLocaleString('en-IN')}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-void/40 p-4 rounded-2xl border border-dim group-hover:border-mid transition-colors">
                        <span className="neon-label text-[7px] mb-1.5 block opacity-50">Total Return</span>
                        <span className={`font-display font-black text-lg ${stats.total_return_pct >= 0 ? 'text-emerald' : 'text-rose'}`}>
                            {stats.total_return_pct >= 0 ? '▲' : '▼'} {(stats.total_return_pct || 0).toFixed(2)}%
                        </span>
                    </div>
                    <div className="bg-void/40 p-4 rounded-2xl border border-dim group-hover:border-mid transition-colors">
                        <span className="neon-label text-[7px] mb-1.5 block opacity-50">Active Tactics</span>
                        <span className="font-display font-black text-white text-lg">
                            {stats.open_positions || 0} Open
                        </span>
                    </div>
                </div>

                <div className="h-1 w-full bg-void/50 rounded-full overflow-hidden mt-2">
                    <div 
                        className={`h-full ${isProfit ? 'bg-emerald glow-emerald' : 'bg-rose glow-rose'} transition-all duration-1000`} 
                        style={{ width: `${Math.min(Math.max(Math.abs(stats.total_return_pct || 0) * 10, 5), 100)}%` }} 
                    />
                </div>
            </div>
            
            <div className="absolute -bottom-10 -right-10 text-white/[0.02] rotate-[25deg] pointer-events-none group-hover:text-white/[0.04] transition-all duration-700">
                <Zap size={140} strokeWidth={1} />
            </div>
        </div>
    );

};
