import React from 'react';
import { XAIReport } from '../../api/api';
import { Brain, Cpu, Info } from 'lucide-react';

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
    const maxImpact = topFeatures.length > 0 ? Math.max(...topFeatures.map(f => Math.abs(f.impact || 0))) : 0;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase font-body">Neural Drivers</h3>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                     <Brain className="w-3 h-3 text-indigo-400" />
                     <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">XAI ENGINE</span>
                </div>
            </div>

            <div className="flex flex-col gap-5">
                {topFeatures.map((feat, idx) => {
                    const isPositive = feat.impact >= 0;
                    const absImpact = Math.abs(feat.impact || 0);
                    const widthPct = maxImpact > 0 ? (absImpact / maxImpact) * 50 : 0;

                    return (
                        <div key={idx} className="flex flex-col gap-2 w-full group">
                            <div className="flex justify-between items-center w-full">
                                <span className="font-body text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{feat.feature}</span>
                                <span className={`font-mono text-xs font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {isPositive ? '+' : ''}{((feat.impact || 0) * 100).toFixed(1)}%
                                </span>
                            </div>

                            {/* Diverging Bar Chart */}
                            <div className="w-full h-1.5 bg-white/[0.03] rounded-full relative flex items-center border border-white/5 overflow-hidden">
                                {/* Center line */}
                                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10 z-10" />

                                {/* Bar */}
                                <div
                                    className={`absolute h-full top-0 transition-all duration-1000 ease-conf-ease ${isPositive ? 'bg-emerald-500/80 shadow-[0_0_10px_rgba(52,211,153,0.3)] left-1/2' : 'bg-rose-500/80 shadow-[0_0_10px_rgba(251,113,133,0.3)] right-1/2'}`}
                                    style={{ width: `${widthPct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-2 p-4 glass-card border-indigo-500/20 bg-indigo-500/5 relative group overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50" />
                <div className="flex gap-3 items-start">
                    <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <p className="text-slate-400 font-medium font-body text-xs leading-relaxed italic">
                        {explanation}
                    </p>
                </div>
            </div>
        </div>
    );
};
