import React from 'react';
import { ExternalLink, Clock, Newspaper } from 'lucide-react';

interface NewsItem {
  title: string;
  url: string;
  source: string;
  published: string;
  score?: number;
}

interface LiveNewsFeedProps {
  items: NewsItem[];
  isLoading?: boolean;
}

export const LiveNewsFeed: React.FC<LiveNewsFeedProps> = ({ items, isLoading }) => {
  const getSentimentPill = (score: number) => {
    if (score > 0.2) return <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold">BULLISH</span>;
    if (score < -0.2) return <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[9px] font-bold">BEARISH</span>;
    return <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-bold">NEUTRAL</span>;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-white/5 animate-pulse rounded-lg border border-white/5" />
        ))}
      </div>
    );
  }

    const formatPublishedDate = (dateStr: string) => {
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'UNKNOWN';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        return 'UNKNOWN';
      }
    };

    return (
      <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {items.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-white/10 rounded-xl">
            <Newspaper className="w-8 h-8 text-slate-600 mx-auto mb-3 opacity-20" />
            <p className="text-xs text-slate-500 font-mono italic">AWAITING SYNCHRONIZATION...</p>
          </div>
        ) : (
          items.map((item, idx) => (
            <a
              key={idx}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block p-4 bg-[#0a0f1d] border border-white/5 hover:border-cyan/30 rounded-xl transition-all hover:translate-x-1"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-cyan/70 font-bold uppercase tracking-wider">{item.source}</span>
                  {getSentimentPill(item.score ?? 0)}
                </div>
                <span className={`text-[11px] font-mono font-bold ${item.score && item.score > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {item.score ? (item.score > 0 ? '+' : '') + item.score.toFixed(2) : ''}
                </span>
              </div>
              
              <h3 className="text-sm font-body text-slate-200 leading-snug line-clamp-2 mb-3 group-hover:text-white transition-colors">
                {item.title}
              </h3>
  
              <div className="flex items-center gap-4 text-[9px] text-slate-500 font-mono">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  {formatPublishedDate(item.published)}
                </div>
                <div className="flex items-center gap-1 group-hover:text-cyan transition-colors">
                  READ INTEL <ExternalLink className="w-2.5 h-2.5" />
                </div>
              </div>
            </a>
          ))
        )}
      </div>
    );
};
