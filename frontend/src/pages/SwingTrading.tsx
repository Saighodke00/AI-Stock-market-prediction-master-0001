import React, { useState, useEffect } from 'react';
import { fetchSignal, fetchSentiment, fetchBacktest, fetchExplainability, SignalResponse, SentimentData, BacktestMetrics, XAIReport } from '../api/api';
import { SignalCard } from '../components/trading/SignalCard';
import { CandlestickChart } from '../components/trading/CandlestickChart';
import { MetricGrid } from '../components/trading/MetricGrid';
import { XAIPanel } from '../components/trading/XAIPanel';
import { SentimentPanel } from '../components/trading/SentimentPanel';
import { PositionSizer } from '../components/trading/PositionSizer';
import { NeuralSpinner } from '../components/ui/LoadingStates';

const TICKERS = [
    'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'BHARTIARTL.NS',
    'SBIN.NS', 'INFY.NS', 'LICI.NS', 'ITC.NS', 'HINDUNILVR.NS', 'LT.NS',
    'BAJFINANCE.NS', 'HCLTECH.NS', 'MARUTI.NS', 'SUNPHARMA.NS', 'ONGC.NS',
    'TATAMOTORS.NS', 'NTPC.NS', 'KOTAKBANK.NS', 'TITAN.NS'
];

export const SwingTradingPage: React.FC = () => {
    const [ticker, setTicker] = useState(TICKERS[0]);
    const [tf, setTf] = useState('1D');

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
                    fetchSignal(ticker, tf).catch(e => { throw e }),
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
        { label: 'Win Rate', value: backtest.win_rate * 100, format: 'percent' as const },
        { label: 'Profit Factor', value: backtest.profit_factor, format: 'decimal' as const },
        { label: 'Max Drawdown', value: -(backtest.max_drawdown * 100), format: 'percent' as const, inverseColors: true },
        { label: 'Sharpe Ratio', value: backtest.sharpe_ratio, format: 'decimal' as const },
        { label: 'Accuracy', value: backtest.forecast_accuracy * 100, format: 'percent' as const },
    ] : [];

    return (
        <div className="flex flex-col h-full bg-base overflow-y-auto w-full p-6 animate-page-in min-w-[320px]">

            {/* Top Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <select
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value)}
                        className="bg-void border border-dim text-cyan font-display font-medium text-lg px-4 py-2 rounded focus:border-cyan outline-none w-48 shadow-lg"
                    >
                        {TICKERS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    <div className="flex bg-void border border-dim rounded p-1">
                        {['1D', '1W'].map(t => (
                            <button
                                key={t}
                                onClick={() => setTf(t)}
                                className={`px-4 py-1.5 font-display text-xs rounded transition-colors ${tf === t ? 'bg-cyan text-void shadow-glow-cyan font-bold' : 'text-secondary hover:text-primary'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                <button className="flex items-center gap-2 bg-void border border-cyan/50 text-cyan px-4 py-2 rounded font-body text-sm hover:bg-cyan-dim transition-colors shadow-glow-cyan">
                    <span className="animate-pulse-dot w-2 h-2 rounded-full bg-cyan" /> RUN NEURAL INFERENCE
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                    <NeuralSpinner />
                    <span className="font-data text-cyan tracking-[0.3em] text-[10px] mt-4 uppercase animate-pulse">NEURAL ENGINE CALIBRATING...</span>
                </div>
            ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] border border-red/30 bg-red-dim rounded-xl p-8">
                    <span className="text-4xl mb-4">⚠️</span>
                    <h2 className="font-display font-bold text-xl text-red mb-2">Neural Engine Offline</h2>
                    <p className="font-body text-secondary text-center max-w-md">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 px-6 py-2 bg-void border border-red text-red rounded font-display text-sm hover:bg-red hover:text-void transition-all"
                    >
                        RETRY CONNECTION
                    </button>
                </div>
            ) : !signal ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                    <span className="font-data text-gold tracking-widest text-sm uppercase">No Signal Data Found</span>
                </div>
            ) : (
                <div className="flex flex-col xl:flex-row gap-6">
                    {/* Main Column */}
                    <div className="flex-1 flex flex-col gap-6 max-w-full text-primary">
                        <SignalCard data={signal} isLoading={false} timeframe={`${tf} SWING`} />
                        <CandlestickChart ohlcv={signal.ohlcv || []} forecast={signal.forecast || []} action={signal.action} />
                        <PositionSizer data={signal} />
                    </div>

                    {/* Right Data Column */}
                    <div className="w-full xl:w-[300px] flex-shrink-0 flex flex-col gap-8 bg-surface border border-dim rounded-xl p-5 shadow-lg">

                        <div className="flex flex-col gap-3">
                            <h3 className="font-data text-[9px] text-cyan tracking-[0.3em] uppercase">// MODEL METRICS (OUT-OF-SAMPLE)</h3>
                            <MetricGrid metrics={metrics} />
                        </div>

                        <div className="w-full h-px bg-dim/50" />

                        <XAIPanel report={xai} explanation={signal?.explanation || 'Neural explanation unavailable.'} />

                        <div className="w-full h-px bg-dim/50" />

                        <SentimentPanel
                            data={sentiment}
                            gatePassed={signal?.gate_results?.gate3_sentiment ?? false}
                            isActionBuy={signal?.action === 'BUY'}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
