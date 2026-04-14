/**
 * PaperTradingPage.tsx — APEX AI Paper Trading v2.0
 *
 * Fixes:
 *  1. Real-time P&L that persists and shows growth/loss correctly
 *  2. Equity curve chart that reflects actual trade history
 *  3. Position MTM updated from live price on each load
 *  4. Proper win/loss tracking visible at a glance
 *  5. Personalized, connected UI matching Dashboard aesthetic
 */

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "@/store/useAuthStore";
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
  // Build equity curve from trade history
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
  const chartColor = isGrowth ? "#00e676" : "#ff4b4b";

  return (
    <div style={{ width: "100%", height: 160 }}>
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
            tick={{ fontSize: 9, fill: "#3a5a7a", fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#3a5a7a", fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: "#0a192f",
              border: "1px solid rgba(99,179,237,0.2)",
              borderRadius: 8,
              fontSize: 11,
              fontFamily: "monospace",
              color: "#c8d8f0",
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
      const fullTicker = t.includes(".NS") || t.includes(".BO") ? t : `${t}.NS`;
      const res = await fetch(`/api/signal/${fullTicker}?mode=swing`);
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
    const t = fullTicker.includes(".NS") || fullTicker.includes(".BO") ? fullTicker : `${fullTicker}.NS`;
    try {
      await onTrade(t, action, qty, Number(price));
      setMsg({ text: `${action} executed — ${qty} × ${t} @ ₹${price}`, ok: true });
      setTimeout(() => setMsg(null), 4000);
    } catch (err: any) {
      setMsg({ text: err.message || "Trade failed", ok: false });
    }
    setExecuting(false);
  };

  const totalCost = qty * Number(price || 0);
  const canAfford = action === "BUY" ? totalCost <= cashBalance : true;

  return (
    <div style={{
      background: "rgba(8,16,32,0.8)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14,
      padding: "20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <Zap size={15} color="#63b3ed" />
        <span style={{ fontSize: 11, letterSpacing: 2, color: "#4a6a8a", textTransform: "uppercase", fontFamily: "monospace" }}>
          Neural Order Entry
        </span>
      </div>

      {/* Action selector */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {(["BUY", "SELL"] as const).map(a => (
          <button
            key={a}
            onClick={() => setAction(a)}
            style={{
              padding: "10px",
              border: action === a
                ? `1px solid ${a === "BUY" ? "rgba(0,230,118,0.4)" : "rgba(255,75,75,0.4)"}`
                : "1px solid rgba(255,255,255,0.06)",
              background: action === a
                ? a === "BUY" ? "rgba(0,230,118,0.1)" : "rgba(255,75,75,0.1)"
                : "transparent",
              borderRadius: 8,
              cursor: "pointer",
              color: action === a
                ? a === "BUY" ? "#00e676" : "#ff4b4b"
                : "#5a7a9a",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "monospace",
              transition: "all 0.15s",
            }}
          >
            {a === "BUY" ? "↑ BUY" : "↓ SELL"}
          </button>
        ))}
      </div>

      {/* Ticker input */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          value={ticker}
          onChange={e => setTicker(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchPrice()}
          placeholder="Ticker (e.g. RELIANCE)"
          style={{
            flex: 1, background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, padding: "10px 14px",
            color: "#c8d8f0", fontSize: 13, fontFamily: "monospace",
            outline: "none",
          }}
        />
        <button
          onClick={fetchPrice}
          disabled={fetching}
          style={{
            background: "rgba(99,179,237,0.08)",
            border: "1px solid rgba(99,179,237,0.2)",
            borderRadius: 8, padding: "10px 12px",
            cursor: "pointer", color: "#63b3ed",
            fontSize: 11, fontFamily: "monospace",
          }}
        >
          {fetching ? "..." : "↓ LTP"}
        </button>
      </div>

      {/* Price & Qty */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 10, color: "#3a5a7a", fontFamily: "monospace", display: "block", marginBottom: 5 }}>
            PRICE (₹)
          </label>
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="0.00"
            style={{
              width: "100%", background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: "10px 14px",
              color: "#c8d8f0", fontSize: 14, fontFamily: "monospace",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 10, color: "#3a5a7a", fontFamily: "monospace", display: "block", marginBottom: 5 }}>
            QUANTITY
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px 0 0 8px",
                padding: "10px 12px", cursor: "pointer", color: "#7a9ab0",
              }}
            >
              <Minus size={12} />
            </button>
            <input
              type="number"
              value={qty}
              onChange={e => setQty(Math.max(1, Number(e.target.value)))}
              style={{
                flex: 1, textAlign: "center",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                borderLeft: "none", borderRight: "none",
                padding: "10px 6px",
                color: "#c8d8f0", fontSize: 14, fontFamily: "monospace",
                outline: "none",
              }}
            />
            <button
              onClick={() => setQty(qty + 1)}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "0 8px 8px 0",
                padding: "10px 12px", cursor: "pointer", color: "#7a9ab0",
              }}
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Total cost */}
      {totalCost > 0 && (
        <div style={{
          display: "flex", justifyContent: "space-between",
          padding: "8px 12px", marginBottom: 12,
          background: canAfford ? "rgba(0,230,118,0.05)" : "rgba(255,75,75,0.05)",
          border: `1px solid ${canAfford ? "rgba(0,230,118,0.15)" : "rgba(255,75,75,0.15)"}`,
          borderRadius: 8,
        }}>
          <span style={{ fontSize: 11, color: "#4a6a8a", fontFamily: "monospace" }}>Total Cost</span>
          <span style={{
            fontSize: 13, fontWeight: 700, fontFamily: "monospace",
            color: canAfford ? "#00e676" : "#ff4b4b",
          }}>
            {fmtCur(totalCost)}
            {!canAfford && <span style={{ fontSize: 10, marginLeft: 6 }}>— Insufficient funds</span>}
          </span>
        </div>
      )}

      {/* Execute button */}
      <button
        onClick={handleSubmit}
        disabled={executing || !ticker || !price || !canAfford}
        style={{
          width: "100%",
          background: executing || !ticker || !price || !canAfford
            ? "rgba(255,255,255,0.04)"
            : action === "BUY"
              ? "linear-gradient(135deg, rgba(0,230,118,0.2), rgba(0,160,80,0.1))"
              : "linear-gradient(135deg, rgba(255,75,75,0.2), rgba(200,40,40,0.1))",
          border: `1px solid ${executing || !ticker || !price || !canAfford
            ? "rgba(255,255,255,0.06)"
            : action === "BUY" ? "rgba(0,230,118,0.3)" : "rgba(255,75,75,0.3)"}`,
          borderRadius: 10,
          padding: "13px",
          cursor: executing || !ticker || !price || !canAfford ? "not-allowed" : "pointer",
          color: executing || !ticker || !price || !canAfford
            ? "#3a5a7a"
            : action === "BUY" ? "#00e676" : "#ff4b4b",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "monospace",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "all 0.2s",
        }}
      >
        {executing
          ? <><RefreshCw size={14} /> Processing...</>
          : action === "BUY"
            ? <><TrendingUp size={14} /> Execute BUY</>
            : <><TrendingDown size={14} /> Execute SELL</>}
      </button>

      {/* Status message */}
      {msg && (
        <div style={{
          marginTop: 12,
          padding: "8px 12px",
          background: msg.ok ? "rgba(0,230,118,0.08)" : "rgba(255,75,75,0.08)",
          border: `1px solid ${msg.ok ? "rgba(0,230,118,0.2)" : "rgba(255,75,75,0.2)"}`,
          borderRadius: 8,
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, fontFamily: "monospace",
          color: msg.ok ? "#00e676" : "#ff4b4b",
        }}>
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
    Authorization: `Bearer ${token}`,
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

  const totalPnl = summary
    ? summary.unrealised_pnl + summary.realised_pnl
    : 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060b14",
      color: "#c8d8f0",
      fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(99,179,237,0.15); border-radius: 99px; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "24px 40px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Wallet size={20} color="#63b3ed" />
          <div>
            <h1 style={{
              margin: 0, fontSize: 18,
              fontFamily: "'Orbitron', monospace",
              fontWeight: 900, color: "#e2e8f0", letterSpacing: 1,
            }}>
              PAPER TRADING
            </h1>
            <div style={{ fontSize: 11, color: "#3a5a7a", fontFamily: "monospace" }}>
              Neural Ledger — Zero-Risk Simulation
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={fetchAll} style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 8, padding: "8px 14px",
            cursor: "pointer", color: "#4a6a8a",
            fontSize: 12, fontFamily: "monospace",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <RefreshCw size={12} /> Refresh
          </button>
          <button onClick={() => setShowReset(!showReset)} style={{
            background: "rgba(255,75,75,0.05)",
            border: "1px solid rgba(255,75,75,0.15)",
            borderRadius: 8, padding: "8px 14px",
            cursor: "pointer", color: "#ff4b4b",
            fontSize: 12, fontFamily: "monospace",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Trash2 size={12} /> Reset
          </button>
        </div>
      </div>

      {/* Reset confirmation */}
      {showReset && (
        <div style={{
          margin: "0 40px",
          padding: "12px 16px",
          background: "rgba(255,75,75,0.06)",
          border: "1px solid rgba(255,75,75,0.2)",
          borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 16,
          fontSize: 13,
        }}>
          <span style={{ color: "#ff8080" }}>Reset portfolio to ₹10,00,000? All trades will be deleted.</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowReset(false)} style={{
              background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6, padding: "5px 12px", cursor: "pointer",
              color: "#5a7a9a", fontSize: 12, fontFamily: "monospace",
            }}>
              Cancel
            </button>
            <button onClick={resetPortfolio} disabled={resetting} style={{
              background: "rgba(255,75,75,0.15)", border: "1px solid rgba(255,75,75,0.3)",
              borderRadius: 6, padding: "5px 12px", cursor: "pointer",
              color: "#ff4b4b", fontSize: 12, fontFamily: "monospace",
            }}>
              {resetting ? "Resetting..." : "Confirm Reset"}
            </button>
          </div>
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 320px",
        gap: 0,
        padding: "24px 40px",
        gap: "24px",
      }}>
        {/* LEFT: Summary + Chart + Positions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* ── Portfolio Summary ───────────────────────────────────────────── */}
          <div style={{
            background: "linear-gradient(135deg, rgba(10,25,50,0.8), rgba(6,15,30,0.9))",
            border: "1px solid rgba(99,179,237,0.12)",
            borderRadius: 16,
            padding: "24px",
            animation: "fadeIn 0.4s ease",
          }}>
            {summary ? (
              <>
                {/* Main value */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "#4a6a8a", fontFamily: "monospace", marginBottom: 4 }}>
                    Total Net Asset Value
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 38, fontWeight: 900, fontFamily: "'Orbitron', monospace", color: "#e2e8f0",
                    }}>
                      {fmtCur(summary.portfolio_value)}
                    </span>
                    <span style={{
                      fontSize: 15, fontWeight: 600,
                      color: summary.total_return_pct >= 0 ? "#00e676" : "#ff4b4b",
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      {summary.total_return_pct >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                      {summary.total_return_pct >= 0 ? "+" : ""}{fmt(summary.total_return_pct)}%
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#3a5a7a", marginTop: 4 }}>
                    Started with {fmtCur(summary.initial_capital || 1000000)}
                  </div>
                </div>

                {/* Equity chart */}
                <div style={{ marginBottom: 20 }}>
                  <EquityChart trades={history} initialCapital={summary.initial_capital || 1000000} />
                </div>

                {/* Stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  {[
                    {
                      label: "Cash", value: fmtCur(summary.cash_balance),
                      color: "#63b3ed", icon: <Wallet size={12} />,
                    },
                    {
                      label: "Invested", value: fmtCur(summary.invested_value),
                      color: "#a78bfa", icon: <BarChart2 size={12} />,
                    },
                    {
                      label: "Unrealised", value: `${summary.unrealised_pnl >= 0 ? "+" : ""}${fmtCur(summary.unrealised_pnl)}`,
                      color: summary.unrealised_pnl >= 0 ? "#00e676" : "#ff4b4b",
                      icon: summary.unrealised_pnl >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />,
                    },
                    {
                      label: "Realised", value: `${summary.realised_pnl >= 0 ? "+" : ""}${fmtCur(summary.realised_pnl)}`,
                      color: summary.realised_pnl >= 0 ? "#00e676" : "#ff4b4b",
                      icon: <Target size={12} />,
                    },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      borderRadius: 10, padding: "12px 10px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, color: s.color, marginBottom: 5 }}>
                        {s.icon}
                        <span style={{ fontSize: 9, fontFamily: "monospace", color: "#3a5a7a" }}>{s.label}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom meta */}
                <div style={{
                  display: "flex", gap: 24, marginTop: 16,
                  paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)",
                }}>
                  {[
                    { label: "Win Rate", value: `${fmt(summary.win_rate)}%`, color: summary.win_rate >= 50 ? "#00e676" : "#ff4b4b" },
                    { label: "Open Positions", value: summary.open_positions, color: "#7a9ab0" },
                    { label: "Total Trades", value: summary.trade_count, color: "#7a9ab0" },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize: 10, color: "#3a5a7a", fontFamily: "monospace" }}>{s.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Orbitron', monospace", color: s.color }}>
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "40px", color: "#3a5a7a" }}>
                <div style={{
                  display: "inline-block", width: 28, height: 28,
                  border: "2px solid rgba(99,179,237,0.2)",
                  borderTopColor: "#63b3ed",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
          </div>

          {/* ── Positions / History Tabs ─────────────────────────────────────── */}
          <div style={{
            background: "rgba(8,16,32,0.8)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            overflow: "hidden",
            animation: "fadeIn 0.5s ease",
          }}>
            {/* Tab header */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {(["positions", "history"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: "14px",
                    background: activeTab === tab ? "rgba(99,179,237,0.06)" : "transparent",
                    border: "none",
                    borderBottom: activeTab === tab ? "2px solid #63b3ed" : "2px solid transparent",
                    cursor: "pointer",
                    color: activeTab === tab ? "#63b3ed" : "#5a7a9a",
                    fontSize: 12, fontWeight: 600, fontFamily: "monospace",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    textTransform: "uppercase", letterSpacing: 1,
                    transition: "all 0.15s",
                  }}
                >
                  {tab === "positions" ? <Activity size={13} /> : <Clock size={13} />}
                  {tab} {tab === "positions" ? `(${positions.length})` : `(${history.length})`}
                </button>
              ))}
            </div>

            {/* Table */}
            <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
              {activeTab === "positions" ? (
                positions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#3a5a7a" }}>
                    <Activity size={28} style={{ marginBottom: 10, opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: 13, fontFamily: "monospace" }}>
                      No open positions. Execute a BUY order to begin.
                    </p>
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace" }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                        {["Ticker", "Qty", "Avg Cost", "Mkt Value", "P&L", "Return %"].map(h => (
                          <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#3a5a7a", fontSize: 10, letterSpacing: 1, fontWeight: 600 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((p, i) => (
                        <tr key={p.ticker} style={{
                          borderTop: "1px solid rgba(255,255,255,0.03)",
                          background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                        }}>
                          <td style={{ padding: "10px 16px", color: "#c8d8f0", fontWeight: 600 }}>
                            {p.ticker.replace(".NS", "").replace(".BO", "")}
                          </td>
                          <td style={{ padding: "10px 16px", color: "#7a9ab0" }}>{p.quantity}</td>
                          <td style={{ padding: "10px 16px", color: "#7a9ab0" }}>₹{fmt(p.avg_cost)}</td>
                          <td style={{ padding: "10px 16px", color: "#7a9ab0" }}>₹{fmt(p.market_value)}</td>
                          <td style={{ padding: "10px 16px", color: p.unrealised_pnl >= 0 ? "#00e676" : "#ff4b4b", fontWeight: 700 }}>
                            {p.unrealised_pnl >= 0 ? "+" : ""}₹{fmt(p.unrealised_pnl)}
                          </td>
                          <td style={{ padding: "10px 16px", color: p.unrealised_pct >= 0 ? "#00e676" : "#ff4b4b" }}>
                            {p.unrealised_pct >= 0 ? "+" : ""}{fmt(p.unrealised_pct)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                history.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#3a5a7a" }}>
                    <Clock size={28} style={{ marginBottom: 10, opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: 13, fontFamily: "monospace" }}>
                      No trade history yet.
                    </p>
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace" }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                        {["Ticker", "Action", "Qty", "Price", "Total", "P&L", "Time"].map(h => (
                          <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#3a5a7a", fontSize: 10, letterSpacing: 1, fontWeight: 600 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.slice(0, 30).map((t, i) => (
                        <tr key={t.id} style={{
                          borderTop: "1px solid rgba(255,255,255,0.03)",
                          background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                        }}>
                          <td style={{ padding: "10px 16px", color: "#c8d8f0", fontWeight: 600 }}>
                            {t.ticker.replace(".NS", "").replace(".BO", "")}
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            <span style={{
                              padding: "2px 8px", borderRadius: 4,
                              background: t.action === "BUY" ? "rgba(0,230,118,0.1)" : "rgba(255,75,75,0.1)",
                              color: t.action === "BUY" ? "#00e676" : "#ff4b4b",
                              fontSize: 10, fontWeight: 700,
                            }}>
                              {t.action}
                            </span>
                          </td>
                          <td style={{ padding: "10px 16px", color: "#7a9ab0" }}>{t.quantity}</td>
                          <td style={{ padding: "10px 16px", color: "#7a9ab0" }}>₹{fmt(t.price)}</td>
                          <td style={{ padding: "10px 16px", color: "#7a9ab0" }}>₹{fmt(t.total)}</td>
                          <td style={{ padding: "10px 16px", color: t.realised_pnl >= 0 ? "#00e676" : "#ff4b4b", fontWeight: 700 }}>
                            {t.action === "SELL"
                              ? `${t.realised_pnl >= 0 ? "+" : ""}₹${fmt(t.realised_pnl)}`
                              : "—"}
                          </td>
                          <td style={{ padding: "10px 16px", color: "#3a5a7a" }}>{fmtDate(t.executed_at)}</td>
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
