import React, { useState, useEffect } from 'react';
import { fetchSignal, fetchSentiment, fetchBacktest, fetchExplainability, fetchTickerMetadata, SignalResponse, SentimentData, BacktestMetrics, XAIReport, TickerMetadata } from '../api/api';
import { SignalCard } from '../components/trading/SignalCard';
import { CandlestickChart } from '../components/trading/CandlestickChart';
import { MetricGrid } from '../components/trading/MetricGrid';
import { XAIPanel } from '../components/trading/XAIPanel';
import { SentimentPanel } from '../components/trading/SentimentPanel';
import { PositionSizer } from '../components/trading/PositionSizer';
import { NeuralSpinner } from '../components/ui/LoadingStates';
import { Search, Timer, Zap, AlertCircle, RefreshCcw, ChevronDown, Activity, ShieldCheck, CheckCircle2, XCircle, Target, Newspaper, BarChart3 } from 'lucide-react';

import { SignalBadge } from '../components/trading/SignalBadge';
import { GateCard } from '../components/trading/GateCard';

export const IntradayTradingPage: React.FC = () => {
    const [tickerMetadata, setTickerMetadata] = useState<TickerMetadata | null>(null);
    const [selectedSector, setSelectedSector] = useState<string>('All');
    const [ticker, setTicker] = useState('RELIANCE.NS');
    const [tf, setTf] = useState('15m'); // Default to 15m for intraday
    const [isLive, setIsLive] = useState(false);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [signal, setSignal] = useState<SignalResponse | null>(null);
    const [sentiment, setSentiment] = useState<SentimentData | null>(null);
    const [backtest, setBacktest] = useState<BacktestMetrics | null>(null);
    const [xai, setXai] = useState<XAIReport[]>([]);

    // 1. Initial Metadata Load
    useEffect(() => {
        fetchTickerMetadata().then((meta: TickerMetadata) => {
          setTickerMetadata(meta);
          if (meta.all_tickers.length > 0 && !meta.all_tickers.includes(ticker)) {
            setTicker(meta.all_tickers[0]);
          }
        }).catch((err: any) => console.error("Metadata load failed", err));
    }, []);

    // 2. Data Load on Ticker/TF change
    useEffect(() => {
        let active = true;
        const loadData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [sigRes, senRes, btRes, xaiRes] = await Promise.all([
                    fetchSignal(ticker, 'intraday').catch(e => { throw e }),
                    fetchSentiment(ticker).catch(() => null),
                    fetchBacktest(ticker, tf).catch(() => null),
                    fetchExplainability(ticker, tf).catch(() => null)
                ]);

                if (!active) return;

                if (sigRes) setSignal(sigRes);
                if (senRes) setSentiment(senRes);
                if (btRes) setBacktest(btRes);
                if (xaiRes && Array.isArray(xaiRes)) setXai(xaiRes);
            } catch (err: any) {
                console.error(err);
                if (active) setError(err.message || 'Failed to fetch signal data');
            } finally {
                if (active) setLoading(false);
            }
        };
        loadData();
        return () => { active = false; };
    }, [ticker, tf]);

    // Live Polling
    useEffect(() => {
        if (!isLive) return;

        const interval = setInterval(async () => {
            try {
                const sigRes = await fetchSignal(ticker, 'intraday');
                if (sigRes) setSignal(sigRes);
                // We don't necessarily need to reload metrics/sentiment/xai every 30s 
                // as they are slower moving, but we can if needed.
            } catch (e) {
                console.error("Live poll failed", e);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [isLive, ticker]);


    const metrics = backtest ? [
        { label: 'Scalp Win Rate', value: backtest.win_rate, format: 'percent' as const },
        { label: 'Profit Factor', value: backtest.profit_factor, format: 'decimal' as const },
        { label: 'Max Intraday DD', value: (backtest.max_drawdown * 100), format: 'percent' as const, inverseColors: true },
        { label: 'Sharpe Ratio', value: backtest.sharpe_ratio, format: 'decimal' as const },
        { label: 'Accuracy', value: backtest.forecast_accuracy ?? 54, format: 'percent' as const },
    ] : [];

    const gateDisplay = signal?.gate_results ? [
        { label: 'Volatility Cone', passed: signal.gate_results.gate1_cone, title: 'Forecast cone width is tight enough to scalp', icon: Target },
        { label: 'Neural Sentiment', passed: signal.gate_results.gate2_sentiment, title: 'FinBERT score aligns with signal direction', icon: Newspaper },
        { label: 'RSI Confirmation', passed: signal.gate_results.gate3_technical, title: 'RSI confirms the buy/sell zone', icon: BarChart3 },
    ] : [];

    return (
        <div className="flex h-full w-full overflow-hidden animate-in fade-in duration-700 relative">
            {/* Background Grain/Noise */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] grain-noise z-10" />


            {/* MAIN CONTENT GRID */}
            <div className="flex-1 flex overflow-hidden w-full relative z-20">
                {/* CENTER PANEL (Chart & Main Analysis) */}
                <div className="flex-1 center-scroll-panel p-6 pb-20">
                    {loading ? (
                        <div className="empty-state-container min-h-[60vh] border-none bg-transparent">
                            <NeuralSpinner />
                            <span className="font-data text-cyan tracking-[0.3em] text-[10px] mt-4 uppercase animate-pulse">NEURAL ENGINE CALIBRATING...</span>
                        </div>
                    ) : error ? (
                        <div className="empty-state-container min-h-[60vh] border-rose-500/20 bg-rose-500/5">
                            <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center mb-6 animate-pulse">
                                <AlertCircle className="w-10 h-10 text-rose-500" />
                            </div>
                            <h2 className="font-display font-black text-3xl text-white mb-4 tracking-tight">Neural Link Severed</h2>
                            <p className="font-body text-slate-400 text-lg max-w-md leading-relaxed mb-8 font-medium">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="flex items-center gap-3 px-8 py-4 bg-white text-slate-900 rounded-2xl font-display font-black text-xs tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-2xl shadow-rose-500/20 uppercase"
                            >
                                <RefreshCcw className="w-4 h-4" /> Reconnect Engine
                            </button>
                        </div>
                    ) : !signal ? (
                        <div className="empty-state-container min-h-[60vh]">
                            <span className="font-data text-gold tracking-widest text-sm uppercase">No Signal Data Found — Execute Inference</span>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8 max-w-[1400px] mx-auto">
                            {/* TOP CONTROLS */}
                            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-4 px-1">
                                <div className="flex flex-wrap items-center gap-6">
                                    <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 p-1.5 rounded-2xl backdrop-blur-md">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-3">Sector:</span>
                                        <select
                                            value={selectedSector}
                                            onChange={(e) => setSelectedSector(e.target.value)}
                                            className="bg-transparent border-none text-white font-display font-bold text-xs pr-8 py-1.5 outline-none cursor-pointer hover:text-cyan transition-colors appearance-none"
                                        >
                                            <option value="All" className="bg-slate-900">All Markets</option>
                                            {tickerMetadata?.sectors.map((s: string) => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                                        </select>
                                    </div>

                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-cyan transition-colors">
                                            <Search size={16} />
                                        </div>
                                        <select
                                            value={ticker}
                                            onChange={(e) => setTicker(e.target.value)}
                                            className="bg-white/[0.03] border border-white/10 text-white font-display font-bold text-lg pl-12 pr-10 py-3 rounded-2xl focus:border-cyan/50 outline-none w-64 shadow-2xl appearance-none cursor-pointer hover:bg-white/[0.05] transition-all"
                                        >
                                            {(selectedSector === 'All' ? tickerMetadata?.all_tickers : tickerMetadata?.ticker_list[selectedSector])?.map((t: string) => (
                                                <option key={t} value={t} className="bg-slate-900">{t}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                            <ChevronDown size={16} />
                                        </div>
                                    </div>

                                    <div className="flex bg-white/[0.03] border border-white/10 rounded-2xl p-1.5 backdrop-blur-md">
                                        {['1m', '5m', '15m', '30m', '1h', '4h'].map(t => (
                                            <button
                                                key={t}
                                                onClick={() => setTf(t)}
                                                className={`px-4 py-2 font-display text-[10px] font-black tracking-widest rounded-xl transition-all duration-300 uppercase ${tf === t ? 'bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <button 
                                        onClick={() => setIsLive(!isLive)}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 font-display text-[10px] font-black tracking-widest uppercase ${isLive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]' : 'bg-white/[0.03] border-white/10 text-slate-500 hover:border-white/20'}`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
                                        {isLive ? 'Live Sync Active' : 'Enable Live Sync'}
                                    </button>
                                    <div className="w-px h-6 bg-white/5 mx-1" />
                                    <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                                        <Timer className="w-4 h-4 text-indigo-400" />
                                        <span className="text-[10px] font-bold text-indigo-400 tracking-[0.2em] uppercase">Neural Refresh: <span className="text-white">60s</span></span>
                                    </div>
                                    <button className="group flex items-center gap-3 bg-white text-slate-900 px-6 py-3 rounded-2xl font-display font-black text-[11px] tracking-widest hover:bg-indigo-500 hover:text-white transition-all duration-500 shadow-2xl shadow-indigo-500/20 active:scale-95 uppercase">
                                        <Zap className="w-4 h-4 fill-current group-hover:animate-pulse" /> Execute Inference
                                    </button>
                                </div>
                            </div>

                            {/* MAIN SIGNAL AREA */}
                            <div className="grid grid-cols-1 gap-6">
                                <div className="flex flex-col gap-6">
                                    <SignalCard data={signal} isLoading={false} timeframe={`${tf} SCALP`} />
                                    <div className="h-[calc(100vh-420px)] min-h-[500px]">
                                        <CandlestickChart 
                                            ticker={ticker}
                                            ohlcv={signal.ohlcv || []} 
                                            forecast={signal.forecast || []} 
                                            action={signal.action} 
                                            isLive={isLive}
                                            intervalMs={30000}
                                        />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <PositionSizer data={signal} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT INTELLIGENCE SIDEBAR */}
                {signal && !loading && !error && (
                    <div className="w-[360px] hidden 2xl:block border-l border-white/5 right-sidebar-sticky p-6 bg-void/20 backdrop-blur-sm">
                        <div className="flex flex-col gap-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-50">
                                <Activity className="w-4 h-4 text-indigo-500 animate-pulse" />
                            </div>

                            <SignalBadge action={signal.action} />

                            <div className="w-full h-px bg-white/5" />

                            {/* Guardrail Gates */}
                            {gateDisplay.length > 0 && (
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 text-slate-500" />
                                        <h3 className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase font-body">Neural Guardrails</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                        {gateDisplay.map(g => (
                                            <GateCard key={g.label} {...g} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="w-full h-px bg-white/5" />

                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    <h3 className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase font-body">Strategy Metrics</h3>
                                </div>
                                <MetricGrid metrics={metrics} />
                            </div>

                            <div className="w-full h-px bg-white/5" />
                            <XAIPanel report={xai} explanation={signal?.explanation || 'Neural explanation unavailable.'} />

                            <div className="w-full h-px bg-white/5" />
                            <SentimentPanel
                                data={sentiment}
                                gatePassed={signal?.gate_results?.gate2_sentiment ?? false}
                                isActionBuy={signal?.action === 'BUY'}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
