import React, { useEffect, useState } from 'react';
import { SignalResponse, Action as SignalAction } from '../../api/api';
import { CheckCircle2, XCircle, Info, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

interface SignalCardProps {
    data: SignalResponse | null;
    isLoading: boolean;
    timeframe: string;
}

const getSignalColor = (action: SignalAction): string => {
    if (action === "BUY")  return "#00ff88";
    if (action === "SELL") return "#ff4b4b";
    return "#888888"; 
};

export const SignalCard: React.FC<SignalCardProps> = ({ data, isLoading, timeframe }) => {
    const [fillWidth, setFillWidth] = useState(0);

    useEffect(() => {
        if (data && !isLoading) {
            setTimeout(() => setFillWidth(data.confidence * 100), 50);
        } else {
            setFillWidth(0);
        }
    }, [data, isLoading]);

    if (isLoading || !data) {
        return (
            <div className="relative w-full rounded-xl border border-dim bg-surface p-6 overflow-hidden flex flex-col items-center justify-center min-h-[280px]">
                <div className="absolute inset-0 shimmer opacity-20" />
                <div className="flex flex-col items-center gap-4 z-10">
                    <div className="w-12 h-12 border-2 border-t-cyan border-r-cyan border-b-transparent border-l-transparent rounded-full animate-spin" />
                    <span className="font-data text-cyan tracking-widest text-sm animate-pulse">NEURAL ENGINE CALIBRATING...</span>
                </div>
            </div>
        );
    }

    const isBuy = data.action === 'BUY';
    const isSell = data.action === 'SELL';

    const stateColor = isBuy ? 'text-emerald-400' : isSell ? 'text-rose-400' : 'text-amber-400';
    const stateBg = isBuy ? 'bg-emerald-500' : isSell ? 'bg-rose-500' : 'bg-amber-500';
    const stateBorder = isBuy ? 'border-emerald-500/30' : isSell ? 'border-rose-500/30' : 'border-amber-500/30';
    
    // Fallback for missing fields in API
    const sentiment = data.sentiment_score ?? 0;
    const priceColor = sentiment >= 0 ? 'text-emerald-400' : 'text-rose-400';
    const PriceIcon = sentiment >= 0 ? TrendingUp : TrendingDown;

    return (
        <div className={`relative w-full glass-card overflow-hidden flex flex-col transition-all duration-500 border-t-2 ${stateBorder} shadow-2xl`}>
            {/* Header Glow */}
            <div className={`absolute top-0 inset-x-0 h-16 opacity-10 blur-3xl -z-10 ${stateBg}`} />
            {/* Watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-[80px] font-black text-white opacity-[0.03] -rotate-15 pointer-events-none select-none whitespace-nowrap">
                NEURAL SIGNAL
            </div>

            <div className="relative z-10">
                {/* Header Row */}
                <div className="flex justify-between items-start p-6 pb-5 border-b border-white/[0.05]">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="font-display font-bold text-2xl tracking-tight text-white">{data.ticker}</h2>
                            <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${stateBg} text-void`}>
                                Neural v3.0
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-xl text-slate-200 font-bold tracking-tight">₹{data.current_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            <div className={`flex items-center gap-1 font-mono text-[11px] font-bold ${priceColor} bg-white/5 px-2 py-1 rounded-lg border border-white/5`}>
                                <PriceIcon className="w-3 h-3" />
                                {Math.abs(sentiment * 100).toFixed(2)}%
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        <div className="px-3 py-1.5 bg-white/[0.03] border border-white/[0.1] rounded-xl flex items-center gap-2">
                             <Activity className="w-3.5 h-3.5 text-indigo-400" />
                             <span className="font-body text-[10px] text-slate-400 font-bold tracking-widest uppercase">Stream: <span className="text-white">{timeframe}</span></span>
                        </div>
                    </div>
                </div>

                {/* Action & Confidence Area */}
                <div className="px-6 py-8 flex flex-col md:flex-row items-center gap-8 justify-between">
                    <div className="flex items-center gap-6">
                        <div className={`w-1 h-20 rounded-full ${stateBg} shadow-[0_0_20px_rgba(255,255,255,0.1)]`} />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-500 tracking-[0.3em] uppercase mb-1">Recommended Action</span>
                            <span className={`font-display font-black text-6xl tracking-tighter leading-none uppercase ${stateColor} italic`}>
                                {data?.action || 'HOLD'}
                            </span>
                        </div>
                    </div>

                    <div className="w-full md:w-[280px] flex flex-col gap-3">
                        <div className="flex justify-between items-end">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">Inference Confidence</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="font-display text-3xl font-bold text-white tracking-tighter">{Math.round(data.confidence * 100)}</span>
                                    <span className="text-xs font-bold text-slate-500">%</span>
                                </div>
                            </div>
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${isBuy ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 'text-rose-400 border-rose-500/20 bg-rose-500/5'}`}>
                                {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                RET: {(data?.expected_return ?? 0).toFixed(2)}%
                            </div>
                        </div>
                        <div className="h-2 w-full bg-void rounded-full overflow-hidden border border-white/5 relative shadow-inner">
                            <div
                                className={`h-full ${stateBg} bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%] animate-shimmer shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all ease-out duration-1000 relative z-10`}
                                style={{ width: `${fillWidth}%` }}
                            />
                            <div className="absolute inset-0 bg-white/5" />
                        </div>
                    </div>
                </div>

                {/* Price Targets Row */}
                <div className="grid grid-cols-3 divide-x divide-white/5 border-t border-b border-white/5 bg-white/[0.01]">
                    <div className="p-6 text-center flex flex-col gap-2 group hover:bg-white/[0.02] transition-colors cursor-default">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] font-body">Bear (P10)</span>
                        <span className="font-mono text-xl text-slate-300 group-hover:text-white transition-colors">₹{Math.round(data?.p10 || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="p-6 text-center flex flex-col gap-2 group hover:bg-white/[0.02] transition-colors cursor-default border-x border-white/5">
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-[0.2em] font-body">Base (P50)</span>
                        <span className="font-mono text-2xl text-white font-bold">₹{Math.round(data?.p50 || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="p-6 text-center flex flex-col gap-2 group hover:bg-white/[0.02] transition-colors cursor-default">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] font-body">Bull (P90)</span>
                        <span className="font-mono text-xl text-slate-300 group-hover:text-white transition-colors">₹{Math.round(data?.p90 || 0).toLocaleString('en-IN')}</span>
                    </div>
                </div>

                {/* Reasoning Row — Plain English explanation from backend */}
                <div className="p-5 bg-black/20 border-t border-white/5">
                    <div className="flex gap-3 items-start">
                        <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                        <p className="font-body text-xs text-slate-300 leading-relaxed italic">
                            {data.reason || "Analyzing neural gates and market confluence..."}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
