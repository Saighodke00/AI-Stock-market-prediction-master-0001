import React from 'react';
import { Info, MapPin, BarChart3, Fingerprint, Activity } from 'lucide-react';

interface TickerMetadataProps {
  meta?: {
    sector: string;
    industry: string;
    market_cap: number;
    beta: number;
  };
  isLoading?: boolean;
}

export const TickerMetadataCard: React.FC<TickerMetadataProps> = ({ meta, isLoading }) => {
  const formatCap = (cap: number) => {
    if (cap >= 1e12) return `₹${(cap / 1e12).toFixed(2)}T`;
    if (cap >= 1e7) return `₹${(cap / 1e7).toFixed(2)}Cr`;
    return `₹${cap.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <div className="bg-[#0a0f1d] border border-dim rounded-xl p-5 animate-pulse">
        <div className="h-4 bg-white/5 rounded w-1/3 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex justify-between">
              <div className="h-3 bg-white/5 rounded w-1/4" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0f1d] border border-dim rounded-xl p-5 shadow-2xl relative overflow-hidden group">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
        <Fingerprint size={80} />
      </div>

      <div className="flex items-center gap-2 mb-6">
        <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
          <Info size={14} className="text-indigo-400" />
        </div>
        <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Ticker Intelligence</h3>
      </div>

      <div className="space-y-5 relative z-10">
        <div className="flex flex-col gap-1 border-b border-white/[0.03] pb-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">
              <MapPin size={10} /> Sector
            </span>
            <span className="text-[11px] font-bold text-white truncate max-w-[140px]">{meta?.sector || 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-medium text-muted lowercase ml-4">{meta?.industry || 'Unknown Industry'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5">
                <BarChart3 size={10} /> Market Cap
              </span>
              <span className="text-[13px] font-black text-white font-mono">{meta ? formatCap(meta.market_cap) : '₹0.00'}</span>
            </div>
            <div className="text-right flex flex-col gap-1">
              <span className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-1.5 justify-end">
                <Activity size={10} /> Beta
              </span>
              <span className={`text-[13px] font-black font-mono ${(meta?.beta || 1) > 1.2 ? 'text-amber-400' : 'text-cyan'}`}>
                {meta?.beta || '1.00'}
              </span>
            </div>
          </div>
        </div>

        {/* Status indicator */}
        <div className="pt-2">
            <div className="text-[9px] font-mono text-muted bg-white/[0.03] border border-dim rounded-md px-3 py-1.5 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                DYNAMO: FUNDAMENTAL SYNC [OK]
            </div>
        </div>
      </div>
    </div>
  );
};
