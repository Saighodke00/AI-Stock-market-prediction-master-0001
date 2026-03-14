// pages/Screener.tsx
// Market screener - 20 NSE tickers, concurrent backend, BUY/SELL/HOLD signal table.
// Includes SEBI Bulk Deals tab (replaces defunct SEC Form 4).

import { useState, useEffect } from "react";
import {
  fetchScreener, fetchBulkDeals,
  ScreenerResult, BulkDeal,
} from "../api/api";
import { Database, Gavel, BarChart2, Filter, Zap, ArrowUpDown, RefreshCw, CheckCircle2, XCircle, MinusCircle, AlertCircle, Search, TrendingUp, TrendingDown } from "lucide-react";
import { NeuralSpinner } from "../components/ui/LoadingStates";

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    BUY:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    SELL: "bg-rose-500/10    text-rose-400    border-rose-500/20",
    HOLD: "bg-amber-500/10   text-amber-400   border-amber-500/20",
  };
  return (
    <span className={`font-mono text-[9px] font-black tracking-widest px-2.5 py-1 rounded-lg border uppercase ${styles[action] ?? styles.HOLD}`}>
      {action}
    </span>
  );
}

function GateDots({ gates }: { gates: ScreenerResult["gate_results"] }) {
  return (
    <div className="flex gap-2 items-center">
      {[gates.gate1_cone, gates.gate2_sentiment, gates.gate3_technical].map((pass, i) => (
        <div key={i} title={["Cone", "Sentiment", "RSI"][i]}>
            {pass ? <div className="p-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20"><CheckCircle2 size={10} className="text-emerald-400" /></div> : <div className="p-0.5 rounded-full bg-white/5 border border-white/10"><MinusCircle size={10} className="text-slate-600" /></div>}
        </div>
      ))}
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct   = Math.round(value * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 65 ? "bg-amber-500" : "bg-slate-600";
  return (
    <div className="flex flex-col gap-1 w-32">
      <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-mono font-bold text-slate-500 tracking-tighter uppercase">Confidence</span>
          <span className="text-[10px] font-mono font-bold text-white">{pct}%</span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden border border-white/5">
        <div className={`h-full rounded-full ${color} shadow-[0_0_10px_currentColor] transition-all duration-1000`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SignalRow({ row, rank }: { row: ScreenerResult; rank: number }) {
  const pctSign  = row.price_change_pct >= 0 ? "+" : "";
  const pctColor = row.price_change_pct >= 0 ? "text-emerald-400" : "text-rose-400";
  const p50Chg   = ((row.p50 - row.current_price) / row.current_price * 100);
  const p50Sign  = p50Chg >= 0 ? "+" : "";

  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.04] transition-all group cursor-pointer">
      <td className="py-4 px-6 text-slate-600 font-mono text-[10px] font-bold tracking-widest">{rank.toString().padStart(2, '0')}</td>
      <td className="py-4 px-6">
        <div className="flex flex-col">
          <span className="font-display font-black text-white text-sm tracking-tight group-hover:text-indigo-400 transition-colors">
            {row.ticker}
          </span>
          <span className="text-[9px] text-slate-600 font-bold tracking-widest uppercase">National Exchange</span>
        </div>
      </td>
      <td className="py-4 px-6"><ActionBadge action={row.action} /></td>
      <td className="py-4 px-6"><ConfidenceBar value={row.confidence} /></td>
      <td className="py-4 px-6 font-mono text-white text-xs font-bold text-right tracking-tight">
        ₹{row.current_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
      </td>
      <td className={`py-4 px-6 font-mono text-xs font-black text-right ${pctColor}`}>
        {pctSign}{row.price_change_pct.toFixed(2)}%
      </td>
      <td className="py-4 px-6 text-right">
        <div className="flex flex-col items-end">
            <span className="font-mono text-xs text-emerald-400 font-bold">₹{row.p50.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            <span className="text-[10px] text-slate-600 font-bold">({p50Sign}{p50Chg.toFixed(1)}%)</span>
        </div>
      </td>
      <td className="py-4 px-6 text-right">
         <span className={`font-mono text-xs font-black ${row.rsi > 70 ? "text-rose-400" : row.rsi < 30 ? "text-emerald-400" : "text-slate-400"}`}>
            {row.rsi.toFixed(0)}
         </span>
      </td>
      <td className="py-4 px-6"><GateDots gates={row.gate_results} /></td>
    </tr>
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
          <>
            {error && <div className="px-5 py-4 text-rose-400 text-[10px] font-black tracking-widest uppercase bg-rose-500/5 border-b border-rose-500/20 flex items-center gap-3 animate-pulse">
                <AlertCircle size={14} />
                {error}
            </div>}
            {loading && signals.length === 0 ? (
              <div className="p-20 flex flex-col items-center justify-center">
                <NeuralSpinner />
                <span className="text-[10px] font-black tracking-[0.3em] text-slate-500 uppercase mt-6 animate-pulse">Scanning Global Orderbooks...</span>
              </div>
            ) : (
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left">
                  <thead className="bg-white/[0.01]">
                    <tr className="border-b border-white/5">
                      {["#","Instrument","Action","Reliability","Spot Price","Daily Chg","Neural Alpha","RSI","Gates"].map(h => (
                        <th key={h} className="py-4 px-6 text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                                {h}
                                {h !== "#" && h !== "Gates" && <ArrowUpDown size={10} className="text-slate-700" />}
                            </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {filtered.map((row, i) => <SignalRow key={row.ticker} row={row} rank={i+1} />)}
                  </tbody>
                </table>
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
          </>
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
