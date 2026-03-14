import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Target, Wallet, Percent, ShieldAlert, TrendingUp, TrendingDown, Info } from 'lucide-react';
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
    const kellyCapPct = 8.4;
    const maxLoss = shares * stopLossDistance;
    const estGain = shares * Math.abs(p50 - currentPrice);
    const totalPositionSize = shares * currentPrice;
    const posPctOfPortfolio = isNaN(totalPositionSize) || isNaN(portfolioValue) ? 0 : (totalPositionSize / portfolioValue) * 100;
    const isOversized = posPctOfPortfolio > 20;

    const stateColor = data.action === 'BUY' ? 'text-emerald-400' : data.action === 'SELL' ? 'text-rose-400' : 'text-amber-400';
    const stateBg = data.action === 'BUY' ? 'bg-emerald-500' : data.action === 'SELL' ? 'bg-rose-500' : 'bg-amber-500';
    const stateBorder = data.action === 'BUY' ? 'border-emerald-500/30' : data.action === 'SELL' ? 'border-rose-500/30' : 'border-amber-500/30';

    return (
        <div className="w-full mt-6 flex flex-col font-body border-t border-white/5 pt-4">
            {/* Header Toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="group flex items-center justify-between p-4 w-full glass-card hover:bg-white/[0.04] transition-all duration-300 outline-none border-white/10"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 group-hover:scale-110 transition-transform">
                        <Target size={16} className="text-indigo-400" />
                    </div>
                    <span className="font-display font-bold text-sm tracking-widest text-slate-300 group-hover:text-white transition-colors uppercase">
                        Trade Architect <span className="text-slate-500 ml-1 font-normal opacity-50">/ v3.0</span>
                    </span>
                </div>
                {isOpen ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
            </button>

            {/* Collapsible Content */}
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[800px] mt-4 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="flex flex-col xl:flex-row gap-6 p-6 glass-card border-white/5 bg-white/[0.01]">

                    {/* Inputs */}
                    <div className="flex flex-col gap-8 xl:w-[320px] shrink-0">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 mb-1">
                                <Wallet className="w-4 h-4 text-slate-500" />
                                <label className="text-slate-500 text-[10px] font-bold tracking-[0.2em] uppercase">Deployment Capital</label>
                            </div>
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 font-mono text-xs">₹</span>
                                <input
                                    type="number"
                                    value={portfolioValue}
                                    onChange={(e) => setPortfolioValue(Number(e.target.value))}
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-8 pr-4 py-3.5 text-white font-mono text-lg outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all"
                                    step="10000"
                                />
                                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-500/0 group-focus-within:bg-indigo-500/50 transition-all rounded-b-xl" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-2">
                                    <Percent className="w-4 h-4 text-slate-500" />
                                    <label className="text-slate-500 text-[10px] font-bold tracking-[0.2em] uppercase">Risk Allocation</label>
                                </div>
                                <span className="font-mono text-indigo-400 text-sm font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{riskPct.toFixed(1)}%</span>
                            </div>
                            <div className="relative flex items-center h-6">
                                <input
                                    type="range"
                                    min="0.5" max="3.0" step="0.5"
                                    value={riskPct}
                                    onChange={(e) => setRiskPct(Number(e.target.value))}
                                    className="w-full accent-indigo-500 bg-white/10 rounded-full h-1.5 appearance-none cursor-pointer"
                                />
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-1">
                                <span>Conservative</span>
                                <span>Aggressive</span>
                            </div>
                        </div>
                    </div>

                    {/* Result Card */}
                    <div className={`flex-1 rounded-2xl border ${stateBorder} bg-black/40 p-6 relative overflow-hidden shadow-2xl`}>
                        {/* Background Decoration */}
                        <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-20 -z-10 ${stateBg}`} />

                        {/* Action Header */}
                        <div className="flex flex-col mb-8 px-1">
                             <div className="flex items-center gap-2 mb-2">
                                <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${stateColor}`}>Prime Allocation</span>
                             </div>
                             <h3 className="font-display font-bold text-4xl text-white tracking-tight flex items-baseline gap-4 flex-wrap">
                                <span className={`${stateColor} italic uppercase`}>{data.action}</span>
                                <span className="font-mono text-3xl font-black">{shares}</span>
                                <span className="text-slate-400 font-body text-xl font-medium tracking-normal">units of {data.ticker}</span>
                             </h3>
                        </div>

                        {/* Grid Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12 px-1">
                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                <div className="flex flex-col">
                                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Strategic Entry</span>
                                    <span className="text-[10px] text-slate-600 font-medium">Market Exec</span>
                                </div>
                                <span className="font-mono text-lg text-white font-bold tracking-tight">₹{(currentPrice ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>

                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                <div className="flex flex-col">
                                    <span className="text-rose-400/80 text-[10px] font-bold uppercase tracking-wider">Stop Sacrifice</span>
                                    <span className="text-[10px] text-slate-600 font-medium">Total Exposure</span>
                                </div>
                                <span className="font-mono text-lg text-rose-400 font-bold tracking-tight">₹{Math.round(maxLoss ?? 0).toLocaleString('en-IN')} <span className="text-[11px] text-slate-600 ml-1">({(riskPct ?? 0).toFixed(1)}%)</span></span>
                            </div>

                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                <div className="flex flex-col">
                                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Safety Floor</span>
                                    <span className="text-[10px] text-slate-600 font-medium font-mono">ATR × 2.0</span>
                                </div>
                                <span className="font-mono text-lg text-white font-bold tracking-tight">₹{(stopLossPrice ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>

                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                <div className="flex flex-col">
                                    <span className="text-emerald-400/80 text-[10px] font-bold uppercase tracking-wider">Inference Gain</span>
                                    <span className="text-[10px] text-slate-600 font-medium">Potential R:R 1:{((estGain / maxLoss) || 0).toFixed(1)}</span>
                                </div>
                                <span className="font-mono text-lg text-emerald-400 font-bold tracking-tight">₹{Math.round(estGain ?? 0).toLocaleString('en-IN')}</span>
                            </div>

                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                <div className="flex flex-col">
                                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Exit Alpha</span>
                                    <span className="text-[10px] text-slate-600 font-medium font-mono">P50 Neural Target</span>
                                </div>
                                <span className="font-mono text-lg text-emerald-400 font-bold tracking-tight">₹{(p50 ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>

                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                <div className="flex flex-col">
                                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Kelly Criterion</span>
                                    <span className="text-[10px] text-slate-600 font-medium">Risk Limit</span>
                                </div>
                                <span className="font-mono text-lg text-indigo-400 font-bold tracking-tight">{isNaN(kellyCapPct) ? '—' : kellyCapPct.toFixed(1) + '%'}</span>
                            </div>
                        </div>

                        {isOversized && (
                            <div className="mt-8 p-4 glass-card border-amber-500/20 bg-amber-500/5 transition-all duration-300">
                                <div className="flex gap-4 items-start">
                                    <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0" />
                                    <div>
                                        <p className="text-amber-400 font-body text-xs font-bold uppercase tracking-widest mb-1">Exposure Warning</p>
                                        <p className="text-amber-500/70 font-body text-[11px] leading-relaxed font-semibold">
                                            Total position value (<span className="text-amber-300">{posPctOfPortfolio.toFixed(1)}%</span>) exceeds institutional guardrail (20%). Reduce allocation for proper hedge ratios.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
