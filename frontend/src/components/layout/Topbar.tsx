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
            // IST time
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

    // Market status mock (normally based on IST time)
    const isMarketOpen = true; // Hardcoded for design view

    return (
        <div className="h-[52px] bg-void/80 backdrop-blur-md border-b border-dim shrink-0 flex items-center justify-between px-6 z-50 relative">
            <div className="flex items-center gap-4 min-w-[200px]">
                <div className="flex flex-col">
                    <div className="flex items-baseline gap-1">
                        <span className="font-display font-bold text-xl text-cyan glow-cyan tracking-wider">APEX</span>
                        <span className="font-display text-secondary text-sm">AI</span>
                    </div>
                    <span className="font-data text-[9px] text-muted tracking-[0.2em]">NEURAL TERMINAL V2</span>
                </div>
            </div>

            <div className="flex flex-col items-center">
                <h1 className="font-body font-semibold text-[18px] text-primary tracking-wide leading-tight">{title}</h1>
                <span className="font-data text-[11px] text-cyan tracking-[0.2em]">{breadcrumb}</span>
            </div>

            <div className="flex items-center gap-4 min-w-[200px] justify-end h-full">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isMarketOpen ? 'bg-green glow-green animate-pulse-dot' : 'bg-red'}`} />
                    <span className="font-data text-[11px] text-secondary tracking-wider">
                        {isMarketOpen ? 'NSE LIVE' : 'MARKET CLOSED'}
                    </span>
                </div>

                <div className="w-px h-6 bg-dim" />

                <span className="font-data text-sm text-primary w-[85px] text-right">
                    {time}
                </span>

                <div className="w-px h-6 bg-dim" />

                <button className="text-secondary hover:text-cyan transition-colors">
                    <Settings size={18} />
                </button>
            </div>
        </div>
    );
};
