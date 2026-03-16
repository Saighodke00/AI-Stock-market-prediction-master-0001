import React, { useState, useEffect } from 'react';
import { Search, Zap, TrendingUp, TrendingDown, Minus, Target, Cpu } from 'lucide-react';
import { NeuralSpinner } from '../components/ui/LoadingStates';

interface Pattern {
    name: string;
    type: string;
    strength: number;
}

export const PatternsPage: React.FC = () => {
    const [ticker, setTicker] = useState('RELIANCE');
    const [data, setData] = useState<{ patterns: Pattern[] } | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchPatterns = async () => {
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:8000/api/patterns/${ticker}`);
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPatterns();
    }, []);

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8 animate-page-in">
            <div className="flex flex-col gap-2 relative z-10">
                <h1 className="text-4xl font-display font-black text-white tracking-wider inline-block uppercase bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent">Pattern Intelligence</h1>
                <p className="text-slate-500 font-data text-xs tracking-[0.3em] uppercase">// NEURAL GEOMETRY & CANDLESTICK SIGNATURE DETECTION</p>
            </div>

            <div className="flex gap-4 relative z-10">
                <div className="relative flex-1 max-w-md group">
                    <input
                        type="text"
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && fetchPatterns()}
                        className="w-full bg-void/50 border border-white/10 rounded-2xl px-12 py-4 font-display font-bold text-white focus:outline-none focus:border-cyan-500/50 transition-all uppercase placeholder-slate-700 backdrop-blur-xl"
                        placeholder="ENTER TICKER..."
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-cyan-400 transition-colors" size={18} />
                </div>
                <button
                    onClick={fetchPatterns}
                    className="px-8 py-4 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-2xl font-display font-black text-xs tracking-[0.2em] uppercase hover:bg-cyan-500 hover:text-white transition-all shadow-lg shadow-cyan-500/10"
                >
                    INITIATE SCAN
                </button>
            </div>

            {loading ? (
                <div className="py-40 flex flex-col items-center justify-center gap-8 relative z-10">
                    <div className="relative">
                        <NeuralSpinner />
                        <div className="absolute -inset-4 bg-cyan-500/20 blur-2xl animate-pulse -z-10" />
                    </div>
                    <p className="text-cyan-400/60 font-data text-[10px] tracking-[0.4em] animate-pulse uppercase">Deconstructing Price Action Architecture...</p>
                </div>
            ) : data && (
                <div className="space-y-6 relative z-10">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Buffer Sync: {new Date().toLocaleTimeString()}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{data.patterns.length} DETECTIONS</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {data.patterns.length > 0 ? (
                            data.patterns.map((p, i) => (
                                <div key={i} className="glass-card hover:translate-x-1 hover:border-cyan-500/30 p-6 flex flex-col gap-6 border-l-4 border-l-cyan-500 group transition-all duration-500">
                                    <div className="flex justify-between items-start">
                                        <div className="p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-500">
                                            <Target size={24} className="text-cyan-400" />
                                        </div>
                                        <div className={`px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest uppercase border ${
                                            p.type === 'Bullish' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                            p.type === 'Bearish' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                                            'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                        }`}>
                                            {p.type} Signal
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-display font-black text-white mb-3 tracking-tight group-hover:text-cyan-400 transition-colors uppercase">{p.name}</h3>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confidence Index</span>
                                                <span className="text-xs font-mono font-bold text-cyan-400">{Math.round(p.strength * 100)}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-void rounded-full overflow-hidden border border-white/5 relative">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] animate-shimmer bg-[length:200%_100%] transition-all duration-1000" 
                                                    style={{ width: `${p.strength * 100}%` }} 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full py-24 text-center bg-white/[0.02] border border-white/5 border-dashed rounded-[2rem] backdrop-blur-sm animate-in fade-in duration-1000">
                                <div className="relative inline-block mb-6">
                                    <Cpu size={48} className="text-slate-700 mx-auto opacity-40 animate-pulse" />
                                    <div className="absolute -inset-4 bg-indigo-500/5 blur-xl rounded-full" />
                                </div>
                                <h3 className="text-white font-display font-black text-xl mb-3 uppercase tracking-tight">Vapor Geometry</h3>
                                <div className="flex justify-center gap-2 mb-4">
                                    <div className="h-1 w-8 bg-white/5 rounded-full shimmer" />
                                    <div className="h-1 w-12 bg-white/5 rounded-full shimmer" />
                                </div>
                                <p className="text-slate-600 font-body text-[10px] font-bold max-w-sm mx-auto leading-relaxed tracking-widest uppercase opacity-60">
                                    The neural network analyzed the last 30 temporal vectors but identified zero high-confidence geometric signatures for {ticker}.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
