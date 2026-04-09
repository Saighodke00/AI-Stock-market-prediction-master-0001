import React, { useEffect, useState, useCallback } from 'react';
import { 
  RefreshCw, Search, Shield, Zap, 
  Activity, AlertCircle, Globe, Terminal
} from 'lucide-react';
import { useTickerStore } from '../store/useTickerStore';
import { 
  fetchSentimentMatrix, 
  fetchSentimentNews,
  fetchSentimentTimeline,
  refreshSentiment,
  SentimentMatrixResponse
} from '../api/api';

// Components
import { SentimentGauge } from '../components/sentiment/SentimentGauge';
import { LiveNewsFeed } from '../components/sentiment/LiveNewsFeed';
import { SentimentTimeline } from '../components/sentiment/SentimentTimeline';
import { SocialBuzzRadar } from '../components/sentiment/SocialBuzzRadar';
import { AISummaryCard } from '../components/sentiment/AISummaryCard';
import { BulkDealSignals } from '../components/sentiment/BulkDealSignals';

const SentimentPage: React.FC = () => {
  const { ticker, setTicker } = useTickerStore();
  const [matrix, setMatrix] = useState<SentimentMatrixResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(ticker);
  const [history, setHistory] = useState<any[]>([]);

  const loadAllData = useCallback(async (t: string) => {
    setIsLoading(true);
    try {
      const [mRes, hRes] = await Promise.all([
        fetchSentimentMatrix(t),
        fetchSentimentTimeline(t, 30)
      ]);
      setMatrix(mRes);
      setHistory(hRes.history);
    } catch (err) {
      console.error("Failed to fetch sentiment intel:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData(ticker);
  }, [ticker, loadAllData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setTicker(searchInput.trim().toUpperCase());
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await refreshSentiment(ticker);
      await loadAllData(ticker);
    } catch (err) {
      console.error("Refresh failed:", err);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020409] text-[#c8d8f0] font-body p-6 no-scrollbar">
      {/* 🟢 TOP CONTROL BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-cyan/10 border border-cyan/30 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(0,229,255,0.2)]">
            <Globe className="text-cyan w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-black text-white tracking-tighter uppercase">
              Sentiment Intelligence <span className="text-cyan">Hub</span>
            </h1>
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 font-bold uppercase tracking-widest">
              <Terminal size={12} className="text-cyan" /> 
              Matrix Intelligence v3.1 // Neural Node Alpha
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <form onSubmit={handleSearch} className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="SEARCH TICKER (e.g. TCS.NS)"
              className="w-full bg-[#0a0f1d] border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-xs font-mono font-bold focus:border-cyan/50 focus:outline-none transition-all placeholder:text-slate-700 uppercase"
            />
          </form>
          <button 
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-cyan ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 🟢 MAIN INTELLIGENCE GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: GAUGE + RADAR (3 COLS) */}
        <div className="xl:col-span-3 flex flex-col gap-6">
           <SentimentGauge 
             score={matrix?.aggregate.score ?? 0} 
             label={matrix?.aggregate.label ?? 'NEUTRAL'} 
             isLoading={isLoading} 
           />
           <SocialBuzzRadar 
             data={{
               reddit: matrix?.layers.social.reddit ?? { score: 0, buzz_count: 0 },
               stocktwits: matrix?.layers.social.stocktwits ?? { score: 0, buzz_count: 0 }
             }}
             isLoading={isLoading}
           />
           <div className="bg-[#0a0f1d] border border-white/5 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
              <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                 <span>Global Status</span>
                 <span className="text-emerald-400">ACTIVE</span>
              </div>
              <div className="flex items-center gap-3 border-b border-white/[0.03] pb-3">
                 <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                 <span className="text-[11px] font-mono text-slate-300">NEWS SCRAPER: <span className="text-white font-bold uppercase">Stable (RSS Sync)</span></span>
              </div>
              <div className="flex items-center gap-3">
                 <div className="w-2 h-2 bg-cyan rounded-full animate-pulse" />
                 <span className="text-[11px] font-mono text-slate-300">SOCIAL NODES: <span className="text-white font-bold uppercase">14 Scanned</span></span>
              </div>
           </div>
        </div>

        {/* MIDDLE COLUMN: SUMMARY + TIMELINE (6 COLS) */}
        <div className="xl:col-span-6 flex flex-col gap-6">
          <AISummaryCard 
            summary={matrix?.summary_ai ?? "Aggregating sentiment layers from global nodes..."}
            score={matrix?.aggregate.score ?? 0}
            layers={{
              news: { score: matrix?.layers.news.score ?? 0 },
              social: { score: matrix?.layers.social.score ?? 0 },
              deals: { score: matrix?.layers.bulk_deals.score ?? 0 },
              statements: { score: matrix?.layers.statements.score ?? 0 }
            }}
            isLoading={isLoading}
          />
          <SentimentTimeline 
            data={history}
            isLoading={isLoading}
          />
        </div>

        {/* RIGHT COLUMN: NEWS FEED + BULK DEALS (3 COLS) */}
        <div className="xl:col-span-3 flex flex-col gap-6 h-full">
          <div className="flex-1 flex flex-col gap-6 max-h-[850px]">
             <div className="flex flex-col gap-6 flex-1 overflow-hidden">
                <div className="flex items-center justify-between px-1 flex-shrink-0">
                  <h4 className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">Intelligence Feed</h4>
                  <div className="px-2 py-0.5 bg-cyan/10 border border-cyan/30 rounded text-cyan text-[9px] font-mono font-bold">
                      LIVE
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <LiveNewsFeed 
                    items={matrix?.layers.news.items ?? []}
                    isLoading={isLoading}
                  />
                </div>
             </div>
             <div className="flex-shrink-0 h-[400px]">
                <BulkDealSignals 
                  deals={matrix?.layers.bulk_deals.deals ?? []}
                  signal={matrix?.layers.bulk_deals.signal ?? 'NEUTRAL'}
                  summary={matrix?.layers.bulk_deals.summary ?? "Monitoring institutional large block activity..."}
                  isLoading={isLoading}
                />
             </div>
          </div>
        </div>

      </div>

      {/* 🟢 FOOTER TELEMETRY */}
      <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap justify-between items-center text-[9px] font-mono text-slate-600 uppercase tracking-[0.2em]">
         <div className="flex gap-6">
            <span>UPTIME: 142H 04M</span>
            <span>NODES: NSE_PRIMARY, YAHOO_RSS, REDDIT_PRAW, STOCKTWITS</span>
            <span>DATA SRC: FEEDPARSER, LXML, NATIVE_TLS</span>
         </div>
         <div className="flex items-center gap-2 text-cyan font-bold italic">
            <Zap size={10} /> QUANTITATIVE LAYER OVERLAY: v3.1.2024.EX
         </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 229, 255, 0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 229, 255, 0.3); }
      `}</style>
    </div>
  );
};

export default SentimentPage;
