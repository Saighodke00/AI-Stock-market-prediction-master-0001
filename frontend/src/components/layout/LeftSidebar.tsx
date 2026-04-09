import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, Zap, Search, Triangle, MessageSquare, BookOpen, Settings, Plus, MapPin, Activity } from 'lucide-react';
import { fetchTickerMetadata, TickerMetadata } from '../../api/api';

const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/swing', label: 'Swing Trading', icon: TrendingUp },
    { path: '/intraday', label: 'Intraday', icon: Zap },
    { path: '/screener', label: 'Screener', icon: Search },
    { path: '/patterns', label: 'Patterns', icon: Triangle },
    { path: '/sentiment', label: 'Sentiment', icon: MessageSquare },
    { path: '/paper', label: 'Paper Trading', icon: BookOpen },
    { path: '/tuner', label: 'Hyper Tuner', icon: Settings },
    { path: '/geo', label: 'Geo Map', icon: MapPin },
];

export const LeftSidebar: React.FC = () => {
    const [tickerMetadata, setTickerMetadata] = useState<TickerMetadata | null>(null);

    useEffect(() => {
        fetchTickerMetadata()
            .then(setTickerMetadata)
            .catch(err => console.error("Sidebar metadata load failed", err));
    }, []);

    // Pick top ticker from each sector for the sidebar "Market Pulse" or watchlist
    const watchlist = tickerMetadata ? 
        tickerMetadata.sectors.slice(0, 5).map(sector => ({
            symbol: tickerMetadata.ticker_list[sector][0],
            sector: sector,
            price: '...', // Prices would need another API call, keeping as placeholders or just symbols
            change: 0.0,
            signal: 'NEUTRAL'
        })) : [];

    return (
        <div className="w-[210px] bg-void border-r border-white/5 shrink-0 hidden lg:flex flex-col h-full z-40">
            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto pt-8 pb-4 px-4 custom-scrollbar">
                <div className="mb-8">
                    <h3 className="neon-label px-4 mb-4">Navigation</h3>
                    <ul className="space-y-1.5">
                        {navItems.map((item) => (
                            <li key={item.path}>
                                <NavLink
                                    to={item.path}
                                    className={({ isActive }) => `
                                        flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group
                                        ${isActive 
                                            ? 'bg-cyan/10 border border-cyan/20 text-white shadow-[0_0_15px_rgba(0,210,255,0.05)]' 
                                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'}
                                    `}
                                >
                                    {({ isActive }) => (
                                        <>
                                            <item.icon size={18} className={isActive ? 'text-cyan' : 'group-hover:text-slate-300'} />
                                            <span className="text-[13px] font-semibold tracking-tight">{item.label}</span>
                                        </>
                                    )}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="my-8 border-b border-white/5 mx-2" />

                {/* Market Pulse / Sector List */}
                <div className="px-1">
                    <h3 className="neon-label px-3 mb-5 uppercase tracking-[0.2em] text-[10px]">Market Sectors</h3>
                    <ul className="space-y-4">
                        {tickerMetadata?.sectors.map((sector) => {
                            const firstTicker = tickerMetadata.ticker_list[sector][0];
                            return (
                                <li key={sector} className="px-3 py-1 group cursor-pointer">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-cyan tracking-wider uppercase">{sector}</span>
                                            <Activity size={10} className="text-slate-600 group-hover:text-cyan transition-colors" />
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors uppercase tracking-wider">
                                            {firstTicker.split('.')[0]}
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    <button className="w-full mt-8 py-2.5 border border-dashed border-white/10 rounded-xl text-[10px] font-bold text-slate-600 hover:text-slate-300 hover:border-white/20 hover:bg-white/[0.01] transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                        <Search size={12} /> Explore All
                    </button>
                </div>
            </nav>
        </div>
    );
};

