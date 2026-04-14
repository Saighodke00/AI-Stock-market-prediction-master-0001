import React, { useState, useEffect } from 'react';
import { Settings, Cpu, Shield, Zap, Globe } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const getPageTitle = (pathname: string): { title: string, breadcrumb: string } => {
    switch (pathname) {
        case '/': return { title: 'Dashboard', breadcrumb: 'COMMAND CENTRE' };
        case '/swing': return { title: 'Swing Trading', breadcrumb: 'SWING TRADING' };
        case '/intraday': return { title: 'Intraday Trading', breadcrumb: 'INTRADAY' };
        case '/screener': return { title: 'Screener', breadcrumb: 'SCREENER' };
        case '/patterns': return { title: 'Pattern Intelligence', breadcrumb: 'PATTERNS' };
        case '/sentiment': return { title: 'Sentiment Deep-Dive', breadcrumb: 'SENTIMENT' };
        case '/paper': return { title: 'Paper Trading', breadcrumb: 'PAPER TRADING' };
        case '/news': return { title: 'Stock Intelligence', breadcrumb: 'STOCK NEWS' };
        case '/tuner': return { title: 'Hyper Tuner', breadcrumb: 'HYPER TUNER' };
        case '/settings': return { title: 'Master Settings', breadcrumb: 'PREFERENCES' };
        case '/geo': return { title: 'Geo Intelligence', breadcrumb: 'NODAL MAP' };
        case '/admin': return { title: 'System Admin', breadcrumb: 'ROOT ACCESS' };
        default: return { title: 'Dashboard', breadcrumb: 'COMMAND CENTRE' };
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
    const isMarketOpen = true; // Hardcoded or dynamic via status API

    return (
        <div className="h-[64px] bg-base border-b border-dim shrink-0 flex items-center justify-between px-8 z-50 relative">
            {/* Left: Terminal Status */}
            <div className="flex items-center gap-6 min-w-[300px]">
                <div className="flex items-center gap-2 px-3 py-1 rounded bg-white/5 border border-dim shadow-inner">
                    <div className="w-1 h-1 rounded-full bg-cyan animate-pulse shadow-[0_0_5px_#00d2ff]" />
                    <span className="font-data-tiny text-[8px] text-muted uppercase tracking-[0.2em]">Connection: STABLE</span>
                </div>
                
                <div className="hidden xl:flex items-center gap-4">
                    <div className="flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity cursor-help">
                        <Cpu size={12} className="text-muted" />
                        <span className="font-data-tiny text-[8px] text-muted uppercase">Neural Core v3.0</span>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-40 hover:opacity-100 transition-opacity cursor-help">
                        <Shield size={12} className="text-emerald" />
                        <span className="font-data-tiny text-[8px] text-muted uppercase">Protected</span>
                    </div>
                </div>
            </div>

            {/* Center: Command Centre Title */}
            <div className="flex flex-col items-center">
                <div className="flex items-center gap-3">
                    <div className="h-px w-6 bg-cyan/20" />
                    <h1 className="font-display font-black text-sm text-primary tracking-[0.1em] uppercase leading-none">
                        {title}
                    </h1>
                    <div className="h-px w-6 bg-cyan/20" />
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                    <span className="text-[8px] text-muted font-bold tracking-[0.3em] uppercase font-data">{breadcrumb}</span>
                </div>
            </div>

            {/* Right: Status & Time */}
            <div className="flex items-center gap-8 min-w-[300px] justify-end">
                <div className="flex items-center gap-4 px-4 py-1.5 rounded-xl bg-base border border-dim shadow-xl backdrop-blur-md">
                    <div className="flex items-center gap-2 border-r border-dim pr-4 mr-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${isMarketOpen ? 'bg-emerald shadow-[0_0_8px_currentColor] animate-pulse' : 'bg-rose shadow-[0_0_8px_currentColor]'}`} />
                        <span className="font-data-tiny text-[8px] font-black text-muted tracking-widest uppercase">
                            {isMarketOpen ? 'NSE LIVE' : 'NSE CLOSED'}
                        </span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="font-data font-bold text-primary text-[10px] tracking-widest tabular-nums">
                            {time}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button className="p-2 rounded-lg bg-white/5 border border-dim text-muted hover:text-cyan hover:border-cyan hover:glow-cyan transition-all hover:rotate-90 duration-500">
                        <Settings size={16} />
                    </button>
                </div>
            </div>
        </div>
    );

};
