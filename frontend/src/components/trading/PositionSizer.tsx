import React, { useState, useEffect } from 'react';
import { 
    ChevronDown, ChevronRight, Target, Wallet, Percent, ShieldAlert, 
    TrendingUp, TrendingDown, ArrowDown, ArrowUp, Minus, Info,
    Brain, ShieldCheck, Activity, BarChart3, Sparkles, Lightbulb,
    CheckCircle2, XCircle
} from 'lucide-react';
import { SignalResponse } from '../../api/api';

interface PositionSizerProps {
    data: SignalResponse | null;
}

export const PositionSizer: React.FC<PositionSizerProps> = ({ data }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [portfolioValue, setPortfolioValue] = useState(500000);
    const [riskPct, setRiskPct] = useState(1.5);

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
    const atr = data.atr || (currentPrice * 0.015);
    const isBuy = data.action === 'BUY';
    const isSell = data.action === 'SELL';
    const isHold = data.action === 'HOLD' || data.action === 'NEUTRAL';

    let stopLossPrice = data.p10;
    if (isBuy) {
        if (!stopLossPrice || stopLossPrice >= currentPrice) stopLossPrice = currentPrice - (2 * atr);
    } else if (isSell) {
        if (!stopLossPrice || stopLossPrice <= currentPrice) stopLossPrice = currentPrice + (2 * atr);
    }

    const stopLossDistance = Math.abs(currentPrice - stopLossPrice);
    const targetDistance = Math.abs((p50 ?? currentPrice) - currentPrice);
    const riskAmount = portfolioValue * (riskPct / 100);

    let shares = 0;
    if (stopLossDistance > 0 && !isNaN(riskAmount)) {
        shares = Math.floor(riskAmount / stopLossDistance);
    }

    const maxLoss = shares * stopLossDistance;
    const estGain = shares * targetDistance;
    const totalPositionValue = shares * currentPrice;
    const posPctOfPortfolio = isNaN(totalPositionValue) || portfolioValue === 0 ? 0 : (totalPositionValue / portfolioValue) * 100;
    const isOversized = posPctOfPortfolio > 20;
    const rrRatio = maxLoss > 0 ? estGain / maxLoss : 0;
    const kellyCapPct = 8.4;

    // Intelligence Metrics
    const confidence = Math.round((data.confidence ?? 0.5) * 100);
    const accuracy = Math.round(data.accuracy ?? 50);
    const sentimentScore = data.sentiment?.score ?? 0;
    const gates = data.gate_results || { gate1_cone: false, gate2_sentiment: false, gate3_technical: false, gates_passed: false };
    const reason = data.reason || data.explanation || "No explicit reasoning provided by the neural engine for this ticker.";

    // Color scheme based on direction
    const actionColor = isBuy ? 'text-emerald-400' : isSell ? 'text-rose-400' : 'text-amber-400';
    const actionBg = isBuy ? 'bg-emerald-500/10' : isSell ? 'bg-rose-500/10' : 'bg-amber-500/10';
    const actionBorder = isBuy ? 'border-emerald-500/25' : isSell ? 'border-rose-500/25' : 'border-amber-500/25';
    const actionGlow = isBuy ? 'bg-emerald-500' : isSell ? 'bg-rose-500' : 'bg-amber-500';
    const actionLabel = data.action;

    // R:R bar ratio
    const rrBarMax = Math.max(rrRatio, 1);
    const riskBarWidth = Math.min((1 / rrBarMax) * 100, 100);
    const rewardBarWidth = Math.min((rrRatio / rrBarMax) * 100, 100);

    // Sentiment bar: maps -1 to 1 to 0% to 100%
    const sentimentWidth = ((sentimentScore + 1) / 2) * 100;

    const fmt = (n: number, decimals = 2) =>
        isNaN(n) || n === null ? '—' : n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

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
                    <div className="flex flex-col items-start text-left">
                        <span className="font-display font-bold text-sm tracking-widest text-slate-300 group-hover:text-white transition-colors uppercase">
                            Trade Architect
                        </span>
                        <span className="text-[9px] text-slate-600 uppercase tracking-widest font-medium">Position sizing & risk intelligence</span>
                    </div>
                </div>
                {isOpen ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
            </button>

            {/* Collapsible Content */}
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[1600px] mt-4 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="flex flex-col gap-8 p-6 glass-card border-white/5 bg-white/[0.01]">

                    {/* ─── SECTION 1: CAPITAL INPUTS ─── */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Wallet className="w-3.5 h-3.5 text-indigo-400" />
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.25em]">Personal Capital Configuration</p>
                        </div>
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="flex-1 flex flex-col gap-2">
                                <label className="text-slate-400 text-[10px] font-bold tracking-widest uppercase ml-1">Total Portfolio Value</label>
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">₹</span>
                                    <input
                                        type="number"
                                        value={portfolioValue}
                                        onChange={(e) => setPortfolioValue(Number(e.target.value))}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-8 pr-4 py-3.5 text-white font-mono text-lg outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all"
                                        step="10000"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-500/0 group-focus-within:bg-indigo-500/50 transition-all rounded-b-2xl" />
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col gap-2">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">Max Risk Per Trade</label>
                                    <span className="font-mono text-indigo-300 text-sm font-bold bg-indigo-500/10 px-3 py-1 rounded-xl border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
                                        {riskPct.toFixed(1)}%  =  ₹{Math.round(riskAmount).toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <div className="relative flex items-center h-8 mt-1 px-1">
                                    <input
                                        type="range"
                                        min="0.5" max="3.0" step="0.5"
                                        value={riskPct}
                                        onChange={(e) => setRiskPct(Number(e.target.value))}
                                        className="w-full accent-indigo-500 bg-white/10 rounded-full h-1.5 appearance-none cursor-pointer"
                                    />
                                </div>
                                <div className="flex justify-between text-[9px] font-bold text-slate-600 uppercase tracking-widest px-1">
                                    <span>Conservative</span>
                                    <span>Standard</span>
                                    <span>Aggressive</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─── SECTION 2: NEURAL INTELLIGENCE RECOMMENDATION ─── */}
                    <div className={`rounded-3xl border ${actionBorder} ${actionBg} p-7 relative overflow-hidden backdrop-blur-xl transition-all shadow-2xl`}>
                        <div className={`absolute top-0 right-0 w-64 h-64 blur-[100px] opacity-10 -z-10 ${actionGlow}`} />
                        
                        {/* Top Intelligence Row */}
                        <div className="flex flex-wrap items-center gap-4 mb-6">
                            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Confidence: <span className="text-white ml-1">{confidence}%</span></span>
                            </div>
                            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5">
                                <Target className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Accuracy: <span className="text-white ml-1">{accuracy}%</span></span>
                            </div>
                            <div className="flex-1 min-w-[140px] flex items-center gap-3">
                                <div className="flex flex-col gap-1 w-full">
                                    <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                        <span>Sentiment Intensity</span>
                                        <span className={sentimentScore > 0 ? 'text-emerald-400' : 'text-rose-400'}>{sentimentScore.toFixed(2)}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${sentimentScore > 0 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`} 
                                            style={{ width: `${sentimentWidth}%` }} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Recommendation Callout */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                            <div className="flex flex-col">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3">Prime Recommendation</p>
                                <div className="flex items-baseline gap-4 flex-wrap">
                                    <span className={`font-display font-black text-6xl italic uppercase tracking-tighter ${actionColor}`}>{actionLabel}</span>
                                    {!isHold && (
                                        <>
                                            <span className="font-mono text-white text-4xl font-black">{shares.toLocaleString('en-IN')}</span>
                                            <span className="text-slate-400 text-xl font-medium tracking-wide">shares of <span className="text-white font-bold">{data.ticker}</span></span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Safety Checklist (Guardrails) */}
                            <div className="flex items-center gap-3 bg-black/30 backdrop-blur-md rounded-2xl p-4 border border-white/5">
                                <div className="flex flex-col gap-2">
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Safety Gates</span>
                                    <div className="flex gap-2">
                                        <div className="flex flex-col items-center gap-1" title="Volatility Cone Gate">
                                            {gates.gate1_cone ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-rose-500" />}
                                            <span className="text-[7px] font-medium text-slate-500 uppercase">Cone</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-1" title="Sentiment Alignment Gate">
                                            {gates.gate2_sentiment ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-rose-500" />}
                                            <span className="text-[7px] font-medium text-slate-500 uppercase">Sent</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-1" title="Technical Zone Gate">
                                            {gates.gate3_technical ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-rose-500" />}
                                            <span className="text-[7px] font-medium text-slate-500 uppercase">Tech</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Position Summary Chips */}
                        {!isHold && (
                            <div className="flex flex-wrap gap-4 pt-6 border-t border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                        <Wallet size={18} className="text-slate-400" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Total Commitment</span>
                                        <span className="text-white font-mono font-bold text-sm">₹{Math.round(totalPositionValue).toLocaleString('en-IN')}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl bg-white/5 border ${isOversized ? 'border-amber-500/20' : 'border-white/10'} flex items-center justify-center`}>
                                        <BarChart3 size={18} className={isOversized ? 'text-amber-400' : 'text-slate-400'} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">% Exposure</span>
                                        <span className={`font-mono font-bold text-sm ${isOversized ? 'text-amber-400' : 'text-white'}`}>{posPctOfPortfolio.toFixed(1)}%</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                        <ShieldCheck size={18} className="text-indigo-400" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Kelly Limit</span>
                                        <span className="text-indigo-300 font-mono font-bold text-sm">{kellyCapPct}%</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Reasoning Section (Visible for all actions including HOLD) */}
                        <div className="mt-8 p-5 bg-black/40 rounded-2xl border border-white/5 shadow-inner">
                            <div className="flex items-center gap-2 mb-3">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Neural Logic & Deduction</span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                {reason}
                            </p>
                        </div>
                    </div>

                    {/* ─── SECTION 3: TRADE GEOMETRY (PRICE LADDER) ─── */}
                    {!isHold && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div>
                                <div className="flex items-center gap-2 mb-6">
                                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.25em]">Precision Price Ladder</p>
                                </div>

                                <div className="relative flex flex-col gap-0 px-2">
                                    {/* TARGET */}
                                    <div className="flex items-stretch gap-6">
                                        <div className="flex flex-col items-center w-8 shrink-0">
                                            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                                                <TrendingUp size={18} className="text-emerald-400" />
                                            </div>
                                            <div className="flex-1 w-0.5 bg-gradient-to-b from-emerald-500/40 via-indigo-500/10 to-transparent my-1" />
                                        </div>
                                        <div className="flex-1 flex justify-between items-start pb-8 border-b border-white/5">
                                            <div className="flex flex-col gap-1">
                                                <p className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">Target Profit Level</p>
                                                <p className="text-[10px] text-slate-600 leading-relaxed font-medium">Neural P50 median forecast — automated exit zone.</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="font-mono text-xl font-black text-emerald-400">₹{fmt(p50)}</p>
                                                <p className="text-[11px] text-emerald-500/60 font-bold">+₹{fmt(targetDistance)} profit/sh</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ENTRY */}
                                    <div className="flex items-stretch gap-6 my-1">
                                        <div className="flex flex-col items-center w-8 shrink-0">
                                            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                                                <Minus size={18} className="text-indigo-400" />
                                            </div>
                                            <div className="flex-1 w-0.5 bg-gradient-to-b from-transparent via-indigo-500/10 to-rose-500/40 my-1" />
                                        </div>
                                        <div className="flex-1 flex justify-between items-start py-8 border-b border-white/5">
                                            <div className="flex flex-col gap-1">
                                                <p className="text-[11px] font-black text-indigo-300 uppercase tracking-widest">Entry Execution</p>
                                                <p className="text-[10px] text-slate-600 leading-relaxed font-medium">Current live market data — institutional base price.</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="font-mono text-xl font-black text-white">₹{fmt(currentPrice)}</p>
                                                <p className="text-[11px] text-slate-500 font-bold">LTP Execution</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* STOP LOSS */}
                                    <div className="flex items-stretch gap-6">
                                        <div className="flex flex-col items-center w-8 shrink-0">
                                            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(244,63,94,0.1)]">
                                                <TrendingDown size={18} className="text-rose-400" />
                                            </div>
                                        </div>
                                        <div className="flex-1 flex justify-between items-start pt-8">
                                            <div className="flex flex-col gap-1">
                                                <p className="text-[11px] font-black text-rose-400 uppercase tracking-widest">Stop Sacrifice</p>
                                                <p className="text-[10px] text-slate-600 leading-relaxed font-medium">Hard safety floor based on ATR volatility buffers.</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="font-mono text-xl font-black text-rose-400">₹{fmt(stopLossPrice)}</p>
                                                <p className="text-[11px] text-rose-500/60 font-bold">-₹{fmt(stopLossDistance)} risk/sh</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Risk:Reward & Technical Snapshot */}
                            <div className="flex flex-col gap-10">
                                {/* R:R Visual */}
                                <div>
                                    <div className="flex justify-between items-center mb-6">
                                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.25em]">Risk Optimization Ratio</p>
                                        <div className="flex gap-4">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">RSI</span>
                                                <span className={`text-xs font-mono font-bold ${data.rsi > 70 ? 'text-rose-400' : data.rsi < 30 ? 'text-emerald-400' : 'text-slate-300'}`}>{data.rsi?.toFixed(1) ?? '—'}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">ADX</span>
                                                <span className="text-xs font-mono font-bold text-slate-300">{data.adx?.toFixed(1) ?? '—'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 transition-all hover:bg-white/[0.04]">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.15em]">Profit Multiplier</span>
                                            <span className={`text-2xl font-mono font-black ${rrRatio >= 2 ? 'text-emerald-400' : rrRatio >= 1 ? 'text-amber-400' : 'text-rose-400'}`}>
                                                1 : {rrRatio.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex gap-1.5 h-4 rounded-full overflow-hidden mb-6 p-0.5 bg-black/40 border border-white/5">
                                            <div
                                                className="bg-rose-500/80 rounded-l-full transition-all duration-1000 flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                                                style={{ width: `${riskBarWidth}%` }}
                                            />
                                            <div
                                                className="bg-emerald-500/80 rounded-r-full transition-all duration-1000 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                                                style={{ width: `${rewardBarWidth}%` }}
                                            />
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] text-rose-400/70 font-black uppercase tracking-widest">Capital Exhaust</span>
                                                <span className="text-lg font-mono font-black text-rose-400">-₹{Math.round(maxLoss).toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="flex flex-col gap-1 text-right">
                                                <span className="text-[9px] text-emerald-400/70 font-black uppercase tracking-widest">Projected Alpha</span>
                                                <span className="text-lg font-mono font-black text-emerald-400">+₹{Math.round(estGain).toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 px-4 py-3 bg-white/[0.02] rounded-xl border border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Info size={14} className="text-slate-500" />
                                            <span className="text-[10px] text-slate-500 font-medium tracking-wide">Signal Grade:</span>
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${rrRatio >= 2 ? 'text-emerald-400' : rrRatio >= 1 ? 'text-amber-400' : 'text-rose-400'}`}>
                                            {rrRatio >= 2 ? 'Institutional Grade' : rrRatio >= 1 ? 'Speculative Entry' : 'Risk Outlier'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── EXPOSURE & HOLD WARNINGS ─── */}
                    <div className="flex flex-col gap-4">
                        {isOversized && !isHold && (
                            <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-md">
                                <div className="flex gap-4 items-start">
                                    <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                        <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-amber-400 font-black text-xs uppercase tracking-widest">Institutional Over-exposure</p>
                                        <p className="text-amber-500/70 text-[11px] leading-relaxed font-medium">
                                            Commitment (<span className="text-amber-300 font-bold">{posPctOfPortfolio.toFixed(1)}%</span>) violates the 20% guardrail limit.
                                            Automated risk systems suggest scaling down quantity or increasing deployment capital base.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isHold && (
                            <div className="p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-md">
                                <div className="flex gap-4 items-start">
                                    <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                                        <Sparkles className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-indigo-300 font-black text-xs uppercase tracking-widest">Intelligence Bias: Observation Mode</p>
                                        <p className="text-indigo-400/60 text-[11px] leading-relaxed font-medium">
                                            The neural engine is currently absorbing market fluctuations without identifying a high-probability entry vector. 
                                            Observing <span className="text-white font-bold">{data.ticker}</span> for regime shifts or volume spikes before architecting a new position.
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

