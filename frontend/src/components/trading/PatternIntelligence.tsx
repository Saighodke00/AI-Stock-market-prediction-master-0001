import React, { useState, useEffect } from 'react';
import { Target, Cpu, ShieldCheck } from 'lucide-react';
import { fetchPatterns, Pattern } from '../../api/api';

interface PatternIntelligenceProps {
    ticker: string;
    mode: 'swing' | 'intraday';
    patterns?: Pattern[];
}

export const PatternIntelligence: React.FC<PatternIntelligenceProps> = ({ ticker, mode, patterns: propPatterns }) => {
    const [fetchedPatterns, setFetchedPatterns] = useState<Pattern[]>([]);
    const [loading, setLoading] = useState(false);

    const patterns = propPatterns || fetchedPatterns;

    useEffect(() => {
        if (propPatterns) return; // Don't fetch if provided via props
        
        const loadPatterns = async () => {
            setLoading(true);
            try {
                const res = await fetchPatterns(ticker, mode);
                setFetchedPatterns(res.patterns);
            } catch (err) {
                console.error("Patterns load failed", err);
            } finally {
                setLoading(false);
            }
        };
        loadPatterns();
    }, [ticker, mode, propPatterns]);

    if (loading) {
        return (
            <div className="p-10 flex flex-col items-center justify-center gap-4 bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse">
                <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
                <span className="text-[10px] font-black text-cyan-400/60 tracking-[0.3em] uppercase">Scanning Geometry...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-slate-500" />
                    <h3 className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase font-body">Geometric Signatures</h3>
                </div>
                <span className="text-[9px] font-black text-slate-600 tracking-widest uppercase">{patterns.length} DETECTIONS</span>
            </div>

            <div className="flex flex-col gap-3">
                {patterns.length > 0 ? (
                    patterns.map((p, i) => (
                        <div key={i} className="bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-cyan-500/20 p-4 rounded-xl transition-all duration-300 group">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex flex-col">
                                    <h4 className="text-sm font-display font-black text-white group-hover:text-cyan-400 transition-colors tracking-tight uppercase">{p.name}</h4>
                                    <p className={`text-[9px] font-black tracking-widest uppercase mt-0.5 ${
                                        p.type === 'Bullish' ? 'text-emerald-400' : 
                                        p.type === 'Bearish' ? 'text-rose-400' : 
                                        'text-amber-400'
                                    }`}>
                                        {p.type} Setup
                                    </p>
                                </div>
                                <div className="p-2 bg-white/[0.03] rounded-lg border border-white/5">
                                    <span className="text-lg">{p.emoji || '📐'}</span>
                                </div>
                            </div>

                            {p.description && (
                                <p className="text-[11px] text-slate-400 mb-3 leading-relaxed font-body italic">
                                    {p.description}
                                </p>
                            )}
                            
                            {(p.target || p.breakout) && (
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    {p.breakout && (
                                        <div className="bg-void/50 p-2 rounded border border-white/5">
                                            <div className="text-[8px] text-slate-600 uppercase tracking-tighter mb-0.5">Level</div>
                                            <div className="text-xs font-data text-white">₹{p.breakout.toLocaleString()}</div>
                                        </div>
                                    )}
                                    {p.target && (
                                        <div className="bg-cyan-500/5 p-2 rounded border border-cyan-500/10">
                                            <div className="text-[8px] text-cyan-500/60 uppercase tracking-tighter mb-0.5">Target</div>
                                            <div className="text-xs font-data text-cyan-400">₹{p.target.toLocaleString()}</div>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-[9px] font-black text-slate-600 uppercase tracking-widest">
                                    <span>Signal Confidence</span>
                                    <span>{Math.round(p.strength * 100)}%</span>
                                </div>
                                <div className="h-1 w-full bg-void rounded-full overflow-hidden border border-white/5">
                                    <div 
                                        className={`h-full bg-gradient-to-r animate-shimmer bg-[length:200%_100%] ${
                                            p.type === 'Bullish' ? 'from-emerald-600 to-emerald-400' :
                                            p.type === 'Bearish' ? 'from-rose-600 to-rose-400' :
                                            'from-cyan-600 to-cyan-400'
                                        }`} 
                                        style={{ width: `${p.strength * 100}%` }} 
                                    />
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-12 text-center bg-white/[0.01] border border-white/5 border-dashed rounded-2xl">
                        <Cpu size={24} className="text-slate-800 mx-auto mb-4 opacity-50" />
                        <h4 className="text-white/60 font-display font-black text-xs mb-1 uppercase">Zero Signature</h4>
                        <p className="text-slate-600 font-body text-[9px] font-bold tracking-widest uppercase px-6 leading-relaxed">
                            No high-probability technical patterns detected for {ticker} in the current vector.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
