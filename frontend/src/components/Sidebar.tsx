import React from 'react';
import {
    LayoutDashboard, MonitorPlay, History, MessageSquare,
    Settings, X, MonitorPlay as LogoIcon
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

export default function Sidebar({
    activeTab,
    setActiveTab,
    sidebarOpen,
    setSidebarOpen,
    searchInput,
    setSearchInput,
    signalData
}: SidebarProps) {
    const navItems = [
        { name: 'Dashboard', id: 'dashboard', icon: LayoutDashboard },
        { name: 'Screener', id: 'screener', icon: MonitorPlay },
        { name: 'Backtest', id: 'backtest', icon: History },
        { name: 'Sentiment', id: 'sentiment', icon: MessageSquare },
        { name: 'Settings', id: 'settings', icon: Settings },
    ];

    return (
        <>
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 transition-transform duration-300 ease-in-out md:static md:translate-x-0
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="flex flex-col h-full p-4">
                    <div className="flex items-center justify-between mb-8">
                        <h1 className="text-2xl font-bold text-emerald-400 tracking-wider flex items-center gap-2 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                            <LogoIcon className="w-6 h-6 text-emerald-500" />
                            APEX AI
                        </h1>
                        <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="relative mb-8 text-gray-400 focus-within:text-white transition-colors">
                        <input
                            type="text"
                            placeholder="Search Ticker..."
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500 transition-all uppercase placeholder:normal-case shadow-inner"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                    </div>

                    <nav className="space-y-2 mb-auto text-sm font-medium">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setActiveTab(item.id);
                                    setSidebarOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === item.id
                                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                        : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800/50'
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.name}
                            </button>
                        ))}
                    </nav>

                    {/* Model Status Card */}
                    <div className="mt-8 bg-gray-950 p-4 rounded-xl border border-gray-800 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500/20"></div>
                        <p className="text-xs text-gray-500 uppercase font-semibold mb-3 tracking-wider">Model Status</p>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-400">Regime</span>
                            <span className={`text-sm font-semibold flex items-center gap-1 ${signalData?.regime === 'Bull' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {signalData?.regime || 'Tracking'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-400">Confidence Thresh</span>
                            <span className="text-sm font-medium text-white">0.75</span>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}
