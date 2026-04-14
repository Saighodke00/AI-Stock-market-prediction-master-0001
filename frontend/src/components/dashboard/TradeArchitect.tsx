import React from 'react';
import { ChevronRight, CircleDot } from 'lucide-react';

export const TradeArchitect: React.FC = () => {
    return (
        <div className="mx-10 mt-6 group cursor-pointer transition-all duration-500">
            <div className="flex items-center justify-between px-6 py-4 bg-surface/30 backdrop-blur-md border border-dim rounded-2xl hover:bg-surface/50 hover:border-mid transition-all shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 group-hover:scale-110 transition-transform duration-500">
                        <CircleDot className="w-5 h-5 text-indigo-400 animate-pulse" />
                    </div>
                    <div className="flex items-center gap-2">
                        <h2 className="font-display font-black text-white text-sm tracking-[0.4em] uppercase">
                            Trade Architect
                        </h2>
                        <span className="text-[10px] font-data text-muted font-bold tracking-widest opacity-60">/ V3.0</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-4 px-4 py-1.5 bg-white/5 rounded-full border border-dim">
                        <span className="text-[8px] font-data text-emerald glow-emerald font-bold uppercase tracking-widest animate-pulse">Neural Genesis: Active</span>
                        <div className="h-1 w-12 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: '85%' }} />
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted group-hover:text-white transition-colors group-hover:translate-x-1 duration-500" />
                </div>
            </div>
        </div>
    );
};
