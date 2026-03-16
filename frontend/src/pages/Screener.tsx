// pages/Screener.tsx
// Market screener - 20 NSE tickers, concurrent backend, BUY/SELL/HOLD signal table.
// Includes SEBI Bulk Deals tab (replaces defunct SEC Form 4).

import { useState, useEffect } from "react";
import {
  fetchScreener, fetchBulkDeals,
  ScreenerResult, BulkDeal,
} from "../api/api";
import { Database, Gavel, BarChart2, Filter, Zap, ArrowUpDown, RefreshCw, CheckCircle2, XCircle, MinusCircle, AlertCircle, Search, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { NeuralSpinner } from "../components/ui/LoadingStates";

function RSIBadge({ value }: { value: number }) {
  const isOverbought = value > 70;
  const isOversold = value < 30;
  const color = isOverbought ? "text-rose-400" : isOversold ? "text-emerald-400" : "text-amber-400";
  const bg = isOverbought ? "bg-rose-500/10" : isOversold ? "bg-emerald-500/10" : "bg-amber-500/10";
  const border = isOverbought ? "border-rose-500/20" : isOversold ? "border-emerald-500/20" : "border-amber-500/20";
  
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${bg} ${border} ${color}`}>
      <span className="font-mono text-[10px] font-black uppercase tracking-widest">RSI</span>
      <span className="font-display font-black text-xs">{value.toFixed(0)}</span>
      <div className="w-12 h-1 bg-void/50 rounded-full overflow-hidden">
        <div className={`h-full ${color.replace('text-', 'bg-')}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const color = action === "BUY" ? "text-emerald-400" : action === "SELL" ? "text-rose-400" : "text-amber-400";
  const bg = action === "BUY" ? "bg-emerald-500/10" : action === "SELL" ? "bg-rose-500/10" : "bg-amber-500/10";
  const border = action === "BUY" ? "border-emerald-500/20" : action === "SELL" ? "border-rose-500/20" : "border-amber-500/20";
  
  return (
    <div className={`px-4 py-1.5 rounded-full border ${bg} ${border} ${color} font-display font-black text-[10px] tracking-[0.2em] animate-pulse-glow`}>
      {action}
    </div>
  );
}

function ConfidenceSparkBar({ value }: { value: number }) {
  return (
    <div className="w-full space-y-1">
      <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-widest">
        <span>Confidence</span>
        <span>{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1 w-full bg-void rounded-full overflow-hidden border border-white/5">
        <div 
          className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 animate-shimmer bg-[length:200%_100%]" 
          style={{ width: `${value * 100}%` }} 
        />
      </div>
    </div>
  );
}

function GateDots({ gates }: { gates: any }) {
  const gateList = [
    { name: 'Cone', passed: gates.gate1_cone },
    { name: 'Sent', passed: gates.gate2_sentiment },
    { name: 'Tech', passed: gates.gate3_technical }
  ];

  return (
    <div className="flex gap-1.5">
      {gateList.map((g, i) => (
        <div 
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${g.passed ? 'bg-emerald-500 shadow-[0_0_5px_theme(colors.emerald.500)]' : 'bg-rose-500 shadow-[0_0_5px_theme(colors.rose.500)]'}`}
          title={`${g.name}: ${g.passed ? 'PASS' : 'FAIL'}`}
        />
      ))}
    </div>
  );
}

function SignalCard({ row, rank }: { row: ScreenerResult; rank: number }) {
  const pctSign  = row.price_change_pct >= 0 ? "+" : "";
  const pctColor = row.price_change_pct >= 0 ? "text-emerald-400" : "text-rose-400";
  const p50Chg   = ((row.p50 - row.current_price) / row.current_price * 100);
  const p50Sign  = p50Chg >= 0 ? "+" : "";
  const p50Color = p50Chg >= 0 ? "text-emerald-400" : "text-rose-400";

  const cardStyles: Record<string, string> = {
    BUY:  "border-emerald-500/20 bg-emerald-500/[0.02] hover:bg-emerald-500/[0.05]",
    SELL: "border-rose-500/20    bg-rose-500/[0.02]    hover:bg-rose-500/[0.05]",
    HOLD: "border-white/5        bg-white/[0.01]        hover:bg-white/[0.03]",
  };

  return (
    <div className={`group flex flex-col md:flex-row items-center gap-6 p-5 rounded-2xl border transition-all duration-300 cursor-pointer mb-4 ${cardStyles[row.action] ?? ""}`}>
      {/* Rank & Symbol */}
      <div className="flex items-center gap-4 w-full md:w-64 shrink-0">
        <span className="font-mono text-[10px] font-bold text-slate-600 tracking-tighter w-6">{rank.toString().padStart(2, '0')}</span>
        <div className="flex flex-col">
          <span className="font-display font-black text-white text-lg tracking-tight group-hover:text-cyan transition-colors uppercase leading-none mb-1">
            {row.ticker}
          </span>
          <span className="text-[9px] text-slate-600 font-bold tracking-widest uppercase opacity-60">National Stock Exchange</span>
        </div>
      </div>

      {/* Logic & Confidence */}
      <div className="flex items-center gap-6 w-full md:w-auto flex-1">
        <ActionBadge action={row.action} />
        <ConfidenceSparkBar value={row.confidence} />
        <div className="hidden lg:block border-l border-white/5 h-8 mx-2" />
        <GateDots gates={row.gate_results} />
      </div>

      {/* Metrics */}
      <div className="flex items-center justify-between md:justify-end gap-10 w-full md:w-auto shrink-0">
        <div className="flex flex-col items-end">
          <span className="font-mono font-black text-white text-md tracking-tight">₹{(row.current_price || 0).toLocaleString("en-IN", { minimumFractionDigits: 1 })}</span>
          <span className={`font-mono text-[10px] font-black tracking-tighter ${pctColor}`}>{pctSign}{row.price_change_pct.toFixed(2)}%</span>
        </div>

        <div className="flex flex-col items-end">
          <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Neural Target</h4>
          <span className={`font-mono font-black ${p50Color} text-md tracking-tight`}>₹{(row.p50 || 0).toLocaleString("en-IN", { minimumFractionDigits: 1 })}</span>
          <span className="text-[10px] text-slate-600 font-bold tracking-tighter">({p50Sign}{p50Chg.toFixed(1)}%)</span>
        </div>

        <RSIBadge value={row.rsi} />
      </div>

      {/* Quick Action */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-2 rounded-xl bg-void border border-dim text-cyan hover:bg-cyan hover:text-void transition-all shadow-glow-cyan">
          <Activity size={16} />
        </button>
      </div>
    </div>
  );
}

function DealRow({ deal }: { deal: BulkDeal }) {
  const isBuy = deal.buy_sell.toUpperCase().startsWith("B");
  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.04] transition-all">
      <td className="py-4 px-6 font-mono text-slate-500 text-[10px] font-bold uppercase tracking-widest">{deal.trade_date}</td>
      <td className="py-4 px-6">
        <span className="font-display font-black text-white text-sm">{deal.symbol}</span>
      </td>
      <td className="py-4 px-6">
        <span className="text-slate-400 text-xs font-medium max-w-xs truncate block italic">
            "{deal.client}"
        </span>
      </td>
      <td className="py-4 px-6">
        <span className={`font-mono text-[9px] font-black tracking-widest px-2 py-1 rounded-lg border uppercase ${
          isBuy ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10    text-rose-400    border-rose-500/20"
        }`}>{isBuy ? "BUY" : "SELL"}</span>
      </td>
      <td className="py-4 px-6 font-mono text-white text-xs font-black text-right">
        {deal.quantity.toLocaleString("en-IN")}
      </td>
      <td className="py-4 px-6 font-mono text-slate-300 text-xs font-bold text-right">
        ₹{deal.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
      </td>
      <td className="py-4 px-6">
        <span className="font-display text-[9px] font-black tracking-widest text-slate-500 bg-white/5 px-2.5 py-1 rounded-lg uppercase">
          {deal.deal_type}
        </span>
      </td>
    </tr>
  );
}

type Tab = "signals" | "deals";

export default function Screener() {
  const [tab,           setTab]           = useState<Tab>("signals");
  const [signals,       setSignals]       = useState<ScreenerResult[]>([]);
  const [deals,         setDeals]         = useState<BulkDeal[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [dealsLoading,  setDealsLoading]  = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [lastUpdate,    setLastUpdate]    = useState<Date | null>(null);
  const [filterAction,  setFilter]        = useState<"ALL"|"BUY"|"SELL"|"HOLD">("ALL");

  const loadSignals = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetchScreener("swing");
      setSignals(res.results);
      setLastUpdate(new Date());
    } catch (e: any) {
      setError(e.message ?? "Screener failed.");
    } finally { setLoading(false); }
  };

  const loadDeals = async () => {
    setDealsLoading(true);
    try {
      const res = await fetchBulkDeals(undefined, 7);
      setDeals(res.deals);
    } catch (e: any) { console.error("Deals error:", e); }
    finally { setDealsLoading(false); }
  };

  useEffect(() => { loadSignals(); }, []);
  useEffect(() => { if (tab === "deals" && deals.length === 0) loadDeals(); }, [tab]);

  const filtered = filterAction === "ALL" ? signals : signals.filter(s => s.action === filterAction);
  const buys  = signals.filter(s => s.action === "BUY").length;
  const sells = signals.filter(s => s.action === "SELL").length;
  const holds = signals.filter(s => s.action === "HOLD").length;

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div>
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <Database className="w-5 h-5 text-indigo-400" />
             </div>
             <h1 className="text-3xl font-display font-black text-white tracking-tight uppercase">Quant Screener <span className="text-slate-600 ml-1 font-normal italic">/ Prime</span></h1>
          </div>
          <p className="text-slate-500 text-xs font-bold font-body tracking-[0.1em] uppercase max-w-xl leading-relaxed">
            Neural filtering engine processing NSE top 20 liquidity &middot; <span className="text-indigo-400">5.4s avg inference latency</span> &middot; Neural probability sort
          </p>
        </div>
        {lastUpdate && (
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/10 px-4 py-2 rounded-2xl shadow-xl backdrop-blur-md">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-400 text-[10px] font-black tracking-widest uppercase">
                Synchronized: <span className="text-white">{lastUpdate.toLocaleTimeString("en-IN")}</span>
            </span>
          </div>
        )}
      </div>

      {signals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: "Bullish Signals",  count: buys,  color: "text-emerald-400", bg: "bg-emerald-500/5", border: "border-emerald-500/20", icon: <TrendingUp size={16} /> },
            { label: "Neural Neutral", count: holds, color: "text-amber-400", bg: "bg-amber-500/5", border: "border-amber-500/20", icon: <MinusCircle size={16} />  },
            { label: "Bearish Signals", count: sells, color: "text-rose-400", bg: "bg-rose-500/5", border: "border-rose-500/20", icon: <TrendingDown size={16} />    },
          ].map(({ label, count, color, bg, border, icon }) => (
            <div key={label} className={`glass-card ${border} ${bg} p-6 flex items-center justify-between transition-all duration-500 hover:scale-[1.02] active:scale-95 group`}>
              <div className="flex flex-col gap-1">
                  <div className={`flex items-center gap-2 mb-1 ${color} opacity-70 group-hover:opacity-100 transition-opacity`}>
                      {icon}
                      <span className="font-display font-black text-[10px] uppercase tracking-[0.2em]">{label}</span>
                  </div>
                  <span className="font-mono font-black text-4xl text-white tracking-tighter">{count.toString().padStart(2, '0')}</span>
              </div>
              <div className={`p-4 rounded-2xl ${bg} border ${border} opacity-20 group-hover:opacity-40 transition-opacity`}>
                  <Zap size={24} className={color} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="glass-card shadow-2xl p-0 overflow-hidden">
        <div className="flex flex-col md:flex-row items-center justify-between border-b border-white/5 bg-white/[0.02]">
          <div className="flex w-full md:w-auto overflow-x-auto no-scrollbar">
            {(["signals","deals"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-3 px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${
                  tab === t ? "text-indigo-400" : "text-slate-500 hover:text-white"
                }`}>
                {t === "signals" ? <BarChart2 size={14} /> : <Gavel size={14} />}
                {t === "signals" ? "Strategy Lab" : "Institutional Deals"}
                {tab === t && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_10px_#6366f1]" />
                )}
              </button>
            ))}
          </div>
          {tab === "signals" && (
            <div className="flex flex-wrap items-center gap-3 p-3 ml-auto">
              <div className="flex items-center gap-1.5 bg-black/20 p-1 rounded-xl border border-white/5">
                {(["ALL","BUY","SELL","HOLD"] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all ${
                        filterAction === f ? "bg-indigo-500 text-white shadow-lg" : "text-slate-500 hover:text-white hover:bg-white/5"
                    }`}>{f}</button>
                ))}
              </div>
              <button onClick={loadSignals} disabled={loading}
                className="flex items-center gap-2 px-6 py-2 rounded-xl text-[9px] font-black tracking-widest uppercase bg-white text-slate-900 hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-50 shadow-xl group">
                <RefreshCw size={12} className={loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} />
                {loading ? "Calibrating..." : "Synchronize"}
              </button>
            </div>
          )}
        </div>

        {tab === "signals" ? (
          <div className="p-6">
            {error && <div className="mb-6 px-5 py-4 text-rose-400 text-[10px] font-black tracking-widest uppercase bg-rose-500/5 border border-rose-500/20 rounded-xl flex items-center gap-3 animate-pulse">
                <AlertCircle size={14} />
                {error}
            </div>}
            
            {loading && signals.length === 0 ? (
              <div className="p-20 flex flex-col items-center justify-center">
                <NeuralSpinner />
                <span className="text-[10px] font-black tracking-[0.3em] text-slate-500 uppercase mt-6 animate-pulse">Scanning Global Orderbooks...</span>
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="hidden md:flex items-center gap-6 px-5 mb-4 opacity-40">
                    <span className="text-[9px] font-black uppercase tracking-widest w-[280px]">Instrument</span>
                    <span className="text-[9px] font-black uppercase tracking-widest flex-1">Neural Analysis</span>
                    <span className="text-[9px] font-black uppercase tracking-widest w-[400px] text-right pr-10">Market Metrics</span>
                </div>
                {filtered.map((row, i) => <SignalCard key={row.ticker} row={row} rank={i+1} />)}
                
                {filtered.length === 0 && !loading && (
                  <div className="p-32 text-center flex flex-col items-center justify-center">
                      <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10">
                          <Filter className="w-8 h-8 text-slate-600" />
                      </div>
                      <h3 className="text-white font-display font-black text-xl mb-2 uppercase tracking-tight">Zone Depletion</h3>
                      <p className="text-slate-500 font-body text-xs max-w-xs mx-auto leading-relaxed">The engine found zero {filterAction !== "ALL" ? filterAction : ""} signals matching your current liquidity and risk parameters.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          dealsLoading ? (
             <div className="p-20 flex flex-col items-center justify-center">
                <NeuralSpinner />
                <span className="text-[10px] font-black tracking-[0.3em] text-slate-500 uppercase mt-6 animate-pulse">Intercepting Block Trajectory...</span>
              </div>
          ) : (
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full">
                <thead className="bg-white/[0.01]">
                  <tr className="border-b border-white/5">
                    {["Protocol Date","Symbol","Counterparty","Intent","Quantity","NAV","Strategy"].map(h => (
                      <th key={h} className="py-4 px-6 text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">{deals.map((d,i) => <DealRow key={i} deal={d} />)}</tbody>
              </table>
              {deals.length === 0 && !dealsLoading && (
                <div className="text-center py-20 bg-white/[0.01]">
                  <div className="w-16 h-16 rounded-full bg-slate-500/10 flex items-center justify-center mx-auto mb-6">
                      <Search className="w-8 h-8 text-slate-600" />
                  </div>
                  <h3 className="text-white font-display font-black text-xl mb-2">No Institutional Activity</h3>
                  <p className="text-slate-500 font-body text-xs mb-8 max-w-xs mx-auto leading-relaxed">No high-value bulk deals detected within the specified lookback horizon (7D).</p>
                  <button onClick={loadDeals} className="px-8 py-3 text-[10px] font-black uppercase tracking-widest bg-white text-slate-900 rounded-xl hover:bg-indigo-500 hover:text-white transition-all shadow-2xl">
                    Re-scan Dark Pools
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
