import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, Zap, Search, Triangle, MessageSquare, BookOpen, Settings, Plus, MapPin, Activity, ShieldAlert, LogOut, User } from 'lucide-react';
import { fetchTickerMetadata, TickerMetadata } from '../../api/api';
import { useAuthStore } from '../../store/useAuthStore';

const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/swing', label: 'Swing Trading', icon: TrendingUp },
    { path: '/intraday', label: 'Intraday', icon: Zap },
    { path: '/screener', label: 'Screener', icon: Search },
    { path: '/paper', label: 'Paper Trading', icon: BookOpen },
    { path: '/tuner', label: 'Hyper Tuner', icon: Settings },
    { path: '/geo', label: 'Geo Map', icon: MapPin },
];

export const LeftSidebar: React.FC = () => {
    const { user, logout } = useAuthStore();
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

                        {user?.role === 'ADMIN' && (
                            <li key="/admin">
                                <NavLink
                                    to="/admin"
                                    className={({ isActive }) => `
                                        flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group
                                        ${isActive 
                                            ? 'bg-red-500/10 border border-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]' 
                                            : 'text-red-500/70 hover:text-red-400 hover:bg-red-500/5'}
                                    `}
                                >
                                    {({ isActive }) => (
                                        <>
                                            <ShieldAlert size={18} className={isActive ? 'text-red-400' : 'group-hover:text-red-400'} />
                                            <span className="text-[13px] font-semibold tracking-tight">Admin System</span>
                                        </>
                                    )}
                                </NavLink>
                            </li>
                        )}
                    </ul>
                </div>

            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-white/5 bg-[#0d1320]/50 shrink-0">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-semibold text-gray-200 truncate">{user?.username || 'GUEST'}</p>
                        <p className="text-xs text-gray-500 truncate">{user?.role || 'UNAUTHORIZED'}</p>
                    </div>
                </div>
                <button 
                    onClick={() => logout()}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
                >
                    <LogOut className="w-4 h-4" /> Logout
                </button>
            </div>
        </div>
    );
};

