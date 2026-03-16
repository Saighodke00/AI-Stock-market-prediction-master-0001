import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';
import { MiniSparkline } from '../trading/MiniSparkline';

export const MarketPulseBar: React.FC = () => {
    const [data, setData] = useState<any>(null);

    const [prevPrice, setPrevPrice] = useState<number>(0);
    const [flash, setFlash] = useState<string>('');

    useEffect(() => {
        const fetchPulse = () => {
            fetch('http://localhost:8000/api/market-pulse')
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

    if (!data || !data.nifty) return <div className="h-10 bg-surface/50 animate-pulse rounded-full mx-6 mt-4 flex items-center justify-center text-[10px] text-secondary tracking-widest uppercase font-data">System Initializing / Market Offline</div>;

    const isPositive = data.nifty.change_pct >= 0;
    const isLive = data.status === 'LIVE';
    const statusColor = isLive ? 'text-emerald' : 'text-rose';

    return (
        <div className={`mx-6 mt-4 bg-void/40 backdrop-blur-md border border-white/5 rounded-full px-6 py-2 flex items-center justify-between gap-8 overflow-hidden shadow-2xl transition-all ${flash}`}>
            {/* NIFTY 50 */}
            <div className="flex items-center gap-4 shrink-0">
                <div className="flex flex-col">
                    <span className="text-[10px] font-data text-secondary uppercase tracking-[0.2em]">NIFTY 50</span>
                    <div className="flex items-center gap-2">
                        <span className="font-display font-black text-white uppercase tracking-tighter text-lg">
                            {(data.nifty.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                        </span>
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black ${isPositive ? 'bg-emerald/10 text-emerald' : 'bg-rose/10 text-rose'}`}>
                            {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            {Math.abs(data.nifty.change_pct).toFixed(2)}%
                        </div>
                    </div>
                </div>
                <div className="w-20 h-8 opacity-40">
                    <MiniSparkline 
                        data={data.nifty.sparkline} 
                        color={isPositive ? 'stroke-emerald' : 'stroke-rose'} 
                    />
                </div>
            </div>

            <div className="h-6 w-px bg-white/10 hidden md:block" />

            {/* INDIA VIX */}
            <div className="flex flex-col items-center hidden md:flex">
                <span className="text-[10px] font-data text-secondary uppercase tracking-[0.2em]">VIX (FEAR)</span>
                <span className={`font-display font-black uppercase tracking-tighter text-base ${data.vix.color === 'red' ? 'text-rose animate-pulse' : data.vix.color === 'yellow' ? 'text-amber' : 'text-emerald'}`}>
                    {(data.vix.price || 0).toFixed(2)}
                </span>
            </div>

            <div className="h-6 w-px bg-white/10 hidden lg:block" />

            {/* FII FLOW */}
            <div className="flex flex-col items-center hidden lg:flex">
                <span className="text-[10px] font-data text-secondary uppercase tracking-[0.2em]">FII FLOW</span>
                <div className="flex items-center gap-2">
                    <span className={`font-display font-bold uppercase tracking-tighter text-sm ${data.fii_flow.fii_net >= 0 ? 'text-emerald' : 'text-rose'}`}>
                        {data.fii_flow.fii_net >= 0 ? '▲' : '▼'} ₹{Math.abs(data.fii_flow.fii_net || 0).toLocaleString('en-IN')} Cr
                    </span>
                    <span className={`text-[8px] font-black px-1 rounded border ${data.fii_flow.sentiment === 'BULLISH' ? 'border-emerald/40 text-emerald' : 'border-rose/40 text-rose'}`}>
                        {data.fii_flow.sentiment}
                    </span>
                </div>
            </div>

            <div className="h-6 w-px bg-white/10 hidden sm:block" />

            {/* MARKET STATUS & COUNTDOWN */}
            <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-data text-secondary uppercase tracking-[0.2em]">{isLive ? 'CLOSES IN' : 'NEXT SESSION'}</span>
                    <span className={`font-display font-black text-xs tracking-widest uppercase ${statusColor}`}>
                        {isLive ? '2H 15M' : '09:15 IST'}
                    </span>
                </div>
                <div className="relative flex h-3 w-3">
                    <div className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isLive ? 'bg-emerald animate-ping' : 'bg-rose'}`} />
                    <div className={`relative inline-flex rounded-full h-3 w-3 ${isLive ? 'bg-emerald' : 'bg-rose'}`} />
                </div>
            </div>
        </div>
    );
};
