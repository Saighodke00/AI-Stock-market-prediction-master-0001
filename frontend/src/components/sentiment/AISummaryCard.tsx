import React from 'react';
import { Brain, Zap, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';

interface AISummaryCardProps {
  summary: string;
  score: number;
  layers: {
    news: { score: number };
    social: { score: number };
    deals: { score: number };
    statements: { score: number };
  };
  isLoading?: boolean;
}

export const AISummaryCard: React.FC<AISummaryCardProps> = ({ summary, score, layers, isLoading }) => {
  const isDivergent = (Math.sign(layers.news.score) !== Math.sign(layers.deals.score)) && layers.deals.score !== 0;

  return (
    <div className="p-6 bg-[#020409] border border-cyan/20 rounded-xl relative overflow-hidden group h-full flex flex-col">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-cyan/10 transition-colors" />
      
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-cyan/10 rounded-lg border border-cyan/20">
          <Brain className="w-5 h-5 text-cyan" />
        </div>
        <div>
          <h4 className="text-[10px] font-black text-muted tracking-[0.2em] uppercase">Neural Synthesis Engine</h4>
          <span className="text-[9px] font-mono text-cyan/70 font-bold uppercase tracking-wider">Apex v3.1 Inference</span>
        </div>
      </div>

      <div className="bg-white/[0.02] border border-dim rounded-xl p-5 mb-6 relative">
          <p className="text-sm font-body text-primary leading-relaxed italic">
            "{summary}"
          </p>
          <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2">
             <div className="px-3 py-1 bg-[#0a0f1d] border border-cyan/30 rounded-full text-[10px] font-black text-white shadow-lg">
                AI INSIGHT
             </div>
          </div>
      </div>

      <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-muted uppercase tracking-widest px-1">
             <span>Layer Component</span>
             <span>Weight</span>
             <span>Vector</span>
          </div>
          
          {[
            { name: 'News Intelligence', weight: '40%', score: layers.news.score },
            { name: 'Corporate Statements', weight: '30%', score: layers.statements.score },
            { name: 'Social Momentum', weight: '20%', score: layers.social.score },
            { name: 'Institutional Alpha', weight: '10%', score: layers.deals.score },
          ].map((layer, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-white/[0.03] border border-dim rounded-lg group/row hover:bg-white/[0.05] transition-colors">
               <span className="text-xs font-bold text-secondary group-hover/row:text-white transition-colors">{layer.name}</span>
               <span className="text-[9px] font-mono text-muted">{layer.weight}</span>
               <div className={`flex items-center gap-2 font-mono text-xs font-bold ${layer.score >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <ChevronRight size={12} className={layer.score >= 0 ? 'rotate-0' : 'rotate-90'} />
                  {layer.score > 0 ? '+' : ''}{layer.score.toFixed(2)}
               </div>
            </div>
          ))}
      </div>

      <div className="mt-auto pt-6">
        {isDivergent ? (
          <div className="flex items-center gap-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg">
             <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
             <div className="flex flex-col">
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-tighter">Negative Divergence Detected</span>
                <span className="text-[9px] text-rose-400/80 font-medium">Smart Money flow opposes social/news sentiment.</span>
             </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
             <CheckCircle2 className="w-5 h-5 text-emerald-400" />
             <div className="flex flex-col">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">Vector Confluence Confirmed</span>
                <span className="text-[9px] text-emerald-400/80 font-medium">Multi-layer signals aligned with neural projection.</span>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
