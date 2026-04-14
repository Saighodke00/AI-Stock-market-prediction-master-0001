import React from 'react';

interface SentimentGaugeProps {
    score: number; // -1 to 1
}

export const SentimentGauge: React.FC<SentimentGaugeProps> = ({ score }) => {
    // Map -1..1 to 0..180 degrees
    const rotation = ((score + 1) / 2) * 180;
    
    const getColor = () => {
        if (score > 0.3) return 'stroke-emerald-400';
        if (score < -0.3) return 'stroke-rose-400';
        return 'stroke-amber-400';
    };

    const getGlow = () => {
        if (score > 0.3) return 'shadow-emerald-500/20';
        if (score < -0.3) return 'shadow-rose-500/20';
        return 'shadow-amber-500/20';
    };

    return (
        <div className="relative w-64 h-40 mx-auto flex items-center justify-center pt-8">
            {/* Gauge Background (Semi-Circle) */}
            <svg viewBox="0 0 100 50" className="w-full h-full">
                {/* Track */}
                <path
                    d="M 10 45 A 35 35 0 0 1 90 45"
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="10"
                    strokeLinecap="round"
                />
                {/* Active Segment (approximation) */}
                <path
                    d="M 10 45 A 35 35 0 0 1 90 45"
                    fill="none"
                    className={`${getColor()} transition-all duration-1000 ease-out`}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray="125.66"
                    strokeDashoffset={125.66 - (rotation / 180) * 125.66}
                />
                
                {/* Colored Zones (subtle pips) */}
                <circle cx="10" cy="45" r="1.5" className="fill-rose-500/50" />
                <circle cx="50" cy="10" r="1.5" className="fill-amber-500/50" />
                <circle cx="90" cy="45" r="1.5" className="fill-emerald-500/50" />
            </svg>

            {/* Needle Center Pivot */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-void border-2 border-mid rounded-full z-20" />

            {/* Needle */}
            <div 
                className="absolute bottom-1 left-1/2 w-1.5 h-24 bg-gradient-to-t from-slate-500 via-cyan-400 to-white origin-bottom -translate-x-1/2 rounded-full z-10 transition-transform duration-1000 ease-out shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                style={{ transform: `translateX(-50%) rotate(${rotation - 90}deg)` }}
            >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-cyan-400 blur-md opacity-60" />
            </div>

            {/* Labels */}
            <div className="absolute bottom-0 left-0 text-[8px] font-black text-rose-500/40 uppercase tracking-widest px-2">Panic</div>
            <div className="absolute bottom-0 right-0 text-[8px] font-black text-emerald-500/40 uppercase tracking-widest px-2">Euphoria</div>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[9px] font-black text-amber-500/40 uppercase tracking-widest">Neutral</div>
        </div>
    );
};
