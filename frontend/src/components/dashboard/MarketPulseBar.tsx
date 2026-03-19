import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';
import { MiniSparkline } from '../trading/MiniSparkline';

export const MarketPulseBar: React.FC = () => {
    const [data, setData] = useState<any>(null);

    const [prevPrice, setPrevPrice] = useState<number>(0);
    const [flash, setFlash] = useState<string>('');

    useEffect(() => {
        const fetchPulse = () => {
            fetch('/api/market-pulse')
                .then(res => res.json())
                .then(newData => {
                    if (data && newData.nifty && newData.nifty.price !== data.nifty.price) {
                        setFlash(newData.nifty.price > data.nifty.price ? 'animate-flash-green' : 'animate-flash-red');
                        setTimeout(() => setFlash(''), 1000);
                    }
                    setData(newData);
                })
                .catch(err => console.error("Pulse fetch error:", err));
        };

        fetchPulse();
        const interval = setInterval(fetchPulse, 30000);
        return () => clearInterval(interval);
    }, [data]);

    if (!data || (!data.nifty && data.status !== 'ERROR')) return <div className="h-10 bg-surface/50 animate-pulse rounded-full mx-6 mt-4 flex items-center justify-center text-[10px] text-secondary tracking-widest uppercase font-data">System Initializing / Market Offline</div>;
    
    if (data.status === 'ERROR') return <div className="h-10 bg-rose-500/10 border border-rose-500/20 rounded-full mx-6 mt-4 flex items-center justify-center text-[10px] text-rose-400 tracking-widest uppercase font-data">Market Engine Offline: {data.message}</div>;

    const isPositive = data.nifty.change_pct >= 0;
    const isLive = data.status === 'LIVE';
    const statusColor = isLive ? 'text-emerald' : 'text-rose';

    return (
        <div className={`mx-6 mt-8 bg-surface/60 backdrop-blur-2xl border border-white/[0.08] border-t-white/[0.15] rounded-3xl px-10 py-6 flex items-center justify-between gap-12 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-700 ${flash}`}>
            {/* NIFTY 50 */}
            <div className="flex items-center gap-8 shrink-0">
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-data text-slate-400 uppercase tracking-[0.4em] font-bold">Market Index</span>
                    <div className="flex items-center gap-4">
                        <span className="font-display font-black text-white uppercase tracking-tighter text-3xl">
                            {(data.nifty.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                        </span>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black ${isPositive ? 'bg-emerald/20 text-emerald shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-rose/20 text-rose shadow-[0_0_15px_rgba(244,63,94,0.2)]'}`}>
                            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {Math.abs(data.nifty.change_pct).toFixed(2)}%
                        </div>
                    </div>
                </div>
                <div className="w-28 h-12 opacity-80">
                    <MiniSparkline 
                        data={data.nifty.sparkline} 
                        color={isPositive ? 'stroke-emerald' : 'stroke-rose'} 
                    />
                </div>
            </div>

            <div className="h-12 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent hidden md:block" />

            {/* INDIA VIX */}
            <div className="flex flex-col items-center gap-1.5 hidden md:flex shrink-0">
                <span className="text-[10px] font-data text-slate-400 uppercase tracking-[0.4em] font-bold">Volatility</span>
                <span className={`font-display font-black uppercase tracking-tighter text-2xl ${data.vix.color === 'red' ? 'text-rose glow-rose' : data.vix.color === 'yellow' ? 'text-amber' : 'text-emerald'}`}>
                    {(data.vix.price || 0).toFixed(2)}
                </span>
            </div>

            <div className="h-12 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent hidden lg:block" />

            {/* FII FLOW */}
            <div className="flex flex-col items-center gap-1.5 hidden lg:flex shrink-0">
                <span className="text-[10px] font-data text-slate-400 uppercase tracking-[0.4em] font-bold">Institutional Flow</span>
                <div className="flex items-center gap-4">
                    <span className={`font-display font-black uppercase tracking-tighter text-lg ${data.fii_flow.fii_net >= 0 ? 'text-emerald' : 'text-rose'}`}>
                        {data.fii_flow.fii_net >= 0 ? '▲' : '▼'} ₹{Math.abs(data.fii_flow.fii_net || 0).toLocaleString('en-IN')} Cr
                    </span>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${data.fii_flow.sentiment === 'BULLISH' ? 'border-emerald/40 text-emerald bg-emerald/10' : 'border-rose/40 text-rose bg-rose/10'}`}>
                        {data.fii_flow.sentiment}
                    </span>
                </div>
            </div>

            <div className="h-12 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent hidden sm:block" />

            {/* MARKET STATUS & COUNTDOWN */}
            <div className="flex items-center gap-6 shrink-0 ml-auto">
                <div className="flex flex-col items-end gap-1.5">
                    <span className="text-[10px] font-data text-slate-400 uppercase tracking-[0.4em] font-bold">{isLive ? 'Session Active' : 'Next Session'}</span>
                    <span className={`font-display font-black text-base tracking-widest uppercase ${statusColor} opacity-100`}>
                        {isLive ? '2h 15m' : '09:15 IST'}
                    </span>
                </div>
                <div className="relative flex h-5 w-5">
                    <div className={`absolute inline-flex h-full w-full rounded-full opacity-50 ${isLive ? 'bg-emerald animate-ping' : 'bg-rose'}`} />
                    <div className={`relative inline-flex rounded-full h-5 w-5 shadow-[0_0_15px_rgba(0,0,0,0.5)] ${isLive ? 'bg-emerald shadow-emerald/50' : 'bg-rose shadow-rose/50'}`} />
                </div>
            </div>
        </div>
    );
};
