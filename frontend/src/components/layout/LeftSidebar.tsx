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
        <div className="w-[220px] bg-surface border-r border-dim shrink-0 hidden lg:flex flex-col h-full z-40">

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4">
                <ul className="space-y-1">
                    {navItems.map((item) => (
                        <li key={item.path}>
                            <NavLink
                                to={item.path}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-2 text-sm font-body font-medium transition-colors ${isActive
                                        ? 'border-l-2 border-cyan bg-cyan-dim text-cyan'
                                        : 'border-l-2 border-transparent text-secondary hover:bg-raised hover:text-primary'
                                    }`
                                }
                            >
                                <item.icon size={18} />
                                <span>{item.label}</span>
                            </NavLink>
                        </li>
                    ))}
                </ul>

                <div className="mx-4 mt-6 mb-2 border-b border-dim/50" />

                {/* Watchlist */}
                <div className="px-4 py-2">
                    <h3 className="font-data text-[9px] text-muted tracking-[0.3em] mb-4 uppercase">// WATCHLIST</h3>
                    <ul className="space-y-3">
                        {mockWatchlist.map((item) => {
                            const glowColor = item.signal === 'BUY' ? 'bg-green glow-green' : item.signal === 'SELL' ? 'bg-red glow-red' : 'bg-gold glow-gold';
                            const changeColor = item.change >= 0 ? 'text-green' : 'text-red';
                            return (
                                <li key={item.symbol} className="flex items-center justify-between cursor-pointer group">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${glowColor}`} />
                                        <span className="font-data text-[11px] text-cyan group-hover:text-primary transition-colors">{item.symbol}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="font-data text-[11px] text-primary">₹{item.price}</span>
                                        <span className={`font-data text-[9px] ${changeColor}`}>{item.change > 0 ? '+' : ''}{item.change}%</span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    <button className="w-full mt-4 py-1.5 border border-dashed border-dim rounded text-muted hover:text-cyan hover:border-cyan hover:bg-cyan-dim transition-all flex items-center justify-center gap-1 font-body text-xs">
                        <Plus size={14} /> Add Ticker
                    </button>
                </div>
            </nav>

            {/* Market Pulse (Fixed Bottom) */}
            <div className="p-4 border-t border-dim bg-base/50">
                <div className="space-y-2">
                    {mockMarketPulse.map((item) => {
                        const isPositive = item.change >= 0;
                        const changeColor = isPositive ? 'text-green' : 'text-red';
                        const ArrowOpts = isPositive ? '▲' : '▼';
                        return (
                            <div key={item.symbol} className="flex justify-between items-center font-data text-[11px]">
                                <span className="text-secondary">{item.symbol}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-primary">{item.value}</span>
                                    <span className={`${changeColor} w-10 text-right`}>{ArrowOpts} {item.change > 0 ? '+' : ''}{item.change}%</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
