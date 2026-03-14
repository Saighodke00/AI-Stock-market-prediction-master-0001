import React, { useState, useEffect } from 'react';
import { fetchSignal, fetchSentiment, fetchBacktest, fetchExplainability, SignalResponse, SentimentData, BacktestMetrics, XAIReport } from '../api/api';
import { SignalCard } from '../components/trading/SignalCard';
import { CandlestickChart } from '../components/trading/CandlestickChart';
import { MetricGrid } from '../components/trading/MetricGrid';
import { XAIPanel } from '../components/trading/XAIPanel';
import { SentimentPanel } from '../components/trading/SentimentPanel';
import { PositionSizer } from '../components/trading/PositionSizer';
import { NeuralSpinner } from '../components/ui/LoadingStates';
import { Search, Timer, Zap, AlertCircle, RefreshCcw, ChevronDown, Activity } from 'lucide-react';

const TICKERS = [
    'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'BHARTIARTL.NS',
    'SBIN.NS', 'INFY.NS', 'LICI.NS', 'ITC.NS', 'HINDUNILVR.NS', 'LT.NS',
    'BAJFINANCE.NS', 'HCLTECH.NS', 'MARUTI.NS', 'SUNPHARMA.NS', 'ONGC.NS',
    'TATAMOTORS.NS', 'NTPC.NS', 'KOTAKBANK.NS', 'TITAN.NS'
];

export const IntradayTradingPage: React.FC = () => {
    const [ticker, setTicker] = useState(TICKERS[0]);
    const [tf, setTf] = useState('5m');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [signal, setSignal] = useState<SignalResponse | null>(null);
    const [sentiment, setSentiment] = useState<SentimentData | null>(null);
    const [backtest, setBacktest] = useState<BacktestMetrics | null>(null);
    const [xai, setXai] = useState<XAIReport[]>([]);

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
                if (xaiRes) setXai(xaiRes);
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


    const metrics = backtest ? [
        { label: 'Scalp Win Rate', value: backtest.win_rate * 100, format: 'percent' as const },
        { label: 'Profit Factor', value: backtest.profit_factor, format: 'decimal' as const },
        { label: 'Max Intraday DD', value: -(backtest.max_drawdown * 100), format: 'percent' as const, inverseColors: true },
        { label: 'Sharpe Ratio', value: backtest.sharpe_ratio, format: 'decimal' as const },
        { label: 'Accuracy', value: (backtest.forecast_accuracy ?? 54) * 100, format: 'percent' as const },
    ] : [];

    return (
        <div className="flex flex-col h-full bg-[#030712] overflow-y-auto w-full p-6 animate-in fade-in duration-700 min-w-[320px]">
            {/* Background Grain/Noise */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] grain-noise z-50" />

            {/* Top Controls */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8 px-1">
                <div className="flex flex-wrap items-center gap-6">
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-indigo-400 transition-colors">
                            <Search size={16} />
                        </div>
                        <select
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value)}
                            className="bg-white/[0.03] border border-white/10 text-white font-display font-bold text-lg pl-12 pr-10 py-3 rounded-2xl focus:border-indigo-500/50 outline-none w-64 shadow-2xl appearance-none cursor-pointer hover:bg-white/[0.05] transition-all"
                        >
                            {TICKERS.map(t => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
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
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                         <Timer className="w-4 h-4 text-indigo-400" />
                         <span className="text-[10px] font-bold text-indigo-400 tracking-[0.2em] uppercase">Neural Refresh: <span className="text-white">60s</span></span>
                    </div>
                    <button className="group flex items-center gap-3 bg-white text-slate-900 px-6 py-3 rounded-2xl font-display font-black text-[11px] tracking-widest hover:bg-indigo-500 hover:text-white transition-all duration-500 shadow-2xl shadow-indigo-500/20 active:scale-95 uppercase">
                        <Zap className="w-4 h-4 fill-current group-hover:animate-pulse" /> Execute Inference
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                    <NeuralSpinner />
                    <span className="font-data text-cyan tracking-[0.3em] text-[10px] mt-4 uppercase animate-pulse">NEURAL ENGINE CALIBRATING...</span>
                </div>
            ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] glass-card border-rose-500/20 bg-rose-500/5 rounded-3xl p-12 text-center">
                    <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center mb-6 animate-pulse">
                        <AlertCircle className="w-10 h-10 text-rose-500" />
                    </div>
                    <h2 className="font-display font-black text-3xl text-white mb-4 tracking-tight">Neural Link Severed</h2>
                    <p className="font-body text-slate-400 text-lg max-w-md leading-relaxed mb-8 font-medium">
                        {error}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-3 px-8 py-4 bg-white text-slate-900 rounded-2xl font-display font-black text-xs tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-2xl shadow-rose-500/20 uppercase"
                    >
                        <RefreshCcw className="w-4 h-4" /> Reconnect Engine
                    </button>
                </div>
            ) : !signal ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                    <span className="font-data text-gold tracking-widest text-sm uppercase">No Signal Data Found</span>
                </div>
            ) : (
                <>
                    <div className="flex flex-col xl:flex-row gap-8 items-start">
                        {/* Main Analysis Column */}
                        <div className="flex-1 flex flex-col gap-8 w-full">
                            <SignalCard data={signal} isLoading={false} timeframe={`${tf} SCALP`} />
                            <CandlestickChart ohlcv={signal.ohlcv || []} forecast={signal.forecast || []} action={signal.action} />
                        </div>

                        {/* Intelligence Sidebar */}
                        <div className="w-full xl:w-[350px] shrink-0 flex flex-col gap-8 glass-card border-white/5 p-6 shadow-2xl relative overflow-hidden">
                            {/* Status Marker */}
                            <div className="absolute top-0 right-0 p-4 opacity-50">
                                 <Activity className="w-4 h-4 text-indigo-500 animate-pulse" />
                            </div>

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

                    {/* Bottom Allocation Section */}
                    <div className="mt-8">
                        <PositionSizer data={signal} />
                    </div>
                </>
            )}
        </div>
    );
};
