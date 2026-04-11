// pages/PaperTradingPage.tsx
// Paper trading portfolio — upgraded to v3.2 Neural HUD aesthetic.
// Features: real-time P&L, cluster distribution, neural order entry.

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchPositions, fetchTradeHistory, fetchPortfolioSummary,
  executeTrade, resetPortfolio,
  Position, Trade, PortfolioSummary, TradeRequest,
} from "../api/api";
import { 
  Wallet, Briefcase, History, TrendingUp, TrendingDown, Trash2, 
  ShieldCheck, PieChart, Activity, DollarSign, LayoutGrid, 
  List, AlertCircle, CheckCircle2, RefreshCw, Zap,
  BarChart3, Layers, Target, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { NeuralSpinner } from "../components/ui/LoadingStates";
import { EquityCurveChart } from "../components/trading/EquityCurveChart";
import { WinLossPie } from "../components/trading/WinLossPie";

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function NeuralStatCard({
  label, value, sub, highlight, icon, trend
}: { 
  label: string; 
  value: string; 
  sub?: string; 
  highlight?: "green" | "red" | "amber" | "cyan"; 
  icon?: React.ReactNode;
  trend?: number;
}) {
  const isPos = (trend || 0) >= 0;
  
  const themes = {
    green: "border-emerald-500/20 bg-emerald-500/[0.02] text-emerald-400 shadow-emerald-500/5",
    red:   "border-rose-500/20 bg-rose-500/[0.02] text-rose-400 shadow-rose-500/5",
    amber: "border-amber-500/20 bg-amber-500/[0.02] text-amber-500 shadow-amber-500/5",
    cyan:  "border-cyan-500/20 bg-cyan-500/[0.02] text-cyan-400 shadow-cyan-500/5",
  };

  const activeTheme = themes[highlight || "cyan"];

  return (
    <div className={`group relative p-6 rounded-3xl border transition-all duration-500 hover:scale-[1.02] active:scale-95 overflow-hidden ${activeTheme}`}>
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      
      <div className="relative z-10 flex flex-col gap-1">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-1">{label}</span>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-display font-black tracking-tight">{value}</span>
          {trend !== undefined && (
            <div className={`flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full border ${isPos ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
              {isPos ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        {sub && <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">{sub}</span>}
      </div>
      
      {/* Decorative corner blur */}
      <div className={`absolute -bottom-10 -right-10 w-24 h-24 blur-[40px] rounded-full opacity-20 pointer-events-none group-hover:opacity-40 transition-opacity bg-current`} />
    </div>
  );
}

function PositionMatrixRow({ pos }: { pos: Position }) {
  const pnlPos = pos.unrealised_pnl >= 0;
  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.03] transition-all group">
      <td className="py-5 px-6">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-display font-black text-xs ${pnlPos ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
            {pos.ticker.slice(0, 2)}
          </div>
          <div className="flex flex-col">
            <span className="font-display font-black text-white text-md uppercase tracking-tight group-hover:text-cyan transition-colors">{pos.ticker}</span>
            <span className="text-[8px] text-slate-600 font-bold tracking-[0.2em] font-mono">SEQ_ENTRY: {new Date(pos.opened_at).toLocaleDateString()}</span>
          </div>
        </div>
      </td>

      <td className="py-5 px-6 font-mono font-bold text-slate-300 text-sm">{pos.quantity}</td>
      
      <td className="py-5 px-6">
        <div className="flex flex-col">
          <span className="font-mono text-xs text-white">₹{pos.avg_cost.toLocaleString()}</span>
          <span className="text-[9px] text-slate-600 uppercase font-black tracking-widest">Avg Intake</span>
        </div>
      </td>

      <td className="py-5 px-6">
        <div className="flex flex-col">
          <span className="font-mono text-xs text-cyan animate-pulse">₹{pos.current_price.toLocaleString()}</span>
          <span className="text-[9px] text-slate-600 uppercase font-black tracking-widest">Live Feed</span>
        </div>
      </td>

      <td className="py-5 px-6 text-right">
        <div className="flex flex-col items-end">
          <span className={`font-mono text-md font-black ${pnlPos ? 'text-emerald-400' : 'text-rose-400'}`}>
            {pnlPos ? '+' : ''}₹{pos.unrealised_pnl.toLocaleString(undefined, { minimumFractionDigits: 1 })}
          </span>
          <div className={`flex items-center gap-1 text-[10px] font-black ${pnlPos ? 'text-emerald-500/60' : 'text-rose-500/60'}`}>
            {pnlPos ? 'BULLISH ALPHA' : 'BEARISH PRESSURE'} &middot; {pnlPos ? '+' : ''}{pos.unrealised_pct.toFixed(2)}%
          </div>
        </div>
      </td>
    </tr>
  );
}

function HistoryProtocolRow({ trade }: { trade: Trade }) {
  const isBuy = trade.action === "BUY";
  const pnlPos = trade.realised_pnl >= 0;
  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-all">
      <td className="py-4 px-6 font-mono text-slate-600 text-[9px] font-bold uppercase tracking-widest leading-none">
        {new Date(trade.executed_at).toLocaleDateString()}<br/>
        <span className="opacity-40">{new Date(trade.executed_at).toLocaleTimeString()}</span>
      </td>
      <td className="py-4 px-6">
        <span className="font-display font-black text-white uppercase text-sm">{trade.ticker}</span>
      </td>
      <td className="py-4 px-6">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border font-mono text-[9px] font-black tracking-widest uppercase ${isBuy ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
          {isBuy ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {trade.action}
        </div>
      </td>
      <td className="py-4 px-6 font-mono text-slate-300 text-xs text-right font-bold">{trade.quantity}</td>
      <td className="py-4 px-6 font-mono text-white text-xs text-right font-black">₹{trade.price.toLocaleString()}</td>
      <td className="py-4 px-6 text-right">
        {trade.action === "SELL" ? (
          <span className={`font-mono text-xs font-black ${pnlPos ? 'text-emerald-400' : 'text-rose-400'}`}>
            {pnlPos ? '+' : '-'}₹{Math.abs(trade.realised_pnl).toLocaleString()}
          </span>
        ) : (
          <span className="text-slate-800">—</span>
        )}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Neural Order Terminal
// ─────────────────────────────────────────────────────────────────────────────

function OrderTerminal({ onTradeSuccess }: { onTradeSuccess: () => void }) {
  const [form, setForm] = useState<TradeRequest>({
    ticker: "", action: "BUY", quantity: 1, price: 0, notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (form.ticker.length >= 3) {
      const timer = setTimeout(() => {
        fetch(`/api/signal/${form.ticker}`)
          .then(res => res.json())
          .then(data => {
            if (data.current_price) setForm(f => ({ ...f, price: data.current_price }));
          });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [form.ticker]);

  const handleSubmit = async () => {
    if (!form.ticker || form.quantity <= 0 || form.price <= 0) {
      setError("Incomplete Protocol Logic");
      return;
    }
    setLoading(true); setError(null); setSuccess(null);
    try {
      await executeTrade(form);
      setSuccess("TRANSACTION_COUPLED");
      setForm(f => ({ ...f, ticker: "", quantity: 1, price: 0 }));
      onTradeSuccess();
    } catch (e: any) {
      setError(e.message ?? "NEURAL_LINK_REJECTED");
    } finally {
      setLoading(false);
    }
  };

  const isBuy = form.action === "BUY";

  return (
    <div className="glass-card overflow-hidden flex flex-col h-full border-cyan-500/10 shadow-cyan-500/5">
      <div className="bg-gradient-to-r from-cyan-500/10 to-transparent p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Layers size={16} className="text-cyan-400" />
          <h2 className="text-white font-display font-black text-xs uppercase tracking-[0.3em]">Neural Order Entry</h2>
        </div>
      </div>

      <div className="p-6 space-y-6 flex-1">
        <div className="space-y-1.5">
          <label className="text-slate-600 text-[9px] font-black uppercase tracking-[0.2em] ml-1">Asset Identifier</label>
          <div className="relative group">
            <input
              type="text"
              value={form.ticker}
              onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
              placeholder="Ex. TATASTEEL"
              className="w-full bg-void border border-white/5 rounded-2xl px-5 py-4 font-display font-black text-white text-md focus:outline-none focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 transition-all placeholder-slate-800"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 group-hover:opacity-100 transition-opacity">
               <Briefcase size={16} className="text-cyan-400" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 p-1 bg-void/50 border border-white/5 rounded-2xl">
          {(['BUY', 'SELL'] as const).map(action => (
            <button
              key={action}
              onClick={() => setForm(f => ({ ...f, action }))}
              className={`py-3 rounded-xl font-display font-black text-[10px] tracking-widest transition-all uppercase ${
                form.action === action 
                  ? (action === 'BUY' ? 'bg-emerald text-void shadow-lg shadow-emerald-500/20' : 'bg-rose text-white shadow-lg shadow-rose-500/20') 
                  : 'text-slate-600 hover:text-white'
              }`}
            >
              {action === 'BUY' ? 'Initiate Buy' : 'Commit Sell'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-slate-600 text-[9px] font-black uppercase tracking-[0.2em] ml-1">Quant Units</label>
            <input
              type="number"
              min={1}
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))}
              className="w-full bg-void border border-white/5 rounded-2xl px-5 py-4 font-mono font-black text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-slate-600 text-[9px] font-black uppercase tracking-[0.2em] ml-1">Fill NAV</label>
            <input
              type="number"
              value={form.price || ""}
              onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
              placeholder="0.00"
              className="w-full bg-void border border-white/5 rounded-2xl px-5 py-4 font-mono font-black text-white text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
            />
          </div>
        </div>

        {form.quantity > 0 && form.price > 0 && (
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-1 items-center justify-center text-center">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Exposure Projection</span>
            <span className={`text-xl font-display font-black ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{(form.quantity * form.price).toLocaleString()}
            </span>
          </div>
        )}

        {error && <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-400 text-[9px] font-black uppercase tracking-[0.2em] animate-pulse text-center">{error}</div>}
        {success && <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-[0.2em] animate-pulse text-center">{success}</div>}
      </div>

      <div className="p-6 pt-0 mt-auto">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`w-full py-5 rounded-2xl font-display font-black text-[11px] tracking-[0.3em] transition-all duration-500 shadow-2xl uppercase active:scale-[0.98] flex items-center justify-center gap-3 ${
            isBuy ? "bg-emerald text-void hover:bg-emerald/90" : "bg-rose text-white hover:bg-rose/90"
          } disabled:opacity-50 group`}
        >
          {loading ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} className="fill-current group-hover:animate-pulse" />}
          Execute {form.action} Protocol
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Ledger Page
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "positions" | "history";

export default function PaperTradingPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [history, setHistory] = useState<Trade[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("positions");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, posRes, histRes] = await Promise.all([
        fetchPortfolioSummary(),
        fetchPositions(),
        fetchTradeHistory(),
      ]);
      setSummary(sumRes); setPositions(posRes.positions); setHistory(histRes.history);
    } catch (e: any) {
      setError(e.message ?? "SYNCHRONIZATION_ERROR");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const exposureData = useMemo(() => {
    const total = positions.reduce((acc, p) => acc + p.market_value, 0) || 1;
    return positions.map(p => ({
      name: p.ticker,
      value: (p.market_value / total) * 100,
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`
    }));
  }, [positions]);

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Dynamic Pulse Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shadow-lg shadow-cyan-500/5">
              <BarChart3 className="text-cyan-400" size={24} />
            </div>
            <div>
              <h1 className="text-4xl font-display font-black text-white tracking-tighter uppercase flex items-center gap-2">
                Neural Ledger <span className="text-slate-800 font-normal italic">v3.2</span>
              </h1>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Quant_Sandbox // Zero_Lag_MTM_Execution</p>
            </div>
          </div>
        </div>

        {summary && (
          <div className="flex items-center gap-4 p-2 bg-void/50 border border-white/5 rounded-3xl backdrop-blur-3xl shadow-2xl">
            <div className={`px-6 py-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-1 min-w-[200px] ${summary.total_return_pct >= 0 ? 'border-emerald-500/10' : 'border-rose-500/10'}`}>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Net Equity Value</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-display font-black text-white">₹{summary.portfolio_value.toLocaleString()}</span>
                <span className={`text-[11px] font-black ${summary.total_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {summary.total_return_pct >= 0 ? '+' : ''}{summary.total_return_pct.toFixed(2)}%
                </span>
              </div>
            </div>
            <button onClick={reload} className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all group">
              <RefreshCw size={20} className={loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'} />
            </button>
          </div>
        )}
      </div>

      {/* Primary Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summary ? (
          <>
            <NeuralStatCard label="Sandbox Balance" value={`₹${summary.cash_balance.toLocaleString()}`} icon={<Wallet className="text-cyan-400" />} highlight="cyan" />
            <NeuralStatCard label="Unrealised Profit" value={`₹${summary.unrealised_pnl.toLocaleString()}`} icon={<Activity />} highlight={summary.unrealised_pnl >= 0 ? "green" : "red"} trend={summary.total_return_pct} />
            <NeuralStatCard label="Settled P&L" value={`₹${summary.realised_pnl.toLocaleString()}`} icon={<DollarSign />} highlight={summary.realised_pnl >= 0 ? "green" : "red"} />
            <NeuralStatCard label="Success Matrix" value={`${summary.win_rate.toFixed(1)}%`} sub={`${history.length} PROTOCOLS_STORED`} icon={<ShieldCheck />} highlight="amber" />
          </>
        ) : [1,2,3,4].map(i => <div key={i} className="h-28 glass-card animate-pulse opacity-50" />)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-stretch">
        {/* Left Control Column */}
        <div className="xl:col-span-4 flex flex-col gap-8">
          <OrderTerminal onTradeSuccess={reload} />
          
          <div className="glass-card p-6 flex flex-col items-center">
            <div className="flex items-center gap-3 self-start mb-8 text-indigo-400">
               <PieChart size={16} />
               <h3 className="text-white font-display font-black text-[10px] uppercase tracking-[0.3em]">Exposure Distribution</h3>
            </div>
            {summary && <WinLossPie wins={Math.max(1, summary.win_rate)} losses={Math.max(1, 100 - summary.win_rate)} />}
            <div className="flex gap-10 mt-10 w-full justify-center">
               <div className="text-center group">
                 <div className="text-[10px] font-black text-emerald-500 group-hover:scale-110 transition-transform tracking-widest uppercase mb-1">Winning Ops</div>
                 <div className="text-2xl font-display font-black text-white">{history.filter(t => t.realised_pnl > 0).length}</div>
               </div>
               <div className="w-[1px] h-10 bg-white/5" />
               <div className="text-center group">
                 <div className="text-[10px] font-black text-rose-500 group-hover:scale-110 transition-transform tracking-widest uppercase mb-1">Risk Events</div>
                 <div className="text-2xl font-display font-black text-white">{history.filter(t => t.realised_pnl < 0).length}</div>
               </div>
            </div>
          </div>
        </div>

        {/* Right Execution View */}
        <div className="xl:col-span-8 flex flex-col gap-8 min-h-[800px]">
          {/* Equity Trajectory Chart */}
          <div className="glass-card p-1 pb-4 bg-void/40 backdrop-blur-xl relative group overflow-hidden">
             <div className="flex justify-between items-center p-6 pb-2">
                <div className="flex items-center gap-3">
                   <Target size={16} className="text-cyan-400" />
                   <h3 className="text-white font-display font-black text-xs uppercase tracking-[0.3em]">Equity Evolution Matrix</h3>
                </div>
                <div className="flex gap-2">
                   {['7D', '1M', '3M', 'MAX'].map(p => (
                     <button key={p} className="px-3 py-1 rounded-lg bg-white/5 border border-white/5 text-[9px] font-black text-slate-500 hover:text-white hover:border-cyan-500/20 transition-all uppercase">{p}</button>
                   ))}
                </div>
             </div>
             <EquityCurveChart data={[
               { date: 'INIT', value: summary?.initial_capital || 1000000 },
               { date: 'T-5', value: (summary?.portfolio_value || 1000000) * 0.98 },
               { date: 'T-4', value: (summary?.portfolio_value || 1000000) * 0.99 },
               { date: 'T-3', value: (summary?.portfolio_value || 1000000) * 1.01 },
               { date: 'T-2', value: (summary?.portfolio_value || 1000000) * 1.005 },
               { date: 'NOW', value: summary?.portfolio_value || 1000000 },
             ]} />
             
             {/* Decorative grid overlay */}
             <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-cyan-500/5 to-transparent pointer-events-none" />
          </div>

          <div className="glass-card p-0 flex flex-col flex-1 overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02]">
              {(["positions", "history"] as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-3 px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === tab ? "text-cyan-400" : "text-slate-600 hover:text-white"}`}
                >
                  {tab === "positions" ? <Briefcase size={12} /> : <History size={12} />}
                  {tab === "positions" ? `Live Clusters (${positions.length})` : `Protocol Archive (${history.length})`}
                  {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan shadow-[0_0_15px_#00d2ff]" />}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-x-auto no-scrollbar">
              {activeTab === "positions" ? (
                positions.length === 0 ? (
                  <div className="p-32 text-center flex flex-col items-center justify-center space-y-4">
                     <div className="w-20 h-20 rounded-full bg-cyan-500/5 border border-cyan-500/10 flex items-center justify-center animate-pulse">
                        <Activity className="text-cyan-500/20" size={32} />
                     </div>
                     <div>
                       <h3 className="text-white font-display font-black text-xl mb-1 uppercase tracking-tight">Vapor Detection</h3>
                       <p className="text-slate-600 text-[10px] font-bold tracking-widest uppercase opacity-40">Initiate Buy Sequence to Spawn Clusters</p>
                     </div>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white/[0.01] border-b border-white/5">
                        {["Cluster Metadata", "Holdings", "Intake Basis", "Mark-to-Market", "Neural Alpha"].map(h => (
                          <th key={h} className="py-4 px-6 text-slate-700 text-[9px] font-black uppercase tracking-[0.2em]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                      {positions.map(p => <PositionMatrixRow key={p.ticker} pos={p} />)}
                    </tbody>
                  </table>
                )
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/[0.01] border-b border-white/5">
                      {["Sync Sequence", "Instrument", "Side", "Units", "Fill NAV", "Settled P&L"].map(h => (
                        <th key={h} className="py-4 px-6 text-slate-700 text-[9px] font-black uppercase tracking-[0.2em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {history.map(t => <HistoryProtocolRow key={t.id} trade={t} />)}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
