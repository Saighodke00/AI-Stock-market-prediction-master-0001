import React, { useState, useEffect } from 'react';
import { fetchSentiment, SentimentData } from '../api/api';
import { AlertCircle, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { SentimentGauge } from '../components/trading/SentimentGauge';

export const SentimentPage: React.FC = () => {
    const [ticker, setTicker] = useState('RELIANCE.NS');
    const [data, setData] = useState<SentimentData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const tickers = ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'AAPL', 'TSLA', 'NVDA', 'MSFT'];

    const getSentimentColor = (score: number) => {
        if (score > 0.1) return 'text-emerald-400';
        if (score < -0.1) return 'text-rose-400';
        return 'text-amber-400';
    };

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

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
                    <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <span className="text-[10px] font-bold text-indigo-500 tracking-[0.3em] animate-pulse uppercase font-body">Analyzing News Streams...</span>
                </div>
            );
        }

        if (error) {
            return (
                <div className="p-16 glass-card border-rose-500/20 bg-rose-500/5 text-center flex flex-col items-center gap-6 max-w-2xl mx-auto">
                    <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-xl mb-2 font-display">Neural Link Failure</p>
                        <p className="text-slate-500 font-medium font-body text-sm">{error}</p>
                    </div>
                    <button onClick={() => window.location.reload()} className="px-8 py-3 bg-rose-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-500/20 hover:scale-[1.02] transition-all">
                        Retry Connection
                    </button>
                </div>
            );
        }

        if (!data) return null;

        const score = data.aggregate_score ?? data.score ?? 0;
        const articles = data.articles ?? [];

        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Score Card */}
                <div className="lg:col-span-1 glass-card p-10 flex flex-col items-center justify-center text-center gap-8 relative overflow-hidden group border-indigo-500/20 shadow-indigo-500/5 shadow-2xl">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
                    <span className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase font-body">Aggregate Sentiment</span>
                    
                    <div className="relative w-full">
                         <SentimentGauge score={score} />
                         <div className={`mt-4 text-5xl font-black font-display tracking-tighter ${getSentimentColor(score)}`}>
                             {score.toFixed(2)}
                         </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-white font-bold text-lg font-display uppercase tracking-tight">
                            {score > 0.3 ? 'Strongly Bullish' : score > 0.1 ? 'Mildly Bullish' : score < -0.3 ? 'Strongly Bearish' : score < -0.1 ? 'Mildly Bearish' : 'Neutral Market'}
                        </p>
                        <p className="text-slate-500 font-medium font-body text-xs px-4">
                            FinBERT NLP model confirms neural alignment across {articles.length} news sectors.
                        </p>
                    </div>
                </div>

                {/* Headlines List */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase font-body">Signal Stream</h3>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[10px] font-bold text-emerald-400 tracking-wider">LIVE FEED</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        {articles.map((n: any, i: number) => (
                            <div key={i} className="glass-card hover:translate-x-1 hover:border-white/10 p-5 group transition-all duration-300">
                                <div className="flex justify-between items-start gap-6">
                                    <div className="flex-1">
                                        <p className="font-semibold text-slate-200 text-sm leading-relaxed font-body group-hover:text-white transition-colors">{n.title}</p>
                                        <div className="flex items-center gap-4 mt-3">
                                            <span className="text-[10px] font-bold text-slate-600 tracking-wider uppercase font-body flex items-center gap-1.5">
                                                <div className="w-1 h-1 rounded-full bg-slate-700" />
                                                FinBERT Neural
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-600 tracking-wider font-body">
                                                {n.published ? new Date(n.published).toLocaleDateString('en-GB') : 'Just now'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1.5 rounded-xl border font-bold font-mono text-sm min-w-[50px] text-center ${n.score > 0.1 ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : n.score < -0.1 ? 'text-rose-400 border-rose-500/20 bg-rose-500/5' : 'text-amber-400 border-amber-500/20 bg-amber-500/5'}`}>
                                        {n.score > 0 ? '+' : ''}{(n.score * 10).toFixed(1)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-8 md:p-12 max-w-7xl mx-auto h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.03),_transparent)]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                <div>
                    <h1 className="text-4xl font-bold text-white tracking-tight font-display mb-2">
                        Sentiment <span className="text-indigo-500">Analysis</span>
                    </h1>
                    <p className="text-slate-500 font-medium font-body tracking-wide uppercase text-[10px]">Neural NLP Market Interpretation</p>
                </div>

                <div className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.05] p-2 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase font-body px-2">Asset</span>
                    <select
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value)}
                        className="bg-void border border-white/[0.1] rounded-xl px-4 py-2 text-sm font-bold text-white outline-none focus:border-indigo-500/50 transition-all cursor-pointer min-w-[140px]"
                    >
                        {tickers.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            {renderContent()}
        </div>
    );
};
