import React from 'react';
import { CheckCircle2, XCircle, LucideIcon } from 'lucide-react';

interface GateCardProps {
    label: string;
    passed: boolean;
    title: string;
    icon: LucideIcon;
}

export const GateCard: React.FC<GateCardProps> = ({ label, passed, title, icon: Icon }) => (
    <div 
        className={`flex flex-col gap-4 p-5 rounded-2xl bg-surface border transition-all duration-300 group hover:-translate-y-1 ${passed ? 'border-emerald-500/10 hover:border-emerald-500/30' : 'border-rose-500/10 hover:border-rose-500/30'}`} 
        title={title}
    >
        <div className="flex justify-between items-start">
            <div className={`p-2.5 rounded-xl bg-void border transition-all duration-500 ${passed ? 'text-emerald-400 border-emerald-500/20 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'text-rose-400 border-rose-500/20 group-hover:shadow-[0_0_15px_rgba(244,63,94,0.2)]'}`}>
                <Icon size={20} />
            </div>
            <div className={`p-1 rounded-full ${passed ? 'bg-emerald-500/10' : 'bg-rose-500/10'} border border-white/5`}>
                {passed 
                    ? <CheckCircle2 size={14} className="text-emerald-400 animate-in zoom-in duration-500" /> 
                    : <XCircle size={14} className="text-rose-400 animate-in zoom-in duration-500" />
                }
            </div>
        </div>
        <div>
            <h4 className="font-display font-black text-xs text-white uppercase tracking-tight mb-1">{label}</h4>
            <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                <div className={`w-1 h-1 rounded-full ${passed ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                {passed ? 'Neural Pass Verified' : 'Logic Gate Fault'}
            </div>
        </div>
    </div>
);
