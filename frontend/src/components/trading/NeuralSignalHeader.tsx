import React from 'react';
import { TrendingUp, TrendingDown, Target, Zap, Activity } from 'lucide-react';
import { SignalResponse } from '../../api/api';

interface NeuralSignalHeaderProps {
    data: SignalResponse | null;
    mode: 'swing' | 'intraday';
}

export const NeuralSignalHeader: React.FC<NeuralSignalHeaderProps> = ({ data, mode }) => {
    if (!data) return null;

    const isBuy = data.action === 'BUY';
    const isSell = data.action === 'SELL';
    const isHold = data.action === 'HOLD';

    const stateColor = isBuy ? 'text-emerald-400' : isSell ? 'text-rose-400' : 'text-amber-400';
    const stateBg = isBuy ? 'bg-emerald-500' : isSell ? 'bg-rose-500' : 'bg-amber-500';
    const stateBorder = isBuy ? 'border-emerald-500/30' : isSell ? 'border-rose-500/30' : 'border-amber-500/30';
    const stateGlow = isBuy ? 'shadow-[0_0_30px_rgba(16,185,129,0.2)]' : isSell ? 'shadow-[0_0_30px_rgba(244,63,94,0.2)]' : 'shadow-[0_0_30px_rgba(245,158,11,0.2)]';

    return (
        <div className={`w-full glass-card p-8 rounded-[2rem] border ${stateBorder} ${stateGlow} transition-all duration-700 animate-in slide-in-from-top-4`}>
            <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                {/* Left Side: Decision */}
                <div className="flex items-center gap-6">
                    <div className={`w-1.5 h-24 rounded-full ${stateBg} hidden sm:block`} />
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                            <Activity size={14} className="text-muted" />
                            <span className="text-[10px] font-black text-muted tracking-[0.4em] uppercase">Neural Deployment • {mode}</span>
                        </div>
                        <h2 className={`text-8xl font-display font-black tracking-tighter leading-none uppercase ${stateColor} italic`}>
                            {data.action}
                        </h2>
                        <div className="flex items-center gap-3 mt-3">
                            <div className={`px-4 py-1.5 rounded-full ${stateBg}/10 border ${stateBorder} flex items-center gap-2`}>
                                <Zap size={12} className={stateColor} />
                                <span className={`text-[11px] font-black tracking-widest uppercase ${stateColor}`}>
                                    {Math.round(data.confidence * 100)}% Confidence
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Key Prices */}
                <div className="flex flex-col sm:flex-row items-center gap-12 text-center sm:text-left">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted tracking-[0.2em] uppercase mb-1 font-body">Current Price</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-4xl font-display font-bold text-white tracking-tight">
                                ₹{data.current_price.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                            </span>
                        </div>
                    </div>

                    <div className="hidden sm:block w-px h-12 bg-white/5" />

                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start">
                            <Target size={12} className="text-indigo-400" />
                            <span className="text-[10px] font-bold text-indigo-400 tracking-[0.2em] uppercase font-body">Neural Target</span>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-5xl font-display font-black text-white tracking-tight glow-blue">
                                ₹{Math.round(data.p50 || 0).toLocaleString('en-IN')}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Insight */}
            <div className="mt-8 pt-6 border-t border-dim flex items-center justify-center sm:justify-start gap-3">
                <div className={`w-2 h-2 rounded-full ${stateBg} animate-pulse`} />
                <p className="text-[13px] font-medium text-secondary italic">
                    {isBuy ? "Bullish geometric alignment detected. Support structure holding firm." : 
                     isSell ? "Bearish pressure mounting. Distribution patterns confirmed by neural gates." : 
                     "Neutral zone. Waiting for volume breakout or pattern completion."}
                </p>
            </div>
        </div>
    );
};
