import React from 'react';
import { Activity, Globe, Zap, Clock } from 'lucide-react';

export const TopMetricsBar: React.FC<{ stats?: any, pulse?: any }> = ({ stats, pulse }) => {
    const nifty = pulse?.nifty || { price: 23195.7, change_pct: -0.01 };
    const vix = pulse?.vix || { price: 21.91, color: 'red' };
    const flow = pulse?.fii_flow || { net_cr: 907, bias: 'Bullish' };

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-10 pt-4">
            {/* Market Index */}
            <div className="neon-frame p-4 rounded-2xl flex flex-col gap-2 group cursor-pointer hover:glow-border-cyan transition-all duration-500">
                <span className="neon-label flex items-center gap-2">
                   <Globe size={10} className="text-cyan" /> Market Index
                </span>
                <div className="flex items-end justify-between">
                    <div className="flex flex-col">
                        <span className="text-xl font-display font-black text-white tabular-nums tracking-tight">
                            {nifty.price.toLocaleString('en-IN')}
                        </span>
                        <span className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 ${nifty.change_pct >= 0 ? 'text-emerald' : 'text-rose'}`}>
                            {nifty.change_pct >= 0 ? '▲' : '▼'} {Math.abs(nifty.change_pct).toFixed(2)}%
                        </span>
                    </div>
                    <div className="h-8 w-16 opacity-40">
                        <svg viewBox="0 0 100 40" className={`w-full h-full fill-none stroke-[3] ${nifty.change_pct >= 0 ? 'stroke-emerald' : 'stroke-rose'}`}>
                            <path d={nifty.sparkline?.map((v: any, i: number) => `${i === 0 ? 'M' : 'L'}${i * (100/30)},${40 - (v * 30)}`).join(' ') || "M0,20 L100,5"} />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Volatility */}
            <div className={`neon-frame p-4 rounded-2xl flex flex-col gap-2 group cursor-pointer transition-all duration-500 ${
                vix.color === 'red' ? 'hover:glow-border-red' : vix.color === 'yellow' ? 'hover:glow-border-gold' : 'hover:glow-border-emerald'
            }`}>
                <span className="neon-label flex items-center gap-2">
                   <Activity size={10} className={vix.color === 'red' ? 'text-rose' : vix.color === 'yellow' ? 'text-gold' : 'text-emerald'} /> Volatility
                </span>
                <div className="flex items-center justify-between">
                    <span className={`text-xl font-display font-black tabular-nums tracking-tight ${
                        vix.color === 'red' ? 'text-rose' : vix.color === 'yellow' ? 'text-gold' : 'text-emerald'
                    }`}>{vix.price}</span>
                    <span className={`px-2 py-0.5 border rounded text-[8px] font-bold uppercase ${
                        vix.color === 'red' ? 'bg-rose/10 border-rose/20 text-rose' : 
                        vix.color === 'yellow' ? 'bg-gold/10 border-gold/20 text-gold' : 
                        'bg-emerald/10 border-emerald/20 text-emerald'
                    }`}>{vix.color === 'red' ? 'High' : vix.color === 'yellow' ? 'Elevated' : 'Stable'}</span>
                </div>
            </div>

            {/* Institutional Flow */}
            <div className="neon-frame p-4 rounded-2xl flex flex-col gap-2 group cursor-pointer hover:glow-border-emerald transition-all duration-500">
                <span className="neon-label flex items-center gap-2">
                   <Zap size={10} className="text-emerald" /> Institutional Flow
                </span>
                <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl font-display font-black text-white tracking-tight">₹{Math.abs(flow.net_cr)}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">CR</span>
                    </div>
                    <span className={`px-2 py-0.5 border rounded text-[8px] font-bold uppercase glow-emerald ${
                        flow.bias === 'Bullish' ? 'bg-emerald/10 border-emerald/20 text-emerald' : 'bg-rose/10 border-rose/20 text-rose'
                    }`}>{flow.bias}</span>
                </div>
            </div>

            {/* Session Active */}
            <div className="neon-frame p-4 rounded-2xl flex flex-col gap-2 group cursor-pointer hover:glow-border-cyan transition-all duration-500">
                <span className="neon-label flex items-center gap-2">
                   <Clock size={10} className="text-cyan" /> {pulse?.status === 'LIVE' ? 'Session Active' : 'Market Closed'}
                </span>
                <div className="flex items-center justify-between">
                    <span className="text-xl font-display font-black text-cyan tabular-nums tracking-tight">
                        {pulse?.status === 'LIVE' ? 'ACTIVE' : 'Next: 09:15'}
                    </span>
                    <div className="flex h-2 w-2 relative">
                        {pulse?.status === 'LIVE' && <span className="animate-ping absolute h-full w-full rounded-full bg-cyan opacity-75"></span>}
                        <span className={`relative rounded-full h-2 w-2 shadow-[0_0_8px_rgba(0,210,255,0.8)] ${pulse?.status === 'LIVE' ? 'bg-cyan' : 'bg-slate-600'}`}></span>
                    </div>
                </div>
            </div>
        </div>
    );
};

