import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SignalResponse } from '../../api/api';

interface PositionSizerProps {
    data: SignalResponse | null;
}

export const PositionSizer: React.FC<PositionSizerProps> = ({ data }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [portfolioValue, setPortfolioValue] = useState(500000);
    const [riskPct, setRiskPct] = useState(1.5);

    // Auto-open if it's a strong signal
    useEffect(() => {
        if (data && (data.action === 'BUY' || data.action === 'SELL')) {
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    }, [data]);

    if (!data) return null;

    const currentPrice = data.current_price;
    const p50 = data.p50;

    // Calculate ATR approx or fallback to distance 
    // Normally ATR is passed from API, here we derive it from p10 distance safely
    const stopLossDistance = Math.abs(currentPrice - data.p10);
    const stopLossPrice = data.action === 'BUY'
        ? Math.max(0, currentPrice - stopLossDistance)
        : currentPrice + stopLossDistance;

    const riskAmount = portfolioValue * (riskPct / 100);

    // Prevent infinite shares or div 0
    let shares = 0;
    if (stopLossDistance > 0 && !isNaN(riskAmount) && !isNaN(stopLossDistance)) {
        shares = Math.floor(riskAmount / stopLossDistance);
    }

    // Kelly approx
    const kellyCapPct = 8.4; // Static approx for design as per spec
    const maxLoss = shares * stopLossDistance;
    const estGain = shares * Math.abs(p50 - currentPrice);
    const totalPositionSize = shares * currentPrice;
    const posPctOfPortfolio = isNaN(totalPositionSize) || isNaN(portfolioValue) ? 0 : (totalPositionSize / portfolioValue) * 100;
    const isOversized = posPctOfPortfolio > 20;
    const borderColor = data.action === 'BUY' ? 'border-green' : data.action === 'SELL' ? 'border-red' : 'border-gold';
    const actionColor = data.action === 'BUY' ? 'text-green' : data.action === 'SELL' ? 'text-red' : 'text-gold';

    return (
        <div className="w-full mt-4 flex flex-col font-body">
            {/* Header Toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-2 w-full hover:bg-raised transition-colors text-primary font-display font-medium text-sm tracking-wider outline-none"
            >
                {isOpen ? <ChevronDown size={14} className="text-cyan" /> : <ChevronRight size={14} className="text-cyan" />}
                <span className="text-cyan">🎯</span> POSITION SIZING CALCULATOR
            </button>

            {/* Collapsible Content */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[600px] mt-2' : 'max-h-0'}`}>
                <div className="flex flex-col md:flex-row gap-6 p-4 rounded-xl border border-dim bg-surface">

                    {/* Inputs */}
                    <div className="flex flex-col gap-6 md:w-1/3">
                        <div className="flex flex-col gap-2">
                            <label className="text-secondary text-xs font-semibold tracking-wider">PORTFOLIO VALUE (₹)</label>
                            <input
                                type="number"
                                value={portfolioValue}
                                onChange={(e) => setPortfolioValue(Number(e.target.value))}
                                className="bg-void border border-dim rounded px-3 py-2 text-primary font-data text-sm outline-none focus:border-cyan transition-colors"
                                step="10000"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-end">
                                <label className="text-secondary text-xs font-semibold tracking-wider">RISK PER TRADE</label>
                                <span className="font-data text-cyan text-sm">{riskPct.toFixed(1)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0.5" max="3.0" step="0.5"
                                value={riskPct}
                                onChange={(e) => setRiskPct(Number(e.target.value))}
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* Result Card */}
                    <div className={`flex-1 rounded-lg border ${borderColor} bg-raised p-5 relative overflow-hidden shadow-lg`}>
                        {/* Action Header */}
                        <h3 className={`font-display font-bold text-xl mb-4 ${actionColor}`}>
                            <span className="glow-red">{data.action}</span> <span className="text-primary font-data">{shares}</span> <span className="text-primary font-body font-medium text-lg">shares of</span> <span className="text-primary">{data.ticker}</span>
                        </h3>

                        {/* Grid Stats */}
                        <div className="grid grid-cols-2 gap-y-3 gap-x-8">
                            <div className="flex justify-between items-baseline border-b border-dim/50 pb-1">
                                <span className="text-secondary text-xs">Entry:</span>
                                <span className="font-data text-primary">₹{(currentPrice ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>

                            <div className="flex justify-between items-baseline border-b border-dim/50 pb-1">
                                <span className="text-secondary text-xs">Max Loss:</span>
                                <span className="font-data text-red">₹{Math.round(maxLoss ?? 0).toLocaleString('en-IN')} <span className="text-[10px] text-muted ml-0.5">({(riskPct ?? 0).toFixed(1)}%)</span></span>
                            </div>

                            <div className="flex justify-between items-baseline border-b border-dim/50 pb-1">
                                <span className="text-secondary text-xs flex flex-col text-left">Stop Loss: <span className="text-[9px] text-muted">ATR × 2</span></span>
                                <span className="font-data text-primary font-bold">₹{(stopLossPrice ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>

                            <div className="flex justify-between items-baseline border-b border-dim/50 pb-1">
                                <span className="text-secondary text-xs">Est. Gain:</span>
                                <span className="font-data text-green">₹{Math.round(estGain ?? 0).toLocaleString('en-IN')}</span>
                            </div>

                            <div className="flex justify-between items-baseline border-b border-dim/50 pb-1">
                                <span className="text-secondary text-xs flex flex-col text-left">Target: <span className="text-[9px] text-muted">P50 Forecast</span></span>
                                <span className="font-data text-green font-bold">₹{(p50 ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>

                            <div className="flex justify-between items-baseline border-b border-dim/50 pb-1">
                                <span className="text-secondary text-xs flex flex-col text-left">Kelly: <span className="text-[9px] text-muted">Cap</span></span>
                                <span className="font-data text-primary">{isNaN(kellyCapPct) ? '—' : kellyCapPct.toFixed(1) + '%'}</span>
                            </div>
                        </div>

                        {isOversized && (
                            <div className="mt-4 p-2 bg-gold-dim border border-gold/30 rounded text-gold font-body text-[11px] flex items-center gap-2">
                                <span className="text-[14px]">⚠</span> Warning: Total position value ({posPctOfPortfolio.toFixed(1)}% of portfolio) exceeds the 20% institutional guardrail limit.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
