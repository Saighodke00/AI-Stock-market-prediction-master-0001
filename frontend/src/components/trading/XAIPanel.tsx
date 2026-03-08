import React from 'react';
import { XAIReport } from '../../api/api';

interface XAIPanelProps {
    report: XAIReport[];
    explanation: string;
}

const safeArray = <T,>(val: unknown): T[] => Array.isArray(val) ? (val as T[]) : [];

export const XAIPanel: React.FC<XAIPanelProps> = ({ report, explanation }) => {
    if (!report || report.length === 0) return null;

    // Max 6 features
    const topFeatures = safeArray<XAIReport>(report).slice(0, 6);
    // Find max absolute value to scale bars relative to the strongest feature
    const maxImpact = topFeatures.length > 0 ? Math.max(...topFeatures.map(f => Math.abs(f.importance || 0))) : 0;

    return (
        <div className="flex flex-col gap-4">
            <h3 className="font-data text-[9px] text-cyan tracking-[0.3em] uppercase">// SIGNAL DRIVERS</h3>

            <div className="flex flex-col gap-3">
                {topFeatures.map((feat, idx) => {
                    const isPositive = feat.importance >= 0;
                    const absImpact = Math.abs(feat.importance);
                    const widthPct = maxImpact > 0 ? (absImpact / maxImpact) * 50 : 0; // Max width is 50% from center

                    return (
                        <div key={idx} className="flex flex-col gap-1 w-full relative">
                            <div className="flex justify-between items-center z-10 w-full px-1">
                                <span className="font-body text-[14px] text-primary">{feat.feature}</span>
                                <span className={`font-data text-[11px] ${isPositive ? 'text-green' : 'text-red'}`}>
                                    {isPositive ? '+' : ''}{(feat.importance * 100).toFixed(1)}%
                                </span>
                            </div>

                            {/* Diverging Bar Chart */}
                            <div className="w-full h-1.5 bg-void border border-dim rounded-sm relative flex">
                                {/* Center line */}
                                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-dim z-0" />

                                {/* Bar */}
                                <div
                                    className={`absolute h-full top-0 ${isPositive ? 'bg-green glow-green left-1/2' : 'bg-red glow-red right-1/2'}`}
                                    style={{ width: `${widthPct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-2 pl-3 border-l-2 border-cyan text-secondary font-body text-[14px] leading-relaxed italic bg-cyan-dim/20 p-2 rounded-r">
                {explanation}
            </div>
        </div>
    );
};
