import React from 'react';
import { Activity } from 'lucide-react';

interface SignalBadgeProps {
    action: string;
}

export const SignalBadge: React.FC<SignalBadgeProps> = ({ action }) => {
    const config: any = {
        BUY:  { 
            color: 'text-emerald-400', 
            glow: 'glow-emerald', 
            bg: 'bg-emerald-500/10', 
            border: 'border-emerald-500/30', 
            shadow: 'shadow-emerald-500/20',
            gloss: 'from-emerald-400/20'
        },
        SELL: { 
            color: 'text-rose-400', 
            glow: 'glow-rose', 
            bg: 'bg-rose-500/10', 
            border: 'border-rose-500/30', 
            shadow: 'shadow-rose-500/20',
            gloss: 'from-rose-400/20'
        },
        HOLD: { 
            color: 'text-amber-400', 
            glow: 'glow-amber', 
            bg: 'bg-amber-500/10', 
            border: 'border-amber-500/30', 
            shadow: 'shadow-amber-500/20',
            gloss: 'from-amber-400/20'
        }
    };
    const s = config[action] || config.HOLD;
    
    return (
        <div className={`flex flex-col items-center justify-center p-10 rounded-[2.5rem] border-2 ${s.border} ${s.bg} ${s.shadow} shadow-2xl relative overflow-hidden group transition-all duration-700`}>
            {/* Animated Gloss Effect */}
            <div className={`absolute inset-0 bg-gradient-to-tr ${s.gloss} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 rotate-12 -translate-y-full group-hover:translate-y-full`} />
            
            {/* Pulsing Background */}
            <div className={`absolute inset-0 ${s.bg} animate-pulse-glow opacity-40`} />
            
            <span className="text-[10px] font-data text-secondary tracking-[0.5em] uppercase mb-3 relative z-10 font-black opacity-60">Engine Decision</span>
            
            <div className="relative z-10 flex flex-col items-center">
                <h2 className={`text-7xl font-display font-black tracking-tighter ${s.color} ${s.glow} animate-page-in`}>
                    {action}
                </h2>
                
                <div className="mt-6 flex items-center gap-2.5 px-5 py-2 bg-void/60 rounded-full border border-dim backdrop-blur-md">
                    <Activity size={14} className={`${s.color} animate-pulse`} />
                    <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.2em]">Neural Confirmation Sync</span>
                </div>
            </div>

            {/* Corner Accents */}
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${s.gloss} to-transparent opacity-20 blur-2xl`} />
            <div className={`absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr ${s.gloss} to-transparent opacity-20 blur-2xl`} />
        </div>
    );
};
