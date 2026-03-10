import React, { useState, useEffect } from 'react';
import { fetchSentiment, SentimentData } from '../api/api';

export const SentimentPage: React.FC = () => {
    const [ticker, setTicker] = useState('RELIANCE.NS');
    const [data, setData] = useState<SentimentData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const tickers = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'AAPL', 'TSLA', 'NVDA', 'MSFT'];

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetchSentiment(ticker);
                setData(res);
            } catch (e) {
                setError('Failed to load sentiment data');
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [ticker]);

    const getSentimentColor = (score: number) => {
        if (score > 0.2) return 'text-green shadow-green/20';
        if (score < -0.2) return 'text-red shadow-red/20';
        return 'text-gold shadow-gold/20';
    };

    return (
        <div className="p-8 flex flex-col gap-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center">
                <h1 className="font-display text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan to-white select-none">
                    SENTIMENT <span className="text-secondary text-2xl font-normal not-italic tracking-normal">DEEP-DIVE</span>
                </h1>

                <div className="flex items-center gap-3">
                    <span className="font-data text-[10px] text-muted tracking-widest uppercase">Select Asset:</span>
                    <select
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value)}
                        className="bg-surface border border-dim rounded px-4 py-2 font-data text-cyan outline-none focus:border-cyan transition-colors"
                    >
                        {tickers.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                    <div className="w-12 h-12 border-2 border-t-cyan border-r-cyan border-b-transparent border-l-transparent rounded-full animate-spin" />
                    <span className="font-data text-cyan tracking-widest text-sm animate-pulse">ANALYZING NEWS STREAMS...</span>
                </div>
            ) : error ? (
                <div className="p-12 border border-red/30 bg-red-dim/10 rounded-xl text-center">
                    <p className="text-red font-body">{error}</p>
                    <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-red/20 border border-red rounded text-red text-sm">RETRY CONNECTION</button>
                </div>
            ) : data && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Score Card */}
                    <div className="lg:col-span-1 bg-surface border border-dim rounded-xl p-8 flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-b from-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="font-data text-xs text-muted tracking-widest uppercase relative z-10">AGGREGATE SENTIMENT</span>
                        <div className={`text-8xl font-black font-display relative z-10 drop-shadow-2xl transition-all ${getSentimentColor(data.aggregate_score)}`}>
                            {((data.aggregate_score + 1) * 50).toFixed(0)}
                        </div>
                        <span className="text-secondary font-body italic relative z-10">
                            Neural analysis based on {data.news.length} recent news signals
                        </span>
                    </div>

                    {/* Headlines List */}
                    <div className="lg:col-span-2 flex flex-col gap-4">
                        <h3 className="font-data text-[10px] text-cyan tracking-[0.3em] uppercase">// RECENT HEADLINES</h3>
                        <div className="flex flex-col gap-3">
                            {data.news.map((n, i) => (
                                <div key={i} className="bg-surface border border-dim rounded-lg p-4 flex flex-col gap-2 hover:border-mid transition-all">
                                    <div className="flex justify-between items-start gap-4">
                                        <p className="font-body text-primary text-sm leading-relaxed">{n.headline}</p>
                                        <span className={`font-data text-xs whitespace-nowrap px-2 py-0.5 rounded border ${n.score > 0.1 ? 'text-green border-green/30 bg-green/5' : n.score < -0.1 ? 'text-red border-red/30 bg-red/5' : 'text-gold border-gold/30 bg-gold/5'}`}>
                                            {(n.score * 10).toFixed(1)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-muted font-data">
                                        <span>SOURCE: {n.source.toUpperCase()}</span>
                                        <span>{n.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
