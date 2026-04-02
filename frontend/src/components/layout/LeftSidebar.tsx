import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, Zap, Search, Triangle, MessageSquare, BookOpen, Settings, Plus } from 'lucide-react';

const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/swing', label: 'Swing Trading', icon: TrendingUp },
    { path: '/intraday', label: 'Intraday', icon: Zap },
    { path: '/screener', label: 'Screener', icon: Search },
    { path: '/patterns', label: 'Patterns', icon: Triangle },
    { path: '/sentiment', label: 'Sentiment', icon: MessageSquare },
    { path: '/paper', label: 'Paper Trading', icon: BookOpen },
    { path: '/tuner', label: 'Hyper Tuner', icon: Settings },
];

const mockWatchlist = [
    { symbol: 'RELIANCE.NS', price: '2,987.50', change: 1.2, signal: 'BUY' },
    { symbol: 'INFY.NS', price: '1,643.20', change: -0.8, signal: 'SELL' },
    { symbol: 'HDFCBANK.NS', price: '1,452.90', change: 0.1, signal: 'HOLD' },
    { symbol: 'TCS.NS', price: '4,102.00', change: 2.4, signal: 'BUY' },
];

const mockMarketPulse = [
    { symbol: 'NIFTY 50', value: '22,147', change: -0.4 },
    { symbol: 'SENSEX', value: '73,058', change: 0.1 },
    { symbol: 'VIX', value: '14.2', change: 2.1 },
];

export const LeftSidebar: React.FC = () => {
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

                {/* Watchlist */}
                <div className="px-1">
                    <h3 className="neon-label px-3 mb-5">Watchlist</h3>
                    <ul className="space-y-3">
                        {mockWatchlist.map((item) => {
                            const isBuy = item.signal === 'BUY';
                            const isSell = item.signal === 'SELL';
                            const indicatorColor = isBuy ? 'bg-emerald' : isSell ? 'bg-rose' : 'bg-amber';
                            const glowColor = isBuy ? 'shadow-[0_0_8px_rgba(16,185,129,0.5)]' : isSell ? 'shadow-[0_0_8px_rgba(244,63,94,0.5)]' : '';
                            
                            return (
                                <li key={item.symbol} className="flex items-center justify-between px-3 py-1 group cursor-pointer">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-1.5 h-1.5 rounded-full ${indicatorColor} ${glowColor} animate-pulse-dot`} />
                                        <span className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors uppercase tracking-wider">{item.symbol.split('.')[0]}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-data font-bold text-white tracking-wider">{item.price}</span>
                                        <span className={`text-[9px] font-black ${item.change >= 0 ? 'text-emerald' : 'text-rose'}`}>
                                            {item.change >= 0 ? '▲' : '▼'} {Math.abs(item.change)}%
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    <button className="w-full mt-6 py-2.5 border border-dashed border-white/10 rounded-xl text-[10px] font-bold text-slate-600 hover:text-slate-300 hover:border-white/20 hover:bg-white/[0.01] transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                        <Plus size={12} /> Add Ticker
                    </button>
                </div>
            </nav>
        </div>
    );
};

