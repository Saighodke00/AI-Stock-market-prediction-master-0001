import React, { useState } from 'react';
import {
    LayoutDashboard, TrendingUp, History, MessageCircle, Settings,
    X, Zap, Brain, ChevronLeft, ChevronRight, BarChart2, Users,
    Search
} from 'lucide-react';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    searchInput: string;
    setSearchInput: (input: string) => void;
    signalData: any;
}

const navItems = [
    { name: 'Dashboard', id: 'dashboard', icon: LayoutDashboard, label: 'Signal Overview' },
    { name: 'Screener', id: 'screener', icon: TrendingUp, label: 'Market Scanner' },
    { name: 'Backtest', id: 'backtest', icon: History, label: 'Strategy Validator' },
    { name: 'Sentiment', id: 'sentiment', icon: MessageCircle, label: 'FinBERT Engine' },
    { name: 'About', id: 'about', icon: Users, label: 'Neural Architects' },
];

const bottomItems = [
    { name: 'Settings', id: 'settings', icon: Settings },
];

export default function Sidebar({
    activeTab,
    setActiveTab,
    sidebarOpen,
    setSidebarOpen,
    searchInput,
    setSearchInput,
    signalData
}: SidebarProps) {
    const [collapsed, setCollapsed] = useState(false);

    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className={`flex items-center mb-8 px-2 ${collapsed ? 'justify-center' : 'justify-between'}`}>
                {!collapsed && (
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Brain className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-white tracking-widest uppercase">Apex AI</h1>
                            <p className="text-[9px] text-slate-500 tracking-widest uppercase">Trading Intelligence</p>
                        </div>
                    </div>
                )}
                {collapsed && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <Brain className="w-4 h-4 text-white" />
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="hidden md:flex p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-all"
                >
                    {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                </button>
            </div>

            {/* Search */}
            {!collapsed && (
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="AAPL, RELIANCE.NS..."
                        className="w-full bg-slate-900/80 border border-slate-700/60 rounded-xl pl-8 pr-3 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/70 focus:bg-slate-900 transition-all uppercase tracking-wider"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                    />
                </div>
            )}

            {/* Market Cat */}
            {!collapsed && (
                <div className="mb-5">
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2 px-1">Market</p>
                    <div className="flex gap-1.5">
                        {['US', 'India', 'Crypto'].map((m, i) => (
                            <button
                                key={m}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all tracking-wide ${i === 0
                                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
                                    }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Navigation */}
            {!collapsed && <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2 px-1">Navigation</p>}
            <nav className="space-y-1 flex-1">
                {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                            title={collapsed ? item.name : undefined}
                            className={`group w-full flex items-center gap-3 rounded-xl transition-all duration-150 relative overflow-hidden
                                ${collapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5'}
                                ${isActive
                                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                                }`}
                        >
                            {isActive && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r-full" />
                            )}
                            <item.icon className={`shrink-0 transition-colors ${collapsed ? 'w-5 h-5' : 'w-4 h-4'} ${isActive ? 'text-indigo-400' : ''}`} />
                            {!collapsed && (
                                <div className="text-left min-w-0">
                                    <p className="text-xs font-medium leading-none">{item.name}</p>
                                    <p className="text-[10px] text-slate-600 mt-0.5">{item.label}</p>
                                </div>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Bottom Settings */}
            <div className="mt-4 space-y-1 border-t border-slate-800/80 pt-4">
                {bottomItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        title={collapsed ? item.name : undefined}
                        className={`w-full flex items-center gap-3 rounded-xl transition-all px-3 py-2.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent ${collapsed ? 'justify-center' : ''}`}
                    >
                        <item.icon className="w-4 h-4 shrink-0" />
                        {!collapsed && <span className="text-xs font-medium">{item.name}</span>}
                    </button>
                ))}

                {/* AI Core Status */}
                <div className={`mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 ${collapsed ? 'p-2 flex justify-center' : 'p-3'}`}>
                    {collapsed ? (
                        <div className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot" />
                    ) : (
                        <div className="flex items-center gap-2.5">
                            <div className="relative flex-shrink-0">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot" />
                                <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-30" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-emerald-400 leading-none">AI Core: Online</p>
                                <p className="text-[9px] text-slate-600 mt-0.5">TFT Model Loaded</p>
                            </div>
                            <Zap className="w-3 h-3 text-emerald-500 ml-auto" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            <aside className={`
                fixed inset-y-0 left-0 z-50 bg-slate-950/95 backdrop-blur-xl border-r border-slate-800/60 
                transition-all duration-300 ease-in-out flex-shrink-0
                md:static md:translate-x-0
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                ${collapsed ? 'w-16' : 'w-60'}
            `}>
                {/* Close button mobile */}
                <button
                    className="absolute top-4 right-4 md:hidden text-slate-400 hover:text-white p-1"
                    onClick={() => setSidebarOpen(false)}
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="h-full overflow-y-auto p-4">
                    <SidebarContent />
                </div>
            </aside>
        </>
    );
}
