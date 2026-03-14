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
        <div className="h-[56px] bg-void border-b border-white/5 shrink-0 flex items-center justify-between px-6 z-50 relative">
            <div className="flex items-center gap-4 min-w-[200px]">
                <div className="flex flex-col">
                    <div className="flex items-baseline gap-1.5">
                        <span className="font-display font-black text-xl text-white tracking-tight">APEX</span>
                        <span className="font-display font-medium text-indigo-500 text-sm">AI</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-center">
                <h1 className="font-display font-bold text-base text-white tracking-tight leading-none mb-1">{title}</h1>
                <span className="text-[10px] text-slate-500 font-medium tracking-[0.1em] uppercase font-body">{breadcrumb.replace('// ', '')}</span>
            </div>

            <div className="flex items-center gap-6 min-w-[200px] justify-end h-full">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.05]">
                    <div className={`w-1.5 h-1.5 rounded-full ${isMarketOpen ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)] animate-pulse' : 'bg-rose-500'}`} />
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                        {isMarketOpen ? 'NSE LIVE' : 'OFFLINE'}
                    </span>
                </div>

                <span className="text-xs font-medium text-slate-300 w-[85px] text-right font-body">
                    {time}
                </span>

                <button className="text-slate-500 hover:text-white transition-colors">
                    <Settings size={18} />
                </button>
            </div>
        </div>
    );
};
