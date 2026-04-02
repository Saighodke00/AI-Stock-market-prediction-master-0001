import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const getPageTitle = (pathname: string): { title: string, breadcrumb: string } => {
    switch (pathname) {
        case '/': return { title: 'Dashboard', breadcrumb: '// COMMAND CENTRE' };
        case '/swing': return { title: 'Swing Trading', breadcrumb: '// SWING TRADING' };
        case '/intraday': return { title: 'Intraday Trading', breadcrumb: '// INTRADAY' };
        case '/screener': return { title: 'Screener', breadcrumb: '// SCREENER' };
        case '/patterns': return { title: 'Pattern Intelligence', breadcrumb: '// PATTERNS' };
        case '/sentiment': return { title: 'Sentiment Deep-Dive', breadcrumb: '// SENTIMENT' };
        case '/paper': return { title: 'Paper Trading', breadcrumb: '// PAPER TRADING' };
        case '/tuner': return { title: 'Hyper Tuner', breadcrumb: '// HYPER TUNER' };
        default: return { title: 'Dashboard', breadcrumb: '// COMMAND CENTRE' };
    }
};

export const Topbar: React.FC = () => {
    const [time, setTime] = useState<string>('');
    const location = useLocation();

    useEffect(() => {
        const updateTime = () => {
            const formatter = new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            setTime(formatter.format(new Date()) + ' IST');
        };
        updateTime();
        const timer = setInterval(updateTime, 1000);
        return () => clearInterval(timer);
    }, []);

    const { title, breadcrumb } = getPageTitle(location.pathname);
    const isMarketOpen = true;

    return (
        <div className="h-[64px] bg-void border-b border-white/5 shrink-0 flex items-center justify-between px-8 z-50 relative">
            {/* Left: Branding */}
            <div className="flex items-center gap-4 min-w-[240px]">
                <div className="flex items-baseline gap-1.5 group cursor-pointer">
                    <span className="font-display font-black text-xl text-white tracking-tighter transition-all group-hover:glow-cyan">APEX</span>
                    <span className="font-display font-medium text-cyan text-sm tracking-widest">AI</span>
                </div>
            </div>

            {/* Center: Command Centre Title */}
            <div className="flex flex-col items-center">
                <h1 className="font-display font-extrabold text-base text-white tracking-[0.05em] leading-none mb-1.5 uppercase">{title}</h1>
                <div className="flex items-center gap-2">
                    <div className="h-px w-4 bg-white/10" />
                    <span className="text-[9px] text-slate-500 font-bold tracking-[0.3em] uppercase font-data">{breadcrumb.replace('// ', '')}</span>
                    <div className="h-px w-4 bg-white/10" />
                </div>
            </div>

            {/* Right: Status & Time */}
            <div className="flex items-center gap-8 min-w-[240px] justify-end">
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-surface/40 border border-white/5 shadow-inner">
                    <div className={`w-1.5 h-1.5 rounded-full ${isMarketOpen ? 'bg-emerald shadow-[0_0_10px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-rose'}`} />
                    <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">
                        {isMarketOpen ? 'NSE LIVE' : 'OFFLINE'}
                    </span>
                </div>

                <div className="flex flex-col items-end">
                    <span className="text-[11px] font-bold text-slate-200 font-data tracking-wider tabular-nums">
                        {time}
                    </span>
                </div>

                <button className="text-slate-500 hover:text-white transition-all hover:rotate-90 duration-500">
                    <Settings size={18} />
                </button>
            </div>
        </div>
    );

};
