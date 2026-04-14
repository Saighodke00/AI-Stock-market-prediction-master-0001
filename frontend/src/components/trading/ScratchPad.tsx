import React, { useState, useEffect } from 'react';
import { X, Target, ShieldAlert, Calculator, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface ScratchPadProps {
    isOpen: boolean;
    onClose: () => void;
    currentPrice: number;
}

export const ScratchPad: React.FC<ScratchPadProps> = ({ isOpen, onClose, currentPrice }) => {
    const [entry, setEntry] = useState(currentPrice);
    const [target, setTarget] = useState(currentPrice * 1.05);
    const [stopLoss, setStopLoss] = useState(currentPrice * 0.97);
    const [quantity, setQuantity] = useState(100);
    const [capital, setCapital] = useState(100000);

    useEffect(() => {
        if (entry === 0) setEntry(currentPrice);
    }, [currentPrice]);

    if (!isOpen) return null;

    const upside = Math.max(0, target - entry);
    const downside = Math.max(0, entry - stopLoss);
    const rr = downside > 0 ? (upside / downside).toFixed(2) : '0.00';
    
    const potentialGain = upside * quantity;
    const potentialLoss = downside * quantity;
    
    const riskOfCapital = capital > 0 ? ((potentialLoss / capital) * 100).toFixed(2) : '0.00';
    const rewardOfCapital = capital > 0 ? ((potentialGain / capital) * 100).toFixed(2) : '0.00';

    const getRRStatus = () => {
        const val = parseFloat(rr);
        if (val >= 2.5) return { label: 'EXCELLENT', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
        if (val >= 1.5) return { label: 'GOOD', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' };
        if (val >= 1.0) return { label: 'MARGINAL', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
        return { label: 'POOR', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' };
    };

    const status = getRRStatus();

    return (
        <div className="fixed inset-y-0 right-0 w-[400px] bg-base/95 backdrop-blur-xl border-l border-mid z-[100] shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="p-6 border-b border-mid flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                        <Calculator className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="font-display font-black text-xs text-white uppercase tracking-widest">Scratch Pad</h2>
                        <p className="text-[10px] text-muted font-medium">Manual Trade Planner</p>
                    </div>
                </div>
                <button 
                    onClick={onClose}
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors text-muted hover:text-white"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Inputs Section */}
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Entry Price</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold">₹</span>
                                <input 
                                    type="number" 
                                    value={entry}
                                    onChange={(e) => setEntry(parseFloat(e.target.value) || 0)}
                                    className="w-full bg-white/[0.03] border border-mid rounded-xl py-3 pl-8 pr-4 text-white font-display font-bold text-sm focus:border-indigo-500/50 outline-none transition-all"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Current</label>
                            <div className="w-full bg-white/[0.01] border border-dashed border-dim rounded-xl py-3 px-4 text-secondary font-display font-bold text-sm">
                                ₹{currentPrice.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest ml-1">Profit Target</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-bold">₹</span>
                                <input 
                                    type="number" 
                                    value={target}
                                    onChange={(e) => setTarget(parseFloat(e.target.value) || 0)}
                                    className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-xl py-3 pl-8 pr-4 text-emerald-400 font-display font-bold text-sm focus:border-emerald-500/50 outline-none transition-all"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-rose-500 uppercase tracking-widest ml-1">Stop Loss</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500 font-bold">₹</span>
                                <input 
                                    type="number" 
                                    value={stopLoss}
                                    onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                                    className="w-full bg-rose-500/5 border border-rose-500/20 rounded-xl py-3 pl-8 pr-4 text-rose-400 font-display font-bold text-sm focus:border-rose-500/50 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Quantity</label>
                            <input 
                                type="number" 
                                value={quantity}
                                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                                className="w-full bg-white/[0.03] border border-mid rounded-xl py-3 px-4 text-white font-display font-bold text-sm focus:border-indigo-500/50 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest ml-1">Capital (Total)</label>
                            <input 
                                type="number" 
                                value={capital}
                                onChange={(e) => setCapital(parseFloat(e.target.value) || 0)}
                                className="w-full bg-white/[0.03] border border-mid rounded-xl py-3 px-4 text-white font-display font-bold text-sm focus:border-indigo-500/50 outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Analysis Section */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-indigo-500" />
                        <h3 className="text-[10px] font-black text-secondary uppercase tracking-widest font-display">Risk Analysis</h3>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className={`p-6 rounded-[2rem] border-2 ${status.bg} flex flex-col items-center justify-center text-center gap-2`}>
                            <span className="text-[10px] font-black text-muted uppercase tracking-[0.3em]">Risk : Reward</span>
                            <div className={`text-4xl font-black font-display ${status.color}`}>1 : {rr}</div>
                            <div className={`px-4 py-1.5 rounded-full text-[9px] font-black border uppercase tracking-widest mt-2 ${status.bg} ${status.color}`}>
                                {status.label} SETUP
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-5">
                                <div className="flex items-center gap-2 mb-2 text-emerald-500/60 uppercase font-black text-[9px] tracking-widest">
                                    <TrendingUp size={12} /> Potential Gain
                                </div>
                                <div className="text-xl font-black text-emerald-400 font-display">₹{potentialGain.toLocaleString()}</div>
                                <div className="text-[10px] text-emerald-500/50 font-medium mt-1">+{rewardOfCapital}% Account</div>
                            </div>
                            <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-5">
                                <div className="flex items-center gap-2 mb-2 text-rose-500/60 uppercase font-black text-[9px] tracking-widest">
                                    <TrendingDown size={12} /> Potential Loss
                                </div>
                                <div className="text-xl font-black text-rose-400 font-display">₹{potentialLoss.toLocaleString()}</div>
                                <div className="text-[10px] text-rose-500/50 font-medium mt-1">-{riskOfCapital}% Account</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-void/40 border border-dim rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Position Exposure</span>
                            <span className="text-[10px] font-bold text-white uppercase tracking-widest">₹{(quantity * entry).toLocaleString()}</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-indigo-500" 
                                style={{ width: `${Math.min(100, (quantity * entry / capital) * 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-2">
                             <span className="text-[9px] text-muted font-medium">0%</span>
                             <span className="text-[9px] text-muted font-medium">Leverage: {((quantity * entry) / capital).toFixed(1)}x</span>
                             <span className="text-[9px] text-muted font-medium">100%</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 border-t border-mid bg-void/50 backdrop-blur-md">
                <button 
                    onClick={onClose}
                    className="w-full py-4 bg-white text-slate-900 rounded-2xl font-display font-black text-xs tracking-widest uppercase hover:bg-indigo-500 hover:text-white transition-all shadow-2xl shadow-white/10 active:scale-95"
                >
                    Close Planner
                </button>
            </div>
        </div>
    );
};
