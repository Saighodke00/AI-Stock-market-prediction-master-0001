import React from 'react';
import { SentimentData } from '../../api/api';
import { Globe, CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';

interface SentimentPanelProps {
    data: SentimentData | null;
    gatePassed: boolean;
    isActionBuy?: boolean;
}

export const SentimentPanel: React.FC<SentimentPanelProps> = ({ data, gatePassed, isActionBuy }) => {
    if (!data) return null;

    const score = data.aggregate_score ?? data.score ?? 0;
    const isBullish = score > 0.1;
    const isBearish = score < -0.1;
    const label = isBullish ? 'Bullish' : isBearish ? 'Bearish' : 'Neutral';
    const colorText = isBullish ? 'text-emerald-400' : isBearish ? 'text-rose-400' : 'text-amber-400';
    const bgColor = isBullish ? 'bg-emerald-500/10' : isBearish ? 'bg-rose-500/10' : 'bg-amber-500/10';

    const gateText = gatePassed
        ? `GATE 3 PASSED — sentiment aligned with signal`
        : `GATE 3 BLOCKED — sentiment overrides ${isActionBuy ? 'BUY' : 'SELL'} → HOLD`;
    const GateIcon = gatePassed ? CheckCircle2 : XCircle;
    const gateColor = gatePassed ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 'text-rose-400 border-rose-500/20 bg-rose-500/5';

    return (
        <div className="flex flex-col gap-6 mt-4">
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-muted tracking-[0.2em] uppercase font-body">Market Sentiment</h3>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                     <Globe className="w-3 h-3 text-indigo-400" />
                     <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">GLOBAL NLP</span>
                </div>
            </div>

            {/* Aggregate Score */}
            <div className="flex flex-col gap-1 items-start px-1">
                <span className={`font-display font-black text-5xl tracking-tighter ${colorText}`}>
                    {score > 0 ? '+' : ''}{score.toFixed(2)}
                </span>
                <span className={`font-body font-bold text-sm tracking-wide ${colorText} uppercase`}>
                    {label} Analysis
                </span>
            </div>

            {/* Gate Status */}
            <div className={`p-4 glass-card border transition-all duration-500 ${gateColor}`}>
                <div className="flex gap-3 items-center">
                    <GateIcon className="w-5 h-5 flex-shrink-0" />
                    <p className="font-body text-[11px] font-bold tracking-tight uppercase leading-relaxed">
                        {gateText}
                    </p>
                </div>
            </div>

            {/* News Feed */}
            <div className="flex flex-col gap-3 mt-2">
                {(() => {
                    const safeArray = <T,>(val: unknown): T[] => Array.isArray(val) ? (val as T[]) : [];
                    return safeArray<{ title: string; score: number; published: string; }>(data?.articles).slice(0, 4).map((item, i) => {
                        const itemBullish = (item?.score ?? 0) > 0.1;
                        const itemBearish = (item?.score ?? 0) < -0.1;
                        const borderColor = itemBullish ? 'bg-emerald-500/50' : itemBearish ? 'bg-rose-500/50' : 'bg-amber-500/50';
                        const badgeColor = itemBullish ? 'text-emerald-400 bg-emerald-500/5' : itemBearish ? 'text-rose-400 bg-rose-500/5' : 'text-amber-400 bg-amber-500/5';
                        const displayScore = ((item?.score ?? 0) > 0 ? '+' : '') + (item?.score ?? 0).toFixed(1);

                        return (
                            <div key={i} className="glass-card hover:bg-white/[0.04] p-3.5 group transition-all duration-300 relative overflow-hidden">
                                <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${borderColor}`} />
                                <div className="flex justify-between items-start gap-4">
                                    <p className="font-body text-xs text-secondary font-semibold leading-relaxed line-clamp-2 group-hover:text-white transition-colors">
                                        {item.title}
                                    </p>
                                    <div className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-mono font-bold border border-dim ${badgeColor}`}>
                                        {displayScore}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-muted font-bold tracking-wider uppercase font-body mt-3">
                                    <span className="flex items-center gap-1.5">
                                        <div className="w-1 h-1 rounded-full bg-white/10" />
                                        Neural V2
                                    </span>
                                    <span>{item.published ? new Date(item.published).toLocaleDateString('en-GB') : 'JUST NOW'}</span>
                                </div>
                            </div>
                        );
                    });
                })()}
            </div>
        </div>
    );
};
