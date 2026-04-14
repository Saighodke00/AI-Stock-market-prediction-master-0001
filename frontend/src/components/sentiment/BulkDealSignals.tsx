import React from 'react';
import { Landmark, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Deal {
  date: string;
  ticker: string;
  client_name: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
}

interface BulkDealSignalsProps {
  deals: Deal[];
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'MIXED';
  summary: string;
  isLoading?: boolean;
}

export const BulkDealSignals: React.FC<BulkDealSignalsProps> = ({ deals, signal, summary, isLoading }) => {
  const getSignalColor = (s: string) => {
    if (s === 'BULLISH') return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5';
    if (s === 'BEARISH') return 'text-rose-400 border-rose-500/30 bg-rose-500/5';
    if (s === 'MIXED') return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/5';
    return 'text-amber-400 border-amber-500/30 bg-amber-500/5';
  };

  const getSignalIcon = (s: string) => {
    if (s === 'BULLISH') return <TrendingUp className="w-3 h-3" />;
    if (s === 'BEARISH') return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  if (isLoading) {
    return <div className="h-48 bg-white/5 animate-pulse rounded-xl" />;
  }

  return (
    <div className="p-5 bg-[#0a0f1d] border border-dim rounded-xl h-full flex flex-col relative overflow-hidden group">
      <div className="flex justify-between items-start mb-6 z-10">
        <div>
          <h4 className="text-[10px] font-black text-muted tracking-[0.2em] uppercase mb-1">Institutional Deal Matrix</h4>
          <p className="text-[9px] font-mono text-muted max-w-[200px]">{summary}</p>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-black tracking-widest ${getSignalColor(signal)}`}>
           {getSignalIcon(signal)} {signal}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <table className="w-full text-left font-mono">
          <thead className="text-[8px] text-muted border-b border-mid uppercase tracking-widest">
            <tr>
              <th className="pb-2 font-black">Trade Entity</th>
              <th className="pb-2 font-black">Type</th>
              <th className="pb-2 font-black text-right">Qty</th>
            </tr>
          </thead>
          <tbody className="text-[10px]">
            {deals.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-muted italic">NO LARGE BLOCK DEALS DETECTED (7D)</td>
              </tr>
            ) : (
              deals.map((deal, idx) => (
                <tr key={idx} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors group/row">
                  <td className="py-3 pr-2">
                    <div className="flex flex-col">
                      <span className="text-secondary font-bold group-hover/row:text-white transition-colors truncate max-w-[140px]">
                        {deal.client_name}
                      </span>
                      <span className="text-[8px] text-muted uppercase">{deal.date}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className={deal.type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                      {deal.type}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-secondary font-bold">{(deal.quantity / 1000000).toFixed(2)}M</span>
                      <span className="text-[8px] text-muted">@ ₹{deal.price.toFixed(0)}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-3 border-t border-dim flex items-center gap-2">
        <Landmark className="w-3.5 h-3.5 text-cyan opacity-40" />
        <span className="text-[8px] font-mono text-muted uppercase tracking-widest font-black">Verified SEBI Source</span>
      </div>
    </div>
  );
};
