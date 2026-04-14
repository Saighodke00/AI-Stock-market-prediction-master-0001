import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import {
  TrendingUp, TrendingDown, Wallet, BarChart2, Target,
  RefreshCw, ArrowUpRight, ArrowDownRight, Plus, Minus,
  Activity, Clock, CheckCircle2, AlertCircle, Zap, Trash2,
  ChevronDown, ChevronUp
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Position {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  unrealised_pnl: number;
  unrealised_pct: number;
  opened_at: string;
}

interface Trade {
  id: string;
  ticker: string;
  action: "BUY" | "SELL";
  quantity: number;
  price: number;
  total: number;
  realised_pnl: number;
  executed_at: string;
}

interface PortfolioSummary {
  cash_balance: number;
  invested_value: number;
  portfolio_value: number;
  unrealised_pnl: number;
  realised_pnl: number;
  total_return_pct: number;
  win_rate: number;
  trade_count: number;
  open_positions: number;
  initial_capital: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number, d = 2) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);

const fmtCur = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

// ─── Equity Chart ─────────────────────────────────────────────────────────────

const EquityChart: React.FC<{ trades: Trade[]; initialCapital: number }> = ({
  trades, initialCapital,
}) => {
  const chartData = React.useMemo(() => {
    if (!trades || trades.length === 0) {
      return [{ date: "Start", value: initialCapital }];
    }

    const sorted = [...trades].sort(
      (a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime()
    );

    let runningCapital = initialCapital;
    const points = [{ date: "Start", value: initialCapital }];

    sorted.forEach((t) => {
      if (t.action === "SELL" && t.realised_pnl !== 0) {
        runningCapital += t.realised_pnl;
      }
      const label = new Date(t.executed_at).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short",
      });
      points.push({ date: label, value: Math.round(runningCapital) });
    });

    return points;
  }, [trades, initialCapital]);

  const lastVal = chartData[chartData.length - 1]?.value ?? initialCapital;
  const isGrowth = lastVal >= initialCapital;
  const chartColor = isGrowth ? "#10b981" : "#f43f5e";

  return (
    <div className="w-full h-40">
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "#64748b", fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#64748b", fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `₹${v / 1000}k`}
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: "#0a111f",
              border: "1px solid rgba(0, 210, 255, 0.2)",
              borderRadius: 8,
              fontSize: 11,
              fontFamily: "monospace",
              color: "#f8fafc",
            }}
            formatter={(v: number) => [fmtCur(v), "Portfolio Value"]}
          />
          <ReferenceLine y={initialCapital} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="value"
            stroke={chartColor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: chartColor }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Trade Execute Panel ──────────────────────────────────────────────────────

const TradePanel: React.FC<{
  onTrade: (ticker: string, action: "BUY" | "SELL", qty: number, price: number) => Promise<void>;
  cashBalance: number;
}> = ({ onTrade, cashBalance }) => {
  const [ticker, setTicker] = useState("");
  const [action, setAction] = useState<"BUY" | "SELL">("BUY");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");
  const [fetching, setFetching] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const fetchPrice = async () => {
    if (!ticker.trim()) return;
    setFetching(true);
    try {
      const t = ticker.trim().toUpperCase();
      const fullTicker = t.includes(".NS") || t.includes(".BO") ? t : ${t}.NS;
      const res = await fetch("/api/signal/?mode=swing");
      if (res.ok) {
        const d = await res.json();
        const p = d.current_price || d.price;
        if (p) setPrice(String(Math.round(p * 100) / 100));
      }
    } catch {}
    setFetching(false);
  };

  const handleSubmit = async () => {
    if (!ticker || !price || qty < 1) return;
    setExecuting(true);
    setMsg(null);
    const fullTicker = ticker.trim().toUpperCase();
    const t = fullTicker.includes(".NS") || fullTicker.includes(".BO") ? fullTicker : ${fullTicker}.NS;
    try {
      await onTrade(t, action, qty, Number(price));
      setMsg({ text: ${action} executed —  ×  @ ₹, ok: true });
      setTimeout(() => setMsg(null), 4000);
    } catch (err: any) {
      setMsg({ text: err.message || "Trade failed", ok: false });
    }
    setExecuting(false);
  };

  const totalCost = qty * Number(price || 0);
  const canAfford = action === "BUY" ? totalCost <= cashBalance : true;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={15} className="text-cyan" />
        <span className="neon-label text-text-muted">
          Neural Order Entry
        </span>
      </div>

      {/* Action selector */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {(["BUY", "SELL"] as const).map(a => (
          <button
            key={a}
            onClick={() => setAction(a)}
            className={"p-2.5 rounded-lg border font-data font-bold text-sm transition-all "}
          >
            {a === "BUY" ? "↑ BUY" : "↓ SELL"}
          </button>
        ))}
      </div>

      {/* Ticker input */}
      <div className="flex gap-2 mb-3">
        <input
          value={ticker}
          onChange={e => setTicker(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchPrice()}
          placeholder="Ticker (e.g. RELIANCE)"
          className="flex-1 bg-white/5 border border-border-dim rounded-lg p-2.5 text-text-primary text-sm font-data outline-none focus:border-border-bright"
        />
        <button
          onClick={fetchPrice}
          disabled={fetching}
          className="px-3 py-2.5 bg-cyan/10 border border-cyan/20 rounded-lg text-cyan font-data text-xs cursor-pointer hover:bg-cyan/20 transition-all"
        >
          {fetching ? "..." : "↓ LTP"}
        </button>
      </div>

      {/* Price & Qty */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div>
          <label className="block text-[10px] text-text-muted font-data mb-1.5">
            PRICE (₹)
          </label>
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="0.00"
            className="w-full bg-white/5 border border-border-dim rounded-lg p-2.5 text-text-primary text-sm font-data outline-none focus:border-border-bright"
          />
        </div>
        <div>
          <label className="block text-[10px] text-text-muted font-data mb-1.5">
            QUANTITY
          </label>
          <div className="flex items-center">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="px-3 py-2.5 bg-white/5 border border-border-dim rounded-l-lg text-text-muted hover:bg-white/10"
            >
              <Minus size={12} />
            </button>
            <input
              type="number"
              value={qty}
              onChange={e => setQty(Math.max(1, Number(e.target.value)))}
              className="flex-1 text-center bg-white/5 border-y border-border-dim border-x-0 py-2.5 text-text-primary text-sm font-data outline-none w-full"
            />
            <button
              onClick={() => setQty(qty + 1)}
              className="px-3 py-2.5 bg-white/5 border border-border-dim rounded-r-lg text-text-muted hover:bg-white/10"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Total cost */}
      {totalCost > 0 && (
        <div className={"flex justify-between items-center p-3 rounded-lg mb-4 border "}>
          <span className="text-xs text-text-muted font-data">Total Cost</span>
          <span className={"text-sm font-bold font-data "}>
            {fmtCur(totalCost)}
            {!canAfford && <span className="text-[10px] ml-1.5 opacity-80">— Insufficient funds</span>}
          </span>
        </div>
      )}

      {/* Execute button */}
      <button
        onClick={handleSubmit}
        disabled={executing || !ticker || !price || !canAfford}
        className={"w-full flex items-center justify-center gap-2 p-3 rounded-lg border font-data font-bold text-sm transition-all "}
      >
        {executing ? (
          <><RefreshCw size={14} className="animate-spin" /> Processing...</>
        ) : action === "BUY" ? (
          <><TrendingUp size={14} /> Execute BUY</>
        ) : (
          <><TrendingDown size={14} /> Execute SELL</>
        )}
      </button>

      {/* Status message */}
      {msg && (
        <div className={"flex items-center gap-2 mt-3 p-2.5 rounded-lg border font-data text-xs "}>
          {msg.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
          {msg.text}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const PaperTradingPage: React.FC = () => {
  const { token } = useAuthStore() as any;
  const navigate = useNavigate();

  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [history, setHistory] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"positions" | "history">("positions");
  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer ",
  };

  const fetchAll = useCallback(async () => {
    if (!token) { navigate("/login"); return; }
    setLoading(true);
    try {
      const [sumRes, posRes, hisRes] = await Promise.all([
        fetch("/api/paper/summary", { headers }),
        fetch("/api/paper/positions", { headers }),
        fetch("/api/paper/history", { headers }),
      ]);

      if (sumRes.ok) setSummary(await sumRes.json());
      if (posRes.ok) {
        const d = await posRes.json();
        setPositions(d.positions || []);
      }
      if (hisRes.ok) {
        const d = await hisRes.json();
        setHistory(d.history || []);
      }
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchAll(); }, []);

  const executeTrade = async (
    ticker: string,
    action: "BUY" | "SELL",
    qty: number,
    price: number
  ) => {
    const res = await fetch("/api/paper/trade", {
      method: "POST",
      headers,
      body: JSON.stringify({ ticker, action, quantity: qty, price, confidence: 0.7 }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Trade failed");
    }
    await fetchAll();
  };

  const resetPortfolio = async () => {
    setResetting(true);
    try {
      await fetch("/api/paper/reset", { method: "DELETE", headers });
      await fetchAll();
      setShowReset(false);
    } catch {}
    setResetting(false);
  };

  return (
    <div className="page-container py-8 animate-page-in">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-5 border-b border-border-dim">
        <div className="flex items-center gap-3">
          <Wallet size={24} className="text-cyan" />
          <div>
            <h1 className="m-0 text-2xl font-display font-bold text-text-primary tracking-wide">
              PAPER TRADING
            </h1>
            <div className="text-xs text-text-muted font-data">
              Neural Ledger — Zero-Risk Simulation
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchAll} className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-border-dim rounded-lg text-text-muted font-data text-xs hover:text-text-primary hover:border-border-bright transition-all">
            <RefreshCw size={12} /> REFRESH
          </button>
          <button onClick={() => setShowReset(!showReset)} className="flex items-center gap-1.5 px-3 py-2 bg-rose/5 border border-rose/10 rounded-lg text-rose font-data text-xs hover:bg-rose/10 transition-all">
            <Trash2 size={12} /> RESET
          </button>
        </div>
      </div>

      {/* Reset confirmation */}
      {showReset && (
        <div className="flex items-center justify-between p-4 mb-6 bg-rose/5 border border-rose/20 rounded-xl">
          <span className="text-rose/80 text-sm">Reset portfolio to ₹10,00,000? All trades will be deleted.</span>
          <div className="flex gap-2">
            <button onClick={() => setShowReset(false)} className="px-3 py-1.5 bg-transparent border border-white/10 rounded-lg text-text-muted text-xs font-data hover:text-text-primary">
              Cancel
            </button>
            <button onClick={resetPortfolio} disabled={resetting} className="px-3 py-1.5 bg-rose/10 border border-rose/30 rounded-lg text-rose text-xs font-data hover:bg-rose/20">
              {resetting ? "Resetting..." : "Confirm Reset"}
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        {/* LEFT: Summary + Chart + Positions */}
        <div className="flex flex-col gap-6">

          {/* ── Portfolio Summary ───────────────────────────────────────────── */}
          <div className="neon-frame rounded-2xl p-6">
            {summary ? (
              <>
                {/* Main value */}
                <div className="mb-5">
                  <div className="font-data-small text-text-muted mb-1">
                    TOTAL NET ASSET VALUE
                  </div>
                  <div className="flex items-baseline flex-wrap gap-4">
                    <span className="font-display font-black text-4xl text-text-primary tracking-tight">
                      {fmtCur(summary.portfolio_value)}
                    </span>
                    <span className={"flex items-center gap-1 font-bold text-sm "}>
                      {summary.total_return_pct >= 0 ? <ArrowUpRight size={16} strokeWidth={3} /> : <ArrowDownRight size={16} strokeWidth={3} />}
                      {summary.total_return_pct >= 0 ? "+" : ""}{fmt(summary.total_return_pct)}%
                    </span>
                  </div>
                  <div className="text-xs text-text-muted mt-1">
                    Started with {fmtCur(summary.initial_capital || 1000000)}
                  </div>
                </div>

                {/* Equity chart */}
                <div className="mb-5">
                  <EquityChart trades={history} initialCapital={summary.initial_capital || 1000000} />
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "CASH", value: fmtCur(summary.cash_balance), colorClass: "text-cyan", icon: <Wallet size={12} /> },
                    { label: "INVESTED", value: fmtCur(summary.invested_value), colorClass: "text-indigo", icon: <BarChart2 size={12} /> },
                    { label: "UNREALISED", value: ${summary.unrealised_pnl >= 0 ? '+' : ''}, colorClass: summary.unrealised_pnl >= 0 ? "text-emerald" : "text-rose", icon: summary.unrealised_pnl >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} /> },
                    { label: "REALISED", value: ${summary.realised_pnl >= 0 ? '+' : ''}, colorClass: summary.realised_pnl >= 0 ? "text-emerald" : "text-rose", icon: <Target size={12} /> },
                  ].map(s => (
                    <div key={s.label} className="glass-card p-3 rounded-xl">
                      <div className={"flex items-center gap-1.5 mb-1 "}>
                        {s.icon}
                        <span className="font-data-tiny text-text-muted">{s.label}</span>
                      </div>
                      <div className={"font-data font-bold text-sm "}>
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom meta */}
                <div className="flex gap-6 mt-4 pt-4 border-t border-border-dim">
                  {[
                    { label: "WIN RATE", value: ${fmt(summary.win_rate)}%, good: summary.win_rate >= 50 },
                    { label: "OPEN POSITIONS", value: summary.open_positions, good: null },
                    { label: "TOTAL TRADES", value: summary.trade_count, good: null },
                  ].map(s => (
                    <div key={s.label} className="flex flex-col gap-0.5">
                      <div className="font-data-tiny text-text-muted">{s.label}</div>
                      <div className={"font-display text-2xl font-bold "}>
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-10 text-center text-text-muted">
                <div className="inline-block w-6 h-6 border-2 border-cyan/20 border-t-cyan rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* ── Positions / History Tabs ─────────────────────────────────────── */}
          <div className="glass-card overflow-hidden !p-0 border border-border-mid rounded-2xl">
            {/* Tab header */}
            <div className="flex border-b border-border-dim">
              {(["positions", "history"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={"flex-1 flex items-center justify-center gap-2 p-3 font-data text-xs font-bold uppercase transition-all "}
                >
                  {tab === "positions" ? <Activity size={13} /> : <Clock size={13} />}
                  {tab} {tab === "positions" ? () : ()}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar">
              {activeTab === "positions" ? (
                positions.length === 0 ? (
                  <div className="py-10 text-center text-text-muted">
                    <Activity size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-data m-0">
                      No open positions. Execute a BUY order to begin.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-xs font-data text-left border-collapse">
                    <thead className="bg-white/5 sticky top-0 backdrop-blur-md">
                      <tr>
                        {["Ticker", "Qty", "Avg Cost", "Mkt Value", "P&L", "Return %"].map(h => (
                          <th key={h} className="p-3 text-text-muted font-bold tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dim">
                      {positions.map((p) => (
                        <tr key={p.ticker} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 text-text-primary font-bold">
                            {p.ticker.replace(".NS", "").replace(".BO", "")}
                          </td>
                          <td className="p-3 text-text-secondary">{p.quantity}</td>
                          <td className="p-3 text-text-secondary">₹{fmt(p.avg_cost)}</td>
                          <td className="p-3 text-text-secondary">₹{fmt(p.market_value)}</td>
                          <td className={"p-3 font-bold "}>
                            {p.unrealised_pnl >= 0 ? "+" : ""}₹{fmt(p.unrealised_pnl)}
                          </td>
                          <td className={"p-3 "}>
                            {p.unrealised_pct >= 0 ? "+" : ""}{fmt(p.unrealised_pct)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                history.length === 0 ? (
                  <div className="py-10 text-center text-text-muted">
                    <Clock size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-data m-0">No trade history yet.</p>
                  </div>
                ) : (
                  <table className="w-full text-xs font-data text-left border-collapse">
                    <thead className="bg-white/5 sticky top-0 backdrop-blur-md">
                      <tr>
                        {["Ticker", "Action", "Qty", "Price", "Total", "P&L", "Time"].map(h => (
                          <th key={h} className="p-3 text-text-muted font-bold tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-dim">
                      {history.slice(0, 30).map((t) => (
                        <tr key={t.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 text-text-primary font-bold">
                            {t.ticker.replace(".NS", "").replace(".BO", "")}
                          </td>
                          <td className="p-3">
                            <span className={"px-2 py-0.5 rounded font-bold "}>
                              {t.action}
                            </span>
                          </td>
                          <td className="p-3 text-text-secondary">{t.quantity}</td>
                          <td className="p-3 text-text-secondary">₹{fmt(t.price)}</td>
                          <td className="p-3 text-text-secondary">₹{fmt(t.total)}</td>
                          <td className={"p-3 font-bold "}>
                            {t.action === "SELL" ? ${t.realised_pnl >= 0 ? "+" : ""}₹ : "─"}
                          </td>
                          <td className="p-3 text-text-muted">{fmtDate(t.executed_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Trade Panel */}
        <div>
          <TradePanel onTrade={executeTrade} cashBalance={summary?.cash_balance ?? 1000000} />
        </div>
      </div>
    </div>
  );
};

export default PaperTradingPage;
