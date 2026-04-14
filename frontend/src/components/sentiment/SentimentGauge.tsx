import React, { useEffect, useState } from 'react';

interface SentimentGaugeProps {
  score: number; // -1.0 to 1.0
  label: string;
  isLoading?: boolean;
}

export const SentimentGauge: React.FC<SentimentGaugeProps> = ({ score, label, isLoading }) => {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setDisplayScore(score), 100);
      return () => clearTimeout(timer);
    }
  }, [score, isLoading]);

  // Map -1..1 to 0..180 degrees
  const rotation = ((displayScore + 1) / 2) * 180;

  // Colors based on sentiment
  const getGaugeColor = (val: number) => {
    if (val < -0.3) return '#ff1744'; // Red (Panic)
    if (val > 0.3) return '#00e676';  // Green (Euphoria)
    return '#ffea00';                // Yellow (Neutral)
  };

  const activeColor = getGaugeColor(displayScore);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-[#0a0f1d] border border-cyan/10 rounded-xl relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative w-48 h-24 overflow-hidden mb-2">
        {/* Gauge Background Track */}
        <div className="absolute top-0 left-0 w-48 h-48 border-[12px] border-dim rounded-full" />
        
        {/* Gauge Fill (Optional visual flare) */}
        <svg className="absolute top-0 left-0 w-48 h-48 -rotate-90">
          <circle
            cx="96"
            cy="96"
            r="84"
            fill="none"
            stroke={activeColor}
            strokeWidth="12"
            strokeDasharray={`${(rotation / 360) * 527.7} 527.7`}
            className="transition-all duration-1000 ease-out opacity-20"
          />
        </svg>

        {/* Needle */}
        <div 
          className="absolute bottom-0 left-1/2 w-1 h-20 bg-white origin-bottom -translate-x-1/2 transition-transform duration-1000 ease-out z-10 shadow-[0_0_15px_rgba(255,255,255,0.5)]"
          style={{ transform: `translateX(-50%) rotate(${rotation - 90}deg)` }}
        >
          <div className="w-3 h-3 bg-white rounded-full absolute -bottom-1 -left-1 shadow-[0_0_10px_white]" />
        </div>
      </div>

      {/* Labeling */}
      <div className="text-center z-10">
        <div className="text-3xl font-black font-display tracking-tighter" style={{ color: activeColor }}>
          {displayScore > 0 ? '+' : ''}{displayScore.toFixed(2)}
        </div>
        <div className="text-[10px] font-bold text-muted tracking-[0.3em] uppercase mt-1">
          {label || 'CALIBRATING'}
        </div>
      </div>

      {/* Ticks */}
      <div className="absolute top-full -mt-24 left-1/2 -translate-x-1/2 w-48 flex justify-between px-4 text-[8px] font-mono text-muted">
        <span>PANIC</span>
        <span>NEUTRAL</span>
        <span>EUPHORIA</span>
      </div>
    </div>
  );
};
