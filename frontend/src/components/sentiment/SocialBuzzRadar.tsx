import React from 'react';
import { MessageSquare, Twitter, Share2, TrendingUp } from 'lucide-react';

interface SocialSource {
  name: string;
  score: number;
  buzz: number;
  icon: React.ReactNode;
  color: string;
}

interface SocialBuzzRadarProps {
  data: {
    reddit: { score: number; buzz_count: number };
    stocktwits: { score: number; buzz_count: number };
    twitter?: { score: number; buzz_count: number };
  };
  isLoading?: boolean;
}

export const SocialBuzzRadar: React.FC<SocialBuzzRadarProps> = ({ data, isLoading }) => {
  const sources: SocialSource[] = [
    { 
      name: 'Reddit', 
      score: data.reddit.score, 
      buzz: data.reddit.buzz_count, 
      icon: <MessageSquare size={14} />, 
      color: '#ff4500' 
    },
    { 
      name: 'StockTwits', 
      score: data.stocktwits.score, 
      buzz: data.stocktwits.buzz_count, 
      icon: <Share2 size={14} />, 
      color: '#405de6' 
    },
    { 
      name: 'Twitter (X)', 
      score: data.twitter?.score ?? 0.05, 
      buzz: data.twitter?.buzz_count ?? 120, 
      icon: <Twitter size={14} />, 
      color: '#ffffff' 
    },
  ];

  const avgScore = sources.reduce((acc, s) => acc + s.score, 0) / sources.length;

  return (
    <div className="p-5 bg-[#0a0f1d] border border-white/5 rounded-xl h-full flex flex-col gap-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-5 -rotate-12 group-hover:rotate-0 transition-transform">
        <TrendingUp size={120} />
      </div>

      <div className="flex justify-between items-end z-10">
        <div>
          <h4 className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase mb-1">Social Momentum Radar</h4>
          <div className="text-2xl font-display font-black text-white">
            {avgScore > 0 ? '+' : ''}{avgScore.toFixed(2)}
          </div>
        </div>
        <div className="text-right">
          <span className="text-[9px] font-mono text-slate-500 block">TOTAL VOLUME</span>
          <span className="text-xs font-mono font-bold text-cyan">{sources.reduce((acc, s) => acc + s.buzz, 0)} Nodes</span>
        </div>
      </div>

      <div className="flex flex-col gap-5 z-10">
        {sources.map(source => (
          <div key={source.name} className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-[10px] font-mono font-bold">
              <div className="flex items-center gap-2">
                <span style={{ color: source.color }}>{source.icon}</span>
                <span className="text-slate-300 uppercase tracking-widest">{source.name}</span>
              </div>
              <span className={source.score >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {source.score > 0 ? '+' : ''}{source.score.toFixed(2)}
              </span>
            </div>
            
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
               <div 
                 className="h-full rounded-full transition-all duration-1000 ease-out"
                 style={{ 
                   width: `${((source.score + 1) / 2) * 100}%`,
                   backgroundColor: source.score >= 0 ? '#00e676' : '#ff1744',
                   boxShadow: `0 0 10px ${source.score >= 0 ? '#00e67644' : '#ff174444'}`
                 }}
               />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-4 border-t border-white/5 grid grid-cols-2 gap-4 z-10">
         <div className="bg-white/5 p-2 rounded-lg text-center">
            <span className="text-[8px] text-slate-500 block uppercase font-black">Velocity</span>
            <span className="text-xs font-mono font-bold text-emerald-400">STABLE</span>
         </div>
         <div className="bg-white/5 p-2 rounded-lg text-center">
            <span className="text-[8px] text-slate-500 block uppercase font-black">Confluence</span>
            <span className="text-xs font-mono font-bold text-cyan">HIGH</span>
         </div>
      </div>
    </div>
  );
};
