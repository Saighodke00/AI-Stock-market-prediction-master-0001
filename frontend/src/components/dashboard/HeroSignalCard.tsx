import React from 'react';
import { Target, TrendingUp, TrendingDown, Zap } from 'lucide-react';

interface HeroSignalCardProps {
    signal: any;
    onClick: () => void;
}

export const HeroSignalCard: React.FC<HeroSignalCardProps> = ({ signal, onClick }) => {
    if (!signal) return null;

    const isBuy = signal.action === 'BUY';
    const color = isBuy ? 'text-emerald' : 'text-rose';
    const bg = isBuy ? 'bg-emerald/10' : 'bg-rose/10';
    const glow = isBuy ? 'shadow-[0_0_50px_rgba(16,185,129,0.15)]' : 'shadow-[0_0_50px_rgba(244,63,94,0.15)]';

    return (
        <div 
            onClick={onClick}
            className={`relative overflow-hidden bg-surface/60 backdrop-blur-xl border border-mid rounded-3xl p-8 cursor-pointer group transition-all duration-500 hover:scale-[1.02] hover:border-bright ${glow}`}
        >
            <div className={`absolute -right-20 -top-20 w-64 h-64 ${isBuy ? 'bg-emerald' : 'bg-rose'} opacity-[0.03] rounded-full blur-[100px] group-hover:opacity-[0.07] transition-opacity`} />
            
            <div className="flex justify-between items-start relative z-10">
                <div className="flex flex-col gap-1">
                    <span className="font-data text-[10px] text-secondary tracking-[0.4em] uppercase opacity-60">// PRIMARY INTELLIGENCE</span>
                    <h2 className="font-display font-black text-white text-6xl tracking-tighter uppercase tabular-nums">
                        {signal.ticker.split('.')[0]}
                    </h2>
                </div>
                <div className={`flex flex-col items-end gap-2`}>
                    <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${isBuy ? 'bg-emerald text-void shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-rose text-white'} animate-pulse-glow flex items-center gap-2`}>
                        {isBuy ? <Zap size={14} /> : <TrendingDown size={14} />}
                        {signal.action} SIGNAL
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-10 relative z-10">
                <div className="flex flex-col gap-2">
                    <span className="font-data text-[10px] text-secondary uppercase tracking-widest font-bold">Confidence Index</span>
                    <div className="flex items-center gap-4">
                        <span className={`font-display text-4xl font-black ${color}`}>
                            {Math.round((signal.conf || signal.confidence || 0) * (signal.conf ? 1 : 100))}%
                        </span>
                        <div className="flex-1 h-2 bg-void/50 rounded-full overflow-hidden border border-mid">
                            <div 
                                className={`h-full ${isBuy ? 'bg-emerald' : 'bg-rose'} shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all duration-1000`} 
                                style={{ width: `${(signal.conf || signal.confidence * 100)}%` }} 
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="font-data text-[10px] text-secondary uppercase tracking-widest font-bold">Market Entry</span>
                    <span className="font-display text-4xl font-black text-white">
                        ₹{(signal.current_price || signal.price || 0).toLocaleString('en-IN')}
                    </span>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="font-data text-[10px] text-secondary uppercase tracking-widest font-bold">AI Reasoning</span>
                    <p className="font-body text-xs text-secondary leading-relaxed line-clamp-2 italic">
                        "High probability trend reversal detected via neural attention gates. Volatility compression suggests iminent breakout."
                    </p>
                </div>
            </div>

            <div className="mt-8 flex items-center justify-between pt-6 border-t border-dim relative z-10">
                <div className="flex gap-6 text-[10px] font-data text-secondary uppercase tracking-widest">
                    <span className="flex items-center gap-2"><Target size={12} className="text-cyan" /> P90 Strategy: Optimistic</span>
                    <span className="flex items-center gap-2"><TrendingUp size={12} className="text-emerald" /> RSI Confluence: High</span>
                </div>
                <button className="flex items-center gap-2 text-cyan font-bold text-[10px] uppercase tracking-widest group-hover:gap-4 transition-all">
                    Initialize Terminal Control <TrendingUp size={14} />
                </button>
            </div>
        </div>
    );
};
