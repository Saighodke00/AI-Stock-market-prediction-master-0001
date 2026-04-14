import React from 'react';
import { Layers, CheckSquare, Square, Zap, FilterX, ChevronRight } from 'lucide-react';

export const SECTOR_COLORS: Record<string, string> = {
    IT: '#8b5cf6',
    Banking: '#3b82f6',
    Pharma: '#ef4444',
    Auto: '#f59e0b',
    Energy: '#10b981',
    Metals: '#6b7280',
    FMCG: '#ec4899',
    Infrastructure: '#14b8a6',
    Consumer: '#f97316',
    Telecom: '#06b6d4',
    Chemicals: '#a3e635',
    Realty: '#fbbf24'
};

interface Props {
    activeSectors: string[];
    onToggle: (sector: string) => void;
}

const GeoSectorFilter: React.FC<Props> = ({ activeSectors, onToggle }) => {
    const sectors = Object.keys(SECTOR_COLORS);

    return (
        <div
            className="neural-hud custom-scrollbar animate-in slide-in-from-left duration-700"
            style={{
                position: 'absolute',
                top: 70,
                left: 12,
                zIndex: 1000,
                borderRadius: 16,
                padding: '16px',
                width: 200,
                maxHeight: 'calc(100vh - 100px)',
                overflowY: 'auto',
                background: 'rgba(6, 11, 20, 0.9)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.05)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
            }}
        >
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-dim">
                <Layers size={12} className="text-cyan-400" />
                <span className="text-[9px] font-black text-white uppercase tracking-[0.2em] font-mono whitespace-nowrap">
                   Sector_Layers
                </span>
            </div>

            <div className="space-y-2">
                {sectors.map((sector) => {
                    const isActive = activeSectors.includes(sector);
                    return (
                        <div
                            key={sector}
                            onClick={() => onToggle(sector)}
                            className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-300 ${
                                isActive ? 'bg-white/[0.03] border-mid' : 'opacity-40 grayscale hover:opacity-70'
                            } border border-transparent hover:border-dim`}
                        >
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-2 h-2 rounded-full transition-all duration-500"
                                    style={{
                                        background: SECTOR_COLORS[sector],
                                        boxShadow: isActive ? `0 0 8px ${SECTOR_COLORS[sector]}` : 'none',
                                        transform: isActive ? 'scale(1.1)' : 'scale(1)'
                                    }}
                                />
                                <span className={`text-[10px] font-bold uppercase tracking-tight transition-colors ${isActive ? 'text-white' : 'text-muted'}`}>
                                    {sector}
                                </span>
                            </div>
                            
                            {isActive ? (
                                <Zap size={10} className="text-cyan-400 opacity-60 group-hover:opacity-100" />
                            ) : (
                                <ChevronRight size={10} className="text-slate-700" />
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 pt-6 border-t border-dim flex flex-col gap-3">
                <button
                    onClick={() => sectors.forEach((s) => { if (!activeSectors.includes(s)) onToggle(s); })}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-cyan-500/20 transition-all group"
                >
                    <CheckSquare size={12} className="group-hover:scale-110 transition-transform" />
                    Activate All
                </button>
                <button
                    onClick={() => sectors.forEach((s) => { if (activeSectors.includes(s)) onToggle(s); })}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-500/20 transition-all group"
                >
                    <FilterX size={12} className="group-hover:rotate-12 transition-transform" />
                    Clear Shield
                </button>
            </div>

            <div className="mt-8 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                <p className="text-[8px] text-muted font-bold uppercase leading-relaxed tracking-tight text-center">
                    Neural layer system v4.0. Filtering active for regional cluster isolation.
                </p>
            </div>
        </div>
    );
};

export default GeoSectorFilter;
