import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

export const MarketRegimeBanner: React.FC = () => {
    const [regime, setRegime] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/regime')
            .then(res => res.json())
            .then(data => {
                setRegime(data.regime);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading || !regime) return null;

    const config: any = {
        'BULLISH': {
            icon: <TrendingUp size={20} />,
            text: 'Dominant Bullish Regime',
            sub: 'Neural networks detecting sustained upward momentum.',
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20',
            glow: 'shadow-[0_0_20px_rgba(16,185,129,0.2)]'
        },
        'BEARISH': {
            icon: <TrendingDown size={20} />,
            text: 'Dominant Bearish Regime',
            sub: 'Neural networks detecting distribution and sell-side pressure.',
            color: 'text-rose-400',
            bg: 'bg-rose-500/10',
            border: 'border-rose-500/20',
            glow: 'shadow-[0_0_20px_rgba(244,63,94,0.2)]'
        },
        'SIDEWAYS': {
            icon: <Minus size={20} />,
            text: 'Range-Bound Regime',
            sub: 'Market in equilibrium. Neural models suggesting scalp-only strategies.',
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/20',
            glow: 'shadow-[0_0_20px_rgba(245,158,11,0.2)]'
        }
    };

    const s = config[regime] || config['SIDEWAYS'];

    return (
        <div className={`w-full p-4 rounded-2xl border ${s.border} ${s.bg} ${s.glow} flex items-center justify-between gap-6 transition-all animate-fade-in`}>
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-void border ${s.border} ${s.color} animate-pulse`}>
                    {s.icon}
                </div>
                <div>
                    <h2 className={`font-display font-black text-sm uppercase tracking-wider ${s.color}`}>
                        {s.text}
                    </h2>
                    <p className="text-muted font-body text-[10px] mt-0.5 uppercase tracking-widest">
                        {s.sub}
                    </p>
                </div>
            </div>
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-void/50 rounded-lg border border-dim">
                <Zap size={12} className="text-cyan animate-pulse" />
                <span className="text-[10px] font-data text-secondary uppercase tracking-[0.2em]">Global Index: NSEI</span>
            </div>
        </div>
    );
};
