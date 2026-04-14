import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, Zap, Search, Triangle, MessageSquare, BookOpen, Settings, Plus, MapPin, Activity, ShieldAlert, LogOut, User, Newspaper, ChevronRight } from 'lucide-react';
import { fetchTickerMetadata, TickerMetadata } from '../../api/api';
import { useAuthStore } from '../../store/useAuthStore';

const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/swing', label: 'Swing Trading', icon: TrendingUp },
    { path: '/intraday', label: 'Intraday', icon: Zap },
    { path: '/screener', label: 'Screener', icon: Search },
    { path: '/paper', label: 'Paper Trading', icon: BookOpen },
    { path: '/news', label: 'Stock News', icon: Newspaper },
    { path: '/geo', label: 'Geo Map', icon: MapPin },
    { path: '/settings', label: 'Settings', icon: Settings },
];

export const LeftSidebar: React.FC = () => {
    const { user, logout } = useAuthStore();
    const [tickerMetadata, setTickerMetadata] = useState<TickerMetadata | null>(null);

    useEffect(() => {
        fetchTickerMetadata()
            .then(setTickerMetadata)
            .catch(err => console.error("Sidebar metadata load failed", err));
    }, []);

    return (
        <div className="w-[240px] bg-base border-r border-dim shrink-0 hidden lg:flex flex-col h-full z-40 relative">
            {/* Branding Area */}
            <div className="p-6 mb-2">
                <div className="flex items-center gap-2 group cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-cyan/10 border border-cyan/30 flex items-center justify-center text-cyan shadow-lg shadow-cyan/5 group-hover:rotate-12 transition-transform">
                        <Triangle className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                        <span className="font-display font-black text-xl text-primary tracking-tight uppercase leading-none block">
                            APEX <span className="text-cyan">AI</span>
                        </span>
                        <span className="font-data-tiny text-[8px] text-muted uppercase tracking-[0.3em]">Neural Terminal</span>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-2 px-4 custom-scrollbar">
                <div className="mb-8">
                    <div className="px-4 mb-4 flex items-center gap-2">
                        <div className="w-1 h-3 bg-cyan/40 rounded-full" />
                        <h3 className="font-data-tiny text-muted uppercase tracking-[0.2em] font-black">Mainframe Control</h3>
                    </div>
                    <ul className="space-y-1">
                        {navItems.map((item) => (
                            <li key={item.path}>
                                <NavLink
                                    to={item.path}
                                    className={({ isActive }) => `
                                        flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden
                                        ${isActive 
                                            ? 'bg-cyan/5 border border-cyan/20 text-cyan' 
                                            : 'text-muted hover:text-primary hover:bg-white/[0.03]'}
                                    `}
                                >
                                    {({ isActive }) => (
                                        <>
                                            <div className="flex items-center gap-3 relative z-10">
                                                <item.icon size={18} className={isActive ? 'text-cyan glow-cyan' : 'group-hover:text-cyan transition-colors'} />
                                                <span className={`text-[13px] uppercase tracking-wider font-data ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                                            </div>
                                            {isActive && (
                                                <ChevronRight size={14} className="text-cyan animate-pulse" />
                                            )}
                                            {isActive && (
                                                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-cyan shadow-[0_0_10px_#00d2ff]" />
                                            )}
                                        </>
                                    )}
                                </NavLink>
                            </li>
                        ))}

                        {user?.role === 'ADMIN' && (
                            <li key="/admin" className="mt-4 pt-4 border-t border-dim">
                                <NavLink
                                    to="/admin"
                                    className={({ isActive }) => `
                                        flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group
                                        ${isActive 
                                            ? 'bg-rose/10 border border-rose/30 text-rose' 
                                            : 'text-rose/60 hover:text-rose hover:bg-rose/5'}
                                    `}
                                >
                                    {({ isActive }) => (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <ShieldAlert size={18} className={isActive ? 'text-rose glow-rose' : 'group-hover:text-rose'} />
                                                <span className={`text-[13px] uppercase tracking-wider font-data ${isActive ? 'font-bold' : 'font-medium'}`}>Admin Core</span>
                                            </div>
                                            {isActive && (
                                                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-rose shadow-[0_0_10px_#ff4d4d]" />
                                            )}
                                        </>
                                    )}
                                </NavLink>
                            </li>
                        )}
                    </ul>
                </div>
            </nav>

            {/* User Profile */}
            <div className="p-4 bg-white/[0.02] border-t border-dim shrink-0">
                <div className="flex items-center gap-3 mb-4 p-2 rounded-xl border border-transparent hover:border-dim transition-all">
                    <div className="w-10 h-10 rounded-xl bg-cyan/10 border border-cyan/20 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-cyan" />
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold text-primary truncate uppercase font-display tracking-tight">{user?.username || 'OPERATIVE'}</p>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-emerald animate-pulse" />
                            <p className="text-[10px] font-data text-muted truncate uppercase tracking-widest">{user?.role || 'LEVEL_0'}</p>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={() => logout()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose/5 border border-rose/10 text-rose/70 hover:bg-rose hover:text-white hover:border-rose transition-all text-xs font-black uppercase tracking-widest"
                >
                    <LogOut className="w-3.5 h-3.5" /> Disconnect
                </button>
            </div>
        </div>
    );
};
