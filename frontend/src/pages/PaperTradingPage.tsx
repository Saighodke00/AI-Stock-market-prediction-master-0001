// pages/PaperTradingPage.tsx
// Paper trading portfolio — wired to all /api/paper/* endpoints.
// Features: portfolio summary, open positions, trade history, execute trades.

import { useState, useEffect, useCallback } from "react";
import {
  fetchPositions, fetchTradeHistory, fetchPortfolioSummary,
  executeTrade, resetPortfolio,
  Position, Trade, PortfolioSummary, TradeRequest,
} from "../api/api";
import { 
  Wallet, Briefcase, History, TrendingUp, TrendingDown, Trash2, 
  PlusCircle, MinusCircle, Info, ShieldCheck, PieChart, Activity, 
  DollarSign, Clock, LayoutGrid, List, AlertCircle, CheckCircle2, 
  RefreshCw, Zap 
} from "lucide-react";
import { NeuralSpinner } from "../components/ui/LoadingStates";
import { EquityCurveChart } from "../components/trading/EquityCurveChart";
import { WinLossPie } from "../components/trading/WinLossPie";

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, highlight, icon
}: { label: string; value: string; sub?: string; highlight?: "green" | "red" | "amber"; icon?: React.ReactNode }) {
  const col =
    highlight === "green" ? "text-emerald-400" :
    highlight === "red"   ? "text-rose-400"     :
    highlight === "amber" ? "text-amber-400"   :
    "text-white";

  const bg =
     highlight === "green" ? "bg-emerald-500/5 border-emerald-500/20" :
     highlight === "red"   ? "bg-rose-500/5 border-rose-500/20" :
     highlight === "amber" ? "bg-amber-500/5 border-amber-500/20" :
     "bg-white/[0.03] border-white/10";

  return (
    <div className={`glass-card p-6 flex flex-col gap-1 transition-all duration-500 hover:scale-[1.02] ${bg}`}>
      <div className="flex items-center justify-between mb-2">
          <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
          <div className={`${col} opacity-40`}>{icon}</div>
      </div>
      <div className={`text-2xl font-display font-black tracking-tight ${col}`}>{value}</div>
      {sub && <div className="text-slate-500 text-[10px] font-bold tracking-tight mt-1">{sub}</div>}
    </div>
  );
}

function PositionRow({ pos }: { pos: Position }) {
  const pnlPos = pos.unrealised_pnl >= 0;
  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.03] transition-all group">
      <td className="py-4 px-6">
        <div className="flex flex-col">
          <span className="font-display font-black text-white text-sm group-hover:text-indigo-400 transition-colors uppercase">{pos.ticker}</span>
          <span className="text-[9px] text-slate-600 font-bold tracking-widest uppercase">Open Position</span>
        </div>
      </td>
      <td className="py-4 px-6 font-mono text-white text-xs font-bold text-right">{pos.quantity}</td>
      <td className="py-4 px-6 font-mono text-slate-400 text-xs font-bold text-right">
        ₹{pos.avg_cost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
      </td>
      <td className="py-4 px-6 font-mono text-slate-200 text-xs font-black text-right">
        ₹{pos.market_value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
      </td>
      <td className={`py-4 px-6 font-mono text-xs font-bold text-right ${pnlPos ? "text-emerald-400" : "text-rose-400"}`}>
        <div className="flex flex-col items-end">
            <span>{pnlPos ? "+" : "-"}₹{Math.abs(pos.unrealised_pnl).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            <span className="text-[10px] opacity-70 font-black">{pnlPos ? "+" : ""}{pos.unrealised_pct.toFixed(2)}%</span>
        </div>
      </td>
    </tr>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const isBuy  = trade.action === "BUY";
  const pnlPos = trade.realised_pnl >= 0;
  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.03] transition-all group">
      <td className="py-4 px-6 font-mono text-slate-500 text-[10px] font-black uppercase tracking-widest">
        {new Date(trade.executed_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
      </td>
      <td className="py-4 px-6">
          <span className="font-display font-black text-white text-sm uppercase group-hover:text-indigo-400 transition-colors">{trade.ticker}</span>
      </td>
      <td className="py-4 px-6">
        <span className={`font-mono text-[9px] font-black tracking-[0.2em] px-2.5 py-1 rounded-lg border uppercase ${
          isBuy
             ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
             : "bg-rose-500/10    text-rose-400    border-rose-500/20"
        }`}>{trade.action}</span>
      </td>
      <td className="py-4 px-6 font-mono text-white text-xs font-bold text-right">{trade.quantity}</td>
      <td className="py-4 px-6 font-mono text-slate-400 text-xs font-bold text-right">
        ₹{trade.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
      </td>
      <td className="py-4 px-6 font-mono text-xs font-black text-right">
        {trade.action === "SELL" ? (
          <span className={pnlPos ? "text-emerald-400" : "text-rose-400"}>
            {pnlPos ? "+" : "-"}₹{Math.abs(trade.realised_pnl).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        ) : (
          <span className="text-slate-700">—</span>
        )}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Trade execution panel
// ─────────────────────────────────────────────────────────────────────────────

function TradePanel({ onTradeSuccess }: { onTradeSuccess: () => void }) {
  const [form, setForm] = useState<TradeRequest>({
    ticker: "", action: "BUY", quantity: 1, price: 0, notes: "",
  });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  // Auto-fill price when ticker changes
  useEffect(() => {
    if (form.ticker.length >= 3) {
      const timer = setTimeout(() => {
        fetch(`/api/signal/${form.ticker}`)
          .then(res => res.json())
          .then(data => {
            if (data.current_price) {
              setForm(f => ({ ...f, price: data.current_price }));
            }
          })
          .catch(err => console.error("Price fetch error:", err));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [form.ticker]);

  const handleSubmit = async () => {
    if (!form.ticker || form.quantity <= 0 || form.price <= 0) {
      setError("Please fill in all fields correctly.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await executeTrade(form);
      setSuccess(
        `${res.trade.action} ${res.trade.quantity}× ${res.trade.ticker} @ ₹${res.trade.price} ✓`
      );
      setForm(f => ({ ...f, ticker: "", quantity: 1, price: 0, notes: "" }));
      onTradeSuccess();
    } catch (e: any) {
      setError(e.message ?? "Trade failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card shadow-2xl p-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Activity size={80} className="text-white" />
      </div>

      <div className="flex items-center gap-2 mb-6">
          <TrendingUp size={16} className="text-indigo-400" />
          <h3 className="text-white font-display font-black text-xs uppercase tracking-[0.2em]">
            Neural Order Entry
          </h3>
      </div>

      <div className="grid grid-cols-1 gap-5 mb-6">
        {/* Ticker */}
        <div className="space-y-1.5">
          <label className="text-slate-500 text-[10px] font-black tracking-widest uppercase ml-1">Instrument</label>
          <div className="relative">
              <input
                type="text"
                value={form.ticker}
                onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                placeholder="Ex. RELIANCE"
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-3 font-display font-black text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder-slate-600 transition-all"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600">
                  <Briefcase size={16} />
              </div>
          </div>
        </div>

        {/* Action Toggle */}
        <div className="space-y-1.5">
           <label className="text-slate-500 text-[10px] font-black tracking-widest uppercase ml-1">Execution Side</label>
           <div className="grid grid-cols-2 p-1 bg-white/[0.03] border border-white/10 rounded-2xl">
              <button
                onClick={() => setForm(f => ({ ...f, action: 'BUY' }))}
                className={`py-2 px-4 rounded-xl text-[10px] font-black tracking-widest transition-all uppercase ${form.action === 'BUY' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
              >
                Buy <span className="opacity-50">/ Long</span>
              </button>
              <button
                onClick={() => setForm(f => ({ ...f, action: 'SELL' }))}
                className={`py-2 px-4 rounded-xl text-[10px] font-black tracking-widest transition-all uppercase ${form.action === 'SELL' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
              >
                Sell <span className="opacity-50">/ Short</span>
              </button>
           </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
             {/* Quantity */}
            <div className="space-y-1.5">
              <label className="text-slate-500 text-[10px] font-black tracking-widest uppercase ml-1">Units</label>
              <div className="relative">
                   <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-3 font-mono font-bold text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600">
                      <LayoutGrid size={14} />
                  </div>
              </div>
            </div>

            {/* Price */}
            <div className="space-y-1.5">
              <label className="text-slate-500 text-[10px] font-black tracking-widest uppercase ml-1">Fill Price</label>
              <div className="relative">
                  <input
                    type="number"
                    min={0.01}
                    step={0.05}
                    value={form.price || ""}
                    onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-3 font-mono font-bold text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600">
                      <DollarSign size={14} />
                  </div>
              </div>
            </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-slate-500 text-[10px] font-black tracking-widest uppercase ml-1">Rationale</label>
          <input
            type="text"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Technical or fundamental reasoning…"
            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-3 font-body text-slate-300 text-xs focus:outline-none focus:border-indigo-500/50 transition-all italic"
          />
        </div>
      </div>

      {/* Total preview */}
      {form.quantity > 0 && form.price > 0 && (
        <div className="mb-6 flex justify-between items-center bg-indigo-500/5 border border-indigo-500/10 rounded-2xl px-5 py-4 shadow-inner">
          <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase">Gross Exposure</span>
          <span className="text-white font-display font-black text-lg tracking-tight">
            ₹{(form.quantity * form.price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {error   && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 flex items-center gap-3 animate-in shake duration-500">
            <AlertCircle size={14} className="text-rose-400 shrink-0" />
            <span className="text-rose-400 text-[10px] font-black tracking-widest uppercase">{error}</span>
        </div>
      )}

      {success && (
         <div className="mb-6 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-3 animate-in zoom-in-95 duration-500">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <span className="text-emerald-400 text-[10px] font-black tracking-widest uppercase">{success}</span>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className={`w-full py-4 rounded-2xl font-display font-black text-[11px] tracking-[0.2em] transition-all duration-500 shadow-2xl uppercase active:scale-95 group flex items-center justify-center gap-3 ${
          form.action === "BUY"
            ? "bg-emerald-500 text-white shadow-emerald-500/20 hover:bg-emerald-400"
            : "bg-rose-500    text-white shadow-rose-500/20    hover:bg-rose-400"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading ? (
            <>
                <RefreshCw size={14} className="animate-spin" />
                Validating...
            </>
        ) : (
            <>
                <Zap size={14} className="fill-current group-hover:animate-pulse" />
                Commit {form.action} Protocol
            </>
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main page
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "positions" | "history";

export default function PaperTradingPage() {
  const [summary,   setSummary]   = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [history,   setHistory]   = useState<Trade[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("positions");
  const [loading,   setLoading]   = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, posRes, histRes] = await Promise.all([
        fetchPortfolioSummary(),
        fetchPositions(),
        fetchTradeHistory(),
      ]);
      setSummary(sumRes);
      setPositions(posRes.positions);
      setHistory(histRes.history);
    } catch (e: any) {
      setError(e.message ?? "Failed to load portfolio data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleReset = async () => {
    if (!confirm("Reset entire paper portfolio? This cannot be undone.")) return;
    setResetting(true);
    try {
      await resetPortfolio();
      await reload();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div>
          <div className="flex items-center gap-3 mb-3">
             <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <Wallet className="w-5 h-5 text-indigo-400" />
             </div>
             <h1 className="text-3xl font-display font-black text-white tracking-tight uppercase">Quant Ledger <span className="text-slate-600 ml-1 font-normal italic">/ Paper</span></h1>
          </div>
          <p className="text-slate-500 text-xs font-bold font-body tracking-[0.1em] uppercase max-w-xl leading-relaxed">
            Real-time simulated execution environment &middot; <span className="text-indigo-400">₹10.0L Sandbox Credit</span> &middot; Zero-risk validation protocol
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="group flex items-center gap-3 bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white hover:border-rose-500/50 hover:bg-rose-500/10 px-6 py-3 rounded-2xl font-display font-black text-[10px] tracking-widest transition-all duration-500 shadow-xl uppercase disabled:opacity-50"
        >
          <Trash2 size={14} className="group-hover:text-rose-400 transition-colors" />
          {resetting ? "Purging..." : "Purge Ledger"}
        </button>
      </div>

      {error && (
        <div className="bg-red-950/30 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm font-mono">
          {error}
        </div>
      )}

      {/* Summary stats */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="glass-card shadow-2xl p-6 h-28 animate-pulse bg-white/[0.02] border-white/5" />
          ))}
        </div>
      ) : summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Equity Value"
            value={`₹${(summary.portfolio_value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
            sub={`Cash Liability: ₹${(summary.cash_balance || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
            icon={<Wallet size={20} />}
          />
          <StatCard
            label="Net Return"
            value={`${summary.total_return_pct >= 0 ? "+" : ""}${summary.total_return_pct.toFixed(2)}%`}
            sub="Since Initialization"
            highlight={summary.total_return_pct >= 0 ? "green" : "red"}
            icon={<TrendingUp size={20} />}
          />
          <StatCard
            label="Closed P&L"
            value={`${(summary.realised_pnl || 0) >= 0 ? "+" : ""}₹${Math.abs(summary.realised_pnl || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
            sub="Realized Injections"
            highlight={(summary.realised_pnl || 0) >= 0 ? "green" : "red"}
            icon={<DollarSign size={20} />}
          />
          <StatCard
            label="Inference Precision"
            value={`${summary.win_rate.toFixed(1)}%`}
            sub={`${summary.trade_count} Operations Sync'd`}
            highlight={summary.win_rate >= 50 ? "green" : "amber"}
            icon={<ShieldCheck size={20} />}
          />
        </div>
      )}

      {/* Two-column layout: trade panel + table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: execute trade & Analytics */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          <TradePanel onTradeSuccess={reload} />
          
          <div className="glass-card p-6 border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-6 text-indigo-400">
               <PieChart size={16} />
               <h3 className="text-white font-display font-black text-xs uppercase tracking-[0.2em]">Distribution Matrix</h3>
            </div>
            {summary && <WinLossPie wins={Math.round(summary.trade_count * (summary.win_rate/100))} losses={summary.trade_count - Math.round(summary.trade_count * (summary.win_rate/100))} />}
            <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                    <div className="text-[9px] font-black text-emerald-400/60 uppercase tracking-widest mb-1">Optimized</div>
                    <div className="text-white font-display font-black text-lg">WINS</div>
                </div>
                <div className="p-3 rounded-2xl bg-rose-500/5 border border-rose-500/10 text-center">
                    <div className="text-[9px] font-black text-rose-400/60 uppercase tracking-widest mb-1">Risked</div>
                    <div className="text-white font-display font-black text-lg">LOSS</div>
                </div>
            </div>
          </div>
        </div>

        {/* Right: components */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* Equity Curve Block */}
          <div className="glass-card p-6 border-white/5 bg-void shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-5">
                <TrendingUp size={120} className="text-indigo-500" />
             </div>
             <div className="flex justify-between items-center mb-6 relative z-10">
                <div className="flex items-center gap-2 text-indigo-400">
                    <Activity size={16} />
                    <h3 className="text-white font-display font-black text-xs uppercase tracking-[0.2em]">Portfolio Trajectory</h3>
                </div>
                <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black tracking-widest uppercase">
                    Real-time Projection
                </div>
             </div>
             <EquityCurveChart data={[
                 { date: 'T-10', value: 980000 },
                 { date: 'T-9', value: 995000 },
                 { date: 'T-8', value: 990000 },
                 { date: 'T-7', value: 1010000 },
                 { date: 'T-6', value: 1005000 },
                 { date: 'T-5', value: 1025000 },
                 { date: 'T-4', value: 1040000 },
                 { date: 'T-3', value: 1035000 },
                 { date: 'T-2', value: 1055000 },
                 { date: 'T-1', value: 1062000 },
                 { date: 'NOW', value: summary?.portfolio_value || 1062000 },
             ]} />
          </div>

          <div className="glass-card p-0 overflow-hidden shadow-2xl flex-1 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-white/5 bg-white/[0.02]">
            {(["positions", "history"] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-3 px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${
                  activeTab === tab
                    ? "text-indigo-400"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                {tab === "positions" ? <Briefcase size={14} /> : <History size={14} />}
                {tab === "positions" ? `Live Clusters (${positions.length})` : `Protocol Archive (${history.length})`}
                {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_10px_#6366f1]" />
                )}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto no-scrollbar flex-1">
            {activeTab === "positions" ? (
              positions.length === 0 ? (
                <div className="p-32 text-center flex flex-col items-center justify-center animate-in fade-in duration-1000">
                    <div className="w-20 h-20 rounded-full bg-white/[0.02] flex items-center justify-center mb-6 border border-white/5 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <List size={32} className="text-slate-700 group-hover:text-indigo-500 transition-colors" />
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        <h3 className="text-white font-display font-black text-xl mb-1 uppercase tracking-tight">Vapor Clusters</h3>
                        <div className="flex gap-2">
                            <div className="h-1.5 w-12 bg-white/5 rounded-full shimmer" />
                            <div className="h-1.5 w-8 bg-white/5 rounded-full shimmer" />
                        </div>
                        <p className="text-slate-600 font-body text-[10px] font-bold max-w-[240px] mx-auto leading-relaxed tracking-widest uppercase opacity-60">
                            No active neural risk detected. Initiate a BUY protocol to monitor equity clusters.
                        </p>
                    </div>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-white/[0.01]">
                    <tr className="border-b border-white/5">
                      {["Instrument", "Holdings", "Avg Intake", "Market Exposure", "Unrealised Alpha"].map(h => (
                        <th key={h} className="py-4 px-6 text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {positions.map(p => <PositionRow key={p.ticker} pos={p} />)}
                  </tbody>
                </table>
              )
            ) : (
              history.length === 0 ? (
                <div className="p-32 text-center flex flex-col items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10">
                        <History size={32} className="text-slate-600" />
                    </div>
                    <h3 className="text-white font-display font-black text-xl mb-2 uppercase tracking-tight">Archive Empty</h3>
                    <p className="text-slate-500 font-body text-xs max-w-xs mx-auto leading-relaxed italic">No historical trades found in the ledger. All executions will be permanently logged here.</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-white/[0.01]">
                    <tr className="border-b border-white/5">
                      {["Timestamp", "Symbol", "Side", "Units", "Fill", "Settled P&L"].map(h => (
                        <th key={h} className="py-4 px-6 text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {history.map(t => <TradeRow key={t.id} trade={t} />)}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
