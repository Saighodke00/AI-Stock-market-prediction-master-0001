import React from 'react';
import { SentimentData } from '../../api/api';

interface SentimentPanelProps {
    data: SentimentData | null;
    gatePassed: boolean;
    isActionBuy?: boolean;
}

export const SentimentPanel: React.FC<SentimentPanelProps> = ({ data, gatePassed, isActionBuy }) => {
    if (!data) return null;

    const score = data.aggregate_score;
    const isBullish = score > 0.1;
    const isBearish = score < -0.1;
    const label = isBullish ? 'BULLISH' : isBearish ? 'BEARISH' : 'NEUTRAL';
    const colorText = isBullish ? 'text-green' : isBearish ? 'text-red' : 'text-gold';

    // Custom Gate 3 wording Based on provided spec
    const gateText = gatePassed
        ? `✅ GATE 3 PASSED — sentiment aligned with signal`
        : `🚫 GATE 3 BLOCKED — sentiment overrides ${isActionBuy ? 'BUY' : 'SELL'} → HOLD`;
    const gateBg = gatePassed ? 'bg-green-dim border-green/20' : 'bg-red-dim border-red/20';

    return (
        <div className="flex flex-col gap-4 mt-8">
            <h3 className="font-data text-[9px] text-cyan tracking-[0.3em] uppercase">// MARKET SENTIMENT</h3>

            {/* Aggregate Score */}
            <div className="flex flex-col gap-1 items-start">
                <span className={`font-display font-bold text-4xl ${colorText}`}>
                    {(score ?? 0) > 0 ? '+' : ''}{(score ?? 0).toFixed(2)}
                </span>
                <span className={`font-display font-semibold text-sm tracking-wider ${colorText}`}>
                    {label}
                </span>
            </div>

            {/* Gate Status */}
            <div className={`mt-2 px-3 py-2 rounded shadow-sm border ${gateBg}`}>
                <p className="font-body text-[13px] text-primary font-medium tracking-wide">
                    {gateText}
                </p>
            </div>

            {/* News Feed */}
            <div className="flex flex-col gap-3 mt-4">
                {(() => {
                    const safeArray = <T,>(val: unknown): T[] => Array.isArray(val) ? (val as T[]) : [];
                    return safeArray<{ headline: string; score: number; source: string; time: string; }>(data?.news).slice(0, 4).map((item, i) => {
                        const itemBullish = (item?.score ?? 0) > 0.1;
                        const itemBearish = (item?.score ?? 0) < -0.1;
                        const borderColor = itemBullish ? 'border-l-green' : itemBearish ? 'border-l-red' : 'border-l-gold';
                        const badgeBg = itemBullish ? 'bg-green-dim text-green' : itemBearish ? 'bg-red-dim text-red' : 'bg-gold-dim text-gold';
                        const displayScore = ((item?.score ?? 0) > 0 ? '+' : '') + (item?.score ?? 0).toFixed(2);

                        return (
                            <div key={i} className={`flex flex-col gap-1 p-2 pl-3 border-l-2 ${borderColor} hover:bg-raised transition-colors group rounded-r cursor-pointer`}>
                                <div className="flex justify-between items-start gap-2">
                                    <p className="font-body text-[13px] text-primary leading-tight line-clamp-2 pr-6">
                                        {item.headline}
                                    </p>
                                    <div className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-data font-bold ${badgeBg}`}>
                                        {displayScore}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-[11px] text-muted font-body mt-1">
                                    <span>{item.source}</span>
                                    <span>{item.time}</span>
                                </div>
                            </div>
                        );
                    });
                })()}
            </div>
        </div>
    );
};
