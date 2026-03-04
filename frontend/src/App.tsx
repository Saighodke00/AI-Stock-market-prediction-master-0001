import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Menu, History } from 'lucide-react';
import Sidebar from './components/Sidebar';
import DashboardView from './views/DashboardView';
import ScreenerView from './views/ScreenerView';
import BacktestView from './views/BacktestView';
import { APIResponse } from './types';

export default function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [searchInput, setSearchInput] = useState('AAPL');
    const [ticker, setTicker] = useState('AAPL');
    const [signalData, setSignalData] = useState<APIResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput.trim()) {
                setTicker(searchInput.toUpperCase().trim());
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const fetchData = async () => {
        if (activeTab !== 'dashboard') return;
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get<APIResponse>(`/api/signal/${ticker}`);
            setSignalData(response.data);
        } catch (err: any) {
            setError(err.response?.data?.detail || err.message || 'Failed to fetch model prediction data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const intervalId = setInterval(fetchData, 5 * 60 * 1000);
        return () => clearInterval(intervalId);
    }, [ticker, activeTab]);

    return (
        <div className="flex bg-gray-950 text-gray-100 min-h-screen font-sans selection:bg-indigo-500/30 overflow-hidden">
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                searchInput={searchInput}
                setSearchInput={setSearchInput}
                signalData={signalData}
            />

            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative">
                {/* Global Header */}
                <header className="flex items-center gap-4 p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-10 h-16 shrink-0">
                    <button className="md:hidden text-gray-400" onClick={() => setSidebarOpen(true)}>
                        <Menu className="w-6 h-6" />
                    </button>

                    {activeTab === 'dashboard' && signalData && (
                        <div className="flex items-center gap-4 animate-in fade-in duration-300">
                            <h2 className="text-xl font-bold text-white tracking-tight">{signalData.ticker}</h2>
                            <span className="text-lg font-medium font-mono">${signalData.current_price.toFixed(2)}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${signalData.pct_change >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                {signalData.pct_change >= 0 ? '+' : ''}{signalData.pct_change.toFixed(2)}%
                            </span>
                            <div className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${signalData.signal === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' :
                                    signalData.signal === 'SELL' ? 'bg-rose-500/20 text-rose-400 border-rose-500/50' :
                                        'bg-gray-500/20 text-gray-300 border-gray-500/50'
                                }`}>
                                {signalData.signal}
                            </div>
                        </div>
                    )}

                    {activeTab !== 'dashboard' && (
                        <h2 className="text-lg font-bold text-white capitalize">{activeTab}</h2>
                    )}

                    {activeTab === 'dashboard' && signalData && (
                        <span className="text-[10px] text-gray-500 ml-auto flex items-center gap-1 hidden sm:flex">
                            <History className="w-3 h-3" /> Updated: {new Date(signalData.last_updated).toLocaleTimeString()}
                        </span>
                    )}
                </header>

                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'dashboard' && (
                        <DashboardView
                            signalData={signalData}
                            loading={loading}
                            error={error}
                            fetchData={fetchData}
                            ticker={ticker}
                        />
                    )}
                    {activeTab === 'screener' && <ScreenerView />}
                    {activeTab === 'backtest' && <BacktestView />}
                    {activeTab === 'sentiment' && (
                        <div className="p-12 text-center text-gray-500 italic">
                            Sentiment Deep-Dive coming soon. Use Dashboard for summary.
                        </div>
                    )}
                    {activeTab === 'settings' && (
                        <div className="p-12 text-center text-gray-500 italic">
                            System Settings are managed via configuration files.
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
