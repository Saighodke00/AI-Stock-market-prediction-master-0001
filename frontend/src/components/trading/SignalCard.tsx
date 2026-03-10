import React, { useEffect, useState } from 'react';
import { SignalResponse } from '../../api/api';

interface SignalCardProps {
    data: SignalResponse | null;
    isLoading: boolean;
    timeframe: string;
}

const GatePill: React.FC<{ name: string, passed: boolean, reason: string }> = ({ name, passed, reason }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const Icon = passed ? '✅' : '❌';
    return (
        <div
            className="relative flex items-center gap-1.5 px-3 py-1 bg-void border border-dim rounded-full cursor-help"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <span className="text-[10px]">{Icon}</span>
            <span className="font-body text-xs font-semibold text-primary">{name}</span>

            {showTooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-overlay border border-dim rounded shadow-xl z-10 animate-fade-in pointer-events-none">
                    <p className="font-body text-xs text-secondary leading-tight">{reason}</p>
                </div>
            )}
        </div>
    );
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

    const stateColor = isBuy ? 'text-green' : isSell ? 'text-red' : 'text-gold';
    const stateBorder = isBuy ? 'border-l-[3px] border-green' : isSell ? 'border-l-[3px] border-red' : 'border-l-[3px] border-gold';
    const stateGlow = isBuy ? 'glow-green' : isSell ? 'glow-red' : '';
    const priceColor = data.price_change_pct >= 0 ? 'text-green' : 'text-red';
    const priceSymbol = data.price_change_pct >= 0 ? '▲' : '▼';

    return (
        <div className={`relative w-full rounded-xl border border-mid bg-surface overflow-hidden ${stateBorder} flex flex-col animate-signal-reveal shadow-lg`}>
            {/* Watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-[80px] font-black text-white opacity-[0.03] -rotate-15 pointer-events-none select-none whitespace-nowrap">
                NEURAL SIGNAL
            </div>

            <div className="relative z-10">
                {/* Header Row */}
                <div className="flex justify-between items-start p-5 pb-4 border-b border-dim/50">
                    <div>
                        <h2 className={`font-display font-bold text-2xl tracking-wider text-primary ${stateGlow}`}>{data.ticker}</h2>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="font-data text-xl text-primary font-bold">₹{data?.current_price?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) ?? '—'}</span>
                            <span className={`font-data text-sm ${priceColor}`}>{priceSymbol} {(data?.price_change_pct ?? 0).toFixed(2)}%</span>
                        </div>
                    </div>
                    <div className="px-3 py-1 bg-void border border-dim rounded">
                        <span className="font-data text-[10px] text-muted tracking-widest">TIMEFRAME: <span className="text-cyan">{timeframe}</span></span>
                    </div>
                </div>

                {/* Action & Confidence Area */}
                <div className="p-6 flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                        <div className={`w-3 h-16 ${isBuy ? 'bg-green' : isSell ? 'bg-red' : 'bg-gold'}`} />
                        <div className="flex-1 flex justify-between items-end">
                            <span className={`font-display font-black text-[48px] tracking-[0.2em] leading-none uppercase ${stateColor} ${stateGlow} drop-shadow-[0_0_15px_rgba(var(--state-rgb),0.5)]`}>
                                {data.action}
                            </span>

                            <div className="w-1/2 flex flex-col gap-2">
                                <div className="flex justify-between items-baseline">
                                    <span className="font-data text-[10px] text-secondary tracking-widest uppercase">Confidence</span>
                                    <span className="font-data text-lg text-primary">{Math.round(data.confidence * 100)}%</span>
                                </div>
                                <div className="h-2 w-full bg-void rounded-full overflow-hidden border border-dim">
                                    <div
                                        className={`h-full ${isBuy ? 'bg-green' : isSell ? 'bg-red' : 'bg-gold'} transition-all ease-conf-ease duration-700`}
                                        style={{ width: `${fillWidth}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 font-body text-secondary text-sm">
                        <span className="text-muted">Expected Return:</span>
                        <span className={`font-data ${isBuy ? 'text-green' : 'text-red'}`}>
                            {(data?.expected_return ?? 0) > 0 ? '+' : ''}{(data?.expected_return ?? 0).toFixed(2)}%
                        </span>
                        <span className="text-muted text-xs italic ml-2">({data?.explanation || 'Neural explanation unavailable.'})</span>
                    </div>
                </div>

                {/* Price Targets Row */}
                <div className="grid grid-cols-3 divide-x divide-dim border-t border-b border-dim bg-void/50">
                    <div className="p-3 text-center flex flex-col gap-1 hover:bg-raised transition-colors cursor-default">
                        <span className="font-data text-[10px] text-red uppercase tracking-widest">P10 Target (Bear)</span>
                        <span className="font-data text-lg text-primary">₹{Math.round(data?.p10 ?? 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="p-3 text-center flex flex-col gap-1 hover:bg-raised transition-colors cursor-default">
                        <span className="font-data text-[10px] text-cyan uppercase tracking-widest">P50 Target (Base)</span>
                        <span className="font-data text-lg text-primary font-bold">₹{Math.round(data?.p50 ?? 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="p-3 text-center flex flex-col gap-1 hover:bg-raised transition-colors cursor-default">
                        <span className="font-data text-[10px] text-green uppercase tracking-widest">P90 Target (Bull)</span>
                        <span className="font-data text-lg text-primary">₹{Math.round(data?.p90 ?? 0).toLocaleString('en-IN')}</span>
                    </div>
                </div>

                {/* Gates Row */}
                <div className="p-4 flex items-center justify-between bg-void/30">
                    <div className="flex items-center gap-3 w-full">
                        <GatePill name="GATE 1" passed={data?.gate_results?.gate1_attention ?? false} reason="Volume Profile & Trend Attention" />
                        <GatePill name="GATE 2" passed={data?.gate_results?.gate2_cone ?? false} reason="Forecast Architecture Verification" />
                        <GatePill name="GATE 3" passed={data?.gate_results?.gate3_sentiment ?? false} reason="Global News & Sentiment Bias" />
                        <GatePill name="GATE 4" passed={data?.gate_results?.gate4_pattern ?? false} reason="Technical Geometry Match" />
                    </div>
                </div>
            </div>
        </div>
    );
};
