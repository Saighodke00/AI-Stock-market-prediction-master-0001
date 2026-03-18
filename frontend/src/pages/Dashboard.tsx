import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap } from 'lucide-react';
import { MarketRegimeBanner } from '../components/trading/MarketRegimeBanner';
import { MiniSparkline } from '../components/trading/MiniSparkline';
import { LiveSystemLogs } from '../components/trading/LiveSystemLogs';
import { MarketPulseBar } from '../components/dashboard/MarketPulseBar';
import { HeatMapStrip } from '../components/dashboard/HeatMapStrip';
import { PortfolioSnapshot } from '../components/dashboard/PortfolioSnapshot';
import { useAccentColor } from '../hooks/useAccentColor';
import { HeroSignalCard } from '../components/dashboard/HeroSignalCard';

export const DashboardPage: React.FC = () => {
    const nav = useNavigate();
    const [stats, setStats] = useState<any>(null);
    const [signals, setSignals] = useState<any[]>([]);
    const { colorClass, glowClass, bgClass } = useAccentColor();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, signalsRes] = await Promise.all([
                    fetch('/api/dashboard-stats'),
                    fetch('/api/screener')
                ]);
                
                const statsData = await statsRes.json();
                const signalsData = await signalsRes.json();
                
                setStats(statsData);
                if (signalsData.results) {
                    setSignals(signalsData.results);
                }
            } catch (err) {
                console.error("Dashboard primary fetch error:", err);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    // Filter signals to exclude the top one for the grid
    const topSignal = stats?.top_signal;
    const gridSignals = signals
        .filter(s => s.ticker !== topSignal?.ticker)
        .slice(0, 3);

    return (
        <div className="flex flex-col h-full overflow-y-auto pb-12 animate-page-in gap-10 bg-void scrollbar-hide">
            {/* 1. Live Market Pulse Bar */}
            <MarketPulseBar />

            <div className="px-10 flex flex-col gap-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
                    <div className="relative group">
                        <div className={`absolute -inset-12 ${bgClass} rounded-full blur-[140px] opacity-20 group-hover:opacity-30 transition-opacity duration-1000`} />
                        <h1 className={`font-display font-black ${colorClass} text-3xl md:text-4xl tracking-tighter ${glowClass} inline-block uppercase relative z-10`}>
                            Mission Control
                        </h1>
                        <p className="font-data text-[9px] text-slate-400 tracking-[0.4em] mt-2 uppercase font-bold relative z-10">
                            // Unified Neural Strategic Command Terminal
                        </p>
                    </div>

                    <div className="flex gap-3 relative z-10">
                         <div className="px-5 py-3 bg-surface/40 border border-white/5 rounded-2xl flex flex-col items-center min-w-[100px]">
                            <span className="text-[8px] font-data text-muted uppercase tracking-widest mb-1">Buy Breadth</span>
                            <span className="text-xl font-display font-black text-emerald tabular-nums">{stats?.market_breadth?.buys || 0}</span>
                         </div>
                         <div className="px-5 py-3 bg-surface/40 border border-white/5 rounded-2xl flex flex-col items-center min-w-[100px]">
                            <span className="text-[8px] font-data text-muted uppercase tracking-widest mb-1">Sell Breadth</span>
                            <span className="text-xl font-display font-black text-rose tabular-nums">{stats?.market_breadth?.sells || 0}</span>
                         </div>
                    </div>
                </div>

                {/* Main Dashboard Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* LEFT COLUMN: Intelligence & Heatmap (COL 8) */}
                    <div className="lg:col-span-8 flex flex-col gap-8">
                        
                        {/* 2. Hero Signal Card */}
                        <div className="flex flex-col gap-3">
                             <div className="flex justify-between items-center px-2">
                                <h2 className="font-display font-black text-white text-[10px] tracking-[0.3em] uppercase flex items-center gap-3">
                                    <Zap size={12} className="text-gold animate-pulse" />
                                    Apex Prime Signal
                                </h2>
                                <span className="text-[9px] font-data text-muted uppercase">Computed via TCN v3.2</span>
                             </div>
                             {topSignal && signals.find(s => s.ticker === topSignal.ticker) ? (
                                <HeroSignalCard 
                                    signal={signals.find(s => s.ticker === topSignal.ticker)}
                                    onClick={() => nav(`/swing?ticker=${topSignal.ticker}`)}
                                />
                             ) : (
                                <div className="h-48 glass rounded-3xl border border-white/10 flex flex-col items-center justify-center gap-4 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                                    <Zap size={24} className="text-slate-600 animate-pulse" />
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="font-data text-[10px] text-slate-500 uppercase tracking-[0.5em] animate-pulse">Neural Genesis in Progress</span>
                                        <div className="h-1 w-32 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-cyan/40 animate-conf-fill" style={{ width: '45%' }} />
                                        </div>
                                    </div>
                                </div>
                             )}
                        </div>

                        {/* 3. Market Heatmap */}
                        <HeatMapStrip />

                        {/* 4. High Confidence Satellite Signals */}
                        <div className="flex flex-col gap-4 mt-2">
                            <div className="flex justify-between items-center px-2">
                                <h2 className="font-display font-bold text-white text-[10px] tracking-[0.3em] uppercase">
                                    Secondary Directives
                                </h2>
                                <button onClick={() => nav('/screener')} className="font-data text-[9px] text-cyan hover:glow-cyan transition-all flex items-center gap-2 group uppercase">
                                    Full Strategic Screener <ArrowRight size={10} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {gridSignals.map((sig, i) => (
                                    <div
                                        key={i}
                                        onClick={() => nav(`/swing?ticker=${sig.ticker}`)}
                                        className={`group bg-surface/40 hover:bg-surface/60 border border-white/5 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1 ${sig.action === 'BUY' ? 'glow-border-buy' : 'glow-border-sell'}`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <span className="font-display font-black text-xl text-white tracking-widest truncate">{sig.ticker.split('.')[0]}</span>
                                            <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${sig.action === 'BUY' ? 'bg-emerald text-void' : 'bg-rose text-white'}`}>
                                                {sig.action}
                                            </div>
                                        </div>
                                        <div className="h-10 w-full mb-4 opacity-30">
                                            <MiniSparkline data={sig.sparkline} color={sig.action === 'BUY' ? 'stroke-emerald' : 'stroke-rose'} />
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-data text-muted uppercase">Confidence</span>
                                                <span className={`text-base font-display font-black ${sig.action === 'BUY' ? 'text-emerald' : 'text-rose'}`}>
                                                    {((sig.confidence || 0) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[8px] font-data text-muted uppercase">Current</span>
                                                <span className="text-sm font-display font-bold text-white block">₹{(sig.current_price || sig.price || 0).toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Portfolio & Monitoring (COL 4) */}
                    <div className="lg:col-span-4 flex flex-col gap-8">
                        {/* 5. Portfolio Snapshot */}
                        <PortfolioSnapshot />

                        {/* 6. Tactical Logs */}
                        <div className="flex flex-col gap-4">
                            <h2 className="font-display font-black text-white text-[10px] tracking-[0.3em] uppercase flex items-center gap-3 px-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span>
                                </span>
                                Tactical Activity
                            </h2>
                            <LiveSystemLogs />
                        </div>
                        
                        {/* Market Status Summary */}
                        <MarketRegimeBanner />
                    </div>
                </div>
            </div>
        </div>
    );
};
