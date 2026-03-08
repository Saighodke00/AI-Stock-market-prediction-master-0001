import React from 'react';

const mockTickers = [
    { symbol: 'RELIANCE.NS', price: '2,987.50', change: '+1.2%' },
    { symbol: 'TCS.NS', price: '4,102.00', change: '+2.4%' },
    { symbol: 'INFY.NS', price: '1,643.20', change: '-0.8%' },
    { symbol: 'HDFCBANK.NS', price: '1,452.90', change: '+0.1%' },
    { symbol: 'ICICIBANK.NS', price: '1,089.45', change: '+1.5%' },
    { symbol: 'WIPRO.NS', price: '521.80', change: '-1.1%' },
    { symbol: 'BAJFINANCE.NS', price: '6,782.10', change: '+3.2%' },
    { symbol: 'MARUTI.NS', price: '11,450.00', change: '-0.4%' },
    { symbol: 'NIFTY50', price: '22,147.00', change: '-0.4%' },
    { symbol: 'SENSEX', price: '73,058.00', change: '+0.1%' },
    { symbol: 'VIX', price: '14.20', change: '+2.1%' },
];

export const TickerTape: React.FC = () => {
    // We duplicate the array to create a seamless infinite scroll effect
    const doubledTickers = [...mockTickers, ...mockTickers, ...mockTickers];

    return (
        <div className="h-[32px] bg-void border-t border-dim shrink-0 flex items-center overflow-hidden w-full relative z-50">
            <div className="flex items-center whitespace-nowrap animate-ticker hover:[webkit-animation-play-state:paused] hover:[animation-play-state:paused]">
                {doubledTickers.map((item, index) => {
                    const isPositive = item.change.startsWith('+');
                    const colorClass = isPositive ? 'text-green' : 'text-red';
                    const symbolStr = isPositive ? '▲' : '▼';

                    return (
                        <div key={index} className="flex items-center px-4 shrink-0">
                            <span className="font-data text-[10px] text-cyan tracking-[1px] mr-3">{item.symbol}</span>
                            <span className="font-data text-[10px] text-primary font-bold mr-2">{item.price}</span>
                            <span className={`font-data text-[10px] ${colorClass}`}>{symbolStr} {item.change}</span>
                            {/* Divider */}
                            <div className="w-px h-3 bg-dim ml-4" />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
