import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Menu, History, RefreshCw, ChevronDown, Bell } from 'lucide-react';
import Sidebar from './components/Sidebar';
import DashboardView from './views/DashboardView';
import ScreenerView from './views/ScreenerView';
import BacktestView from './views/BacktestView';
import PortfolioView from './views/PortfolioView';
import AboutView from './views/AboutView';
import { APIResponse } from './types';

const INDIAN_TICKERS = ['RELIANCE.NS', 'INFY.NS', 'TCS.NS', 'HDFCBANK.NS', 'WIPRO.NS'];
const US_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'TSLA'];

export default function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [searchInput, setSearchInput] = useState('AAPL');
    const [ticker, setTicker] = useState('AAPL');
    const [signalData, setSignalData] = useState<APIResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Debounced ticker search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchInput.trim()) setTicker(searchInput.toUpperCase().trim());
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
            // Gracefully handle — UI shows mock data
            setError(err.response?.data?.detail || err.message || 'Backend offline — showing demo data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const id = setInterval(fetchData, 5 * 60 * 1000);
        return () => clearInterval(id);
    }, [ticker, activeTab]);

    const signalColor =
        signalData?.signal === 'BUY' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
            : signalData?.signal === 'SELL' ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                : 'text-amber-400 bg-amber-500/10 border-amber-500/30';

    const tabLabels: Record<string, string> = {
        screener: 'Market Scanner',
        backtest: 'Strategy Validator',
        portfolio: 'Paper Trading',
        sentiment: 'FinBERT Engine',
        about: 'Neural Architects',
        settings: 'System Settings',
    };

    return (
        <div className="flex bg-slate-950 text-slate-200 h-screen w-screen overflow-hidden font-sans selection:bg-indigo-500/30 grid-bg">
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                searchInput={searchInput}
                setSearchInput={setSearchInput}
                signalData={signalData}
            />

            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                {/* ── Top Header ────────────────────────────────── */}
                <header className="flex items-center gap-3 px-4 py-0 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-10 h-14 shrink-0">
                    {/* Mobile menu */}
                    <button
                        className="md:hidden text-slate-400 hover:text-white p-1"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    {/* Breadcrumb / Live ticker info */}
                    {activeTab === 'dashboard' ? (
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-600 hidden sm:block">Indian Equities</span>
                                <ChevronDown className="w-3 h-3 text-slate-700 hidden sm:block" />
                            </div>
                            {/* Ticker quick-select pills */}
                            <div className="hidden lg:flex items-center gap-1.5 bg-slate-900/60 border border-slate-800/60 rounded-xl p-1">
                                {[...INDIAN_TICKERS.slice(0, 2), ...US_TICKERS.slice(0, 3)].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setSearchInput(t)}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${ticker === t ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'}`}
                                    >
                                        {t.replace('.NS', '')}
                                    </button>
                                ))}
                            </div>

                            {/* Live ticker display */}
                            {signalData && (
                                <div className="flex items-center gap-2.5 ml-2">
                                    <h2 className="text-sm font-bold text-white tracking-tight">{signalData.ticker}</h2>
                                    <span className="text-base font-black font-mono text-white">
                                        ${signalData.current_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${signalData.pct_change >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                                        {signalData.pct_change >= 0 ? '+' : ''}{signalData.pct_change.toFixed(2)}%
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${signalColor}`}>
                                        ● {signalData.signal}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1">
                            <h2 className="text-sm font-bold text-white">{tabLabels[activeTab] || activeTab}</h2>
                        </div>
                    )}

                    {/* Right controls */}
                    <div className="flex items-center gap-2 ml-auto">
                        {activeTab === 'dashboard' && signalData && (
                            <span className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-600">
                                <History className="w-3 h-3" />
                                {new Date(signalData.last_updated).toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            onClick={fetchData}
                            className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent hover:border-slate-700/40 transition-all"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
                        </button>
                        <button className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent hover:border-slate-700/40 transition-all relative">
                            <Bell className="w-4 h-4" />
                            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                        </button>
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
                            <span className="text-[9px] font-black text-white">AI</span>
                        </div>
                    </div>
                </header>

                {/* ── Content Area ──────────────────────────────── */}
                <div className="flex-1 overflow-hidden">
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
                    {activeTab === 'portfolio' && <PortfolioView />}
                    {activeTab === 'about' && <AboutView />}
                    {activeTab === 'sentiment' && (
                        <div className="flex flex-col items-center justify-center h-full text-center p-12">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center mb-4">
                                <span className="text-2xl">🤖</span>
                            </div>
                            <h3 className="text-sm font-bold text-slate-300 mb-2">FinBERT Deep-Dive</h3>
                            <p className="text-xs text-slate-600 max-w-xs">Dedicated sentiment analysis view coming soon. Use the Dashboard for the FinBERT summary panel.</p>
                        </div>
                    )}
                    {activeTab === 'settings' && (
                        <div className="flex flex-col items-center justify-center h-full text-center p-12">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700/40 to-slate-800/40 border border-slate-700/40 flex items-center justify-center mb-4">
                                <span className="text-2xl">⚙️</span>
                            </div>
                            <h3 className="text-sm font-bold text-slate-300 mb-2">System Settings</h3>
                            <p className="text-xs text-slate-600 max-w-xs">Configuration is managed via the <code className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">.env</code> file on the server. API keys, thresholds, and Redis settings are handled there.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
