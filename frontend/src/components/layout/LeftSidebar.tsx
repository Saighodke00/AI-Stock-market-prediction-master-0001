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
        <div className="w-[240px] bg-void border-r border-white/5 shrink-0 hidden lg:flex flex-col h-full z-40">

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto pt-6 pb-4 px-3">
                <div className="mb-4">
                    <h3 className="text-[10px] font-bold text-slate-600 tracking-[0.1em] px-4 mb-2 uppercase font-body">Navigation</h3>
                    <ul className="space-y-1">
                        {navItems.map((item) => (
                            <li key={item.path}>
                                <NavLink
                                    to={item.path}
                                    className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item'}
                                >
                                    <item.icon size={18} />
                                    <span className="font-medium">{item.label}</span>
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="my-6 border-b border-white/5 mx-2" />

                {/* Watchlist */}
                <div className="px-1">
                    <h3 className="text-[10px] font-bold text-slate-600 tracking-[0.1em] px-3 mb-4 uppercase font-body">Watchlist</h3>
                    <ul className="space-y-1">
                        {mockWatchlist.map((item) => {
                            const indicatorColor = item.signal === 'BUY' ? 'bg-emerald-400' : item.signal === 'SELL' ? 'bg-rose-400' : 'bg-amber-400';
                            const changeColor = item.change >= 0 ? 'text-emerald-400' : 'text-rose-400';
                            return (
                                <li key={item.symbol} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/[0.03] transition-all cursor-pointer group">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${indicatorColor} shadow-[0_0_8px_rgba(0,0,0,0.2)]`} title={item.signal} />
                                        <span className="text-[12px] font-semibold text-slate-300 group-hover:text-white transition-colors">{item.symbol.split('.')[0]}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[12px] font-mono font-bold text-white text-opacity-90">{item.price}</span>
                                        <span className={`text-[10px] font-bold font-body ${changeColor}`}>{item.change > 0 ? '+' : ''}{item.change}%</span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    <button className="w-[calc(100%-16px)] mx-2 mt-4 py-2 border border-dashed border-white/10 rounded-xl text-slate-500 hover:text-white hover:border-white/20 hover:bg-white/[0.02] transition-all flex items-center justify-center gap-2 font-body text-xs font-semibold">
                        <Plus size={14} /> Add Ticker
                    </button>
                </div>
            </nav>

            {/* Market Pulse (Fixed Bottom) */}
            <div className="p-5 border-t border-white/5 bg-void/50 backdrop-blur-sm">
                <div className="space-y-3">
                    {mockMarketPulse.map((item) => {
                        const isPositive = item.change >= 0;
                        const changeColor = isPositive ? 'text-emerald-400' : 'text-rose-400';
                        const ArrowOpts = isPositive ? '▲' : '▼';
                        return (
                            <div key={item.symbol} className="flex justify-between items-center text-[11px] font-body">
                                <span className="text-slate-500 font-medium">{item.symbol}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-white font-mono font-bold opacity-80">{item.value}</span>
                                    <span className={`${changeColor} font-bold min-w-[45px] text-right`}>{ArrowOpts}{item.change > 0 ? '+' : ''}{item.change}%</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
