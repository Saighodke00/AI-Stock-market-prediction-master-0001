import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const HeatMapStrip: React.FC = () => {
    const [stocks, setStocks] = useState<any[]>([]);
    const nav = useNavigate();

    useEffect(() => {
        fetch('/api/screener')
            .then(res => res.json())
            .then(data => {
                if (data.results) {
                    setStocks(data.results.slice(0, 20));
                }
            })
            .catch(err => console.error("Heatmap fetch error:", err));
    }, []);

    if (stocks.length === 0) return <div className="h-12 bg-surface/50 animate-pulse rounded-xl mx-6" />;

    return (
        <div className="flex flex-col gap-3 px-6 select-none mt-2">
            <div className="flex justify-between items-end">
                <h2 className="font-data text-[9px] text-slate-400 tracking-[0.3em] uppercase font-bold">
                    // Sector Liquidity Heatmap
                </h2>
                <span className="font-data text-[8px] text-slate-500 uppercase font-bold">20 Global Tickers Active</span>
            </div>
            
            <div className="flex gap-1.5 h-12 w-full">
                {stocks.map((stock, i) => {
                    const isBuy = stock.action === 'BUY';
                    const isSell = stock.action === 'SELL';
                    
                    const color = isBuy ? 'bg-emerald/40 hover:bg-emerald/60' : isSell ? 'bg-rose/40 hover:bg-rose/60' : 'bg-surface/40 hover:bg-surface/60';
                    const border = isBuy ? 'border-emerald/50' : isSell ? 'border-rose/50' : 'border-white/5';
                    const shadow = isBuy ? 'hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]' : isSell ? 'hover:shadow-[0_0_20px_rgba(244,63,94,0.2)]' : '';
                    
                    // Confidence-based width weighting
                    const width = (stock.confidence * 15 + 2) + '%';

                    return (
                        <div
                            key={i}
                            className={`h-full ${color} border ${border} rounded-lg cursor-pointer transition-all duration-300 relative group flex items-center justify-center ${shadow} overflow-hidden`}
                            style={{ width }}
                            onClick={() => nav(`/swing?ticker=${stock.ticker}`)}
                        >
                            {/* Inner Shine Effect */}
                            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                            
                            {/* Tooltip */}
                            <div className="opacity-0 group-hover:opacity-100 absolute -top-12 left-1/2 -translate-x-1/2 bg-raised/90 backdrop-blur-md border border-white/10 px-3 py-2 rounded-xl text-[10px] font-data text-white z-50 shadow-2xl pointer-events-none transition-all scale-75 group-hover:scale-100 flex flex-col items-center min-w-[120px]">
                                <span className="text-muted tracking-widest text-[8px] mb-1">{stock.ticker}</span>
                                <div className="flex items-center gap-2">
                                     <span className={isBuy ? 'text-emerald' : isSell ? 'text-rose' : 'text-primary'}>{stock.action}</span>
                                     <span className="text-secondary opacity-40">|</span>
                                     <span className="font-black">{(stock.confidence * 100).toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-1 bg-void/50 rounded-full mt-2 overflow-hidden">
                                    <div className={`h-full ${isBuy ? 'bg-emerald' : isSell ? 'bg-rose' : 'bg-secondary'} w-[${stock.confidence * 100}%]`} />
                                </div>
                            </div>

                            <span className="text-[9px] font-black text-white/20 group-hover:text-white/80 transition-colors uppercase tracking-widest truncate px-1 relative z-10">
                                {stock.ticker.split('.')[0]}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
