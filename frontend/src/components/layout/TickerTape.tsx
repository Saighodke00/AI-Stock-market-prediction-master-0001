import React from 'react';
import { Activity, Zap, TrendingUp, BarChart } from 'lucide-react';

const mockTickers = [
    { symbol: 'RELIANCE', price: '2,987.50', change: '+1.2%', type: 'BULLISH' },
    { symbol: 'TCS', price: '4,102.00', change: '+2.4%', type: 'BULLISH' },
    { symbol: 'INFY', price: '1,643.20', change: '-0.8%', type: 'BEARISH' },
    { symbol: 'HDFCBANK', price: '1,452.90', change: '+0.1%', type: 'BULLISH' },
    { symbol: 'ICICIBANK', price: '1,089.45', change: '+1.5%', type: 'BULLISH' },
    { symbol: 'WIPRO', price: '521.80', change: '-1.1%', type: 'BEARISH' },
    { symbol: 'NIFTY50', price: '22,147.00', change: '-0.4%', type: 'BEARISH' },
    { symbol: 'SENSEX', price: '73,058.00', change: '+0.1%', type: 'BULLISH' },
    { symbol: 'VIX', price: '14.20', change: '+2.1%', type: 'VOLATILE' },
];

export const TickerTape: React.FC = () => {
    const doubledTickers = [...mockTickers, ...mockTickers, ...mockTickers];

    return (
        <div className="h-[40px] bg-base border-t border-dim shrink-0 flex items-center overflow-hidden w-full relative z-50">
            {/* HUD Prefix */}
            <div className="flex-none px-6 h-full flex items-center gap-3 bg-base border-r border-dim z-20 relative shadow-[10px_0_20px_rgba(0,0,0,0.5)]">
                <Activity size={12} className="text-cyan animate-pulse" />
                <span className="font-data-tiny text-[8px] text-muted uppercase tracking-[0.3em] font-black">Market Stream</span>
            </div>

            {/* Scrolling Tape */}
            <div className="flex items-center whitespace-nowrap animate-ticker hover:[animation-play-state:paused] transition-all duration-300">
                {doubledTickers.map((item, index) => {
                    const isPositive = item.change.startsWith('+');
                    const isVolatile = item.type === 'VOLATILE';
                    const colorName = isVolatile ? 'amber' : isPositive ? 'emerald' : 'rose';
                    const textColor = `text-${colorName}`;
                    const Icon = isVolatile ? Activity : isPositive ? TrendingUp : BarChart;

                    return (
                        <div key={index} className="flex items-center gap-4 px-10 shrink-0 group border-l border-dim first:border-none">
                            <span className="font-display font-black text-[11px] text-primary tracking-[0.1em] group-hover:text-cyan transition-colors uppercase">{item.symbol}</span>
                            <span className="font-data font-bold text-[10px] text-muted tabular-nums">{item.price}</span>
                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border bg-${colorName}/10 border-${colorName}/20`}>
                                <Icon size={8} className={textColor} />
                                <span className={`font-data-tiny font-black text-[9px] ${textColor} tracking-tighter`}>
                                    {item.change}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* HUD Suffix Overlay */}
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-bg-base to-transparent pointer-events-none z-10" />
        </div>
    );

};
