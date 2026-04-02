// ============================================================
// Dashboard.tsx — Apex AI Mission Control v4.0
// FIXES: Price bug (p50 vs current_price), loading states,
//        empty sections, slow performance, mock data
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Activity, Zap, RefreshCw,
  AlertCircle, CheckCircle, Clock, BarChart2, Target,
  Shield, Eye, Cpu, Wifi, WifiOff, ChevronRight,
  ArrowUpRight, ArrowDownRight, Minus
} from "lucide-react";

// ── TYPES ─────────────────────────────────────────────────────
interface SignalData {
  ticker: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  current_price: number;   // ✅ FIXED: use this, NOT p50
  price: number;
  price_change_pct: number;
  pct_change: number;
  p10: number;
  p50: number;
  p90: number;
  rsi: number;
  sparkline: number[];
  regime: string;
  sentiment: { score: number; label: string };
  gate_results: {
    gate1_cone: boolean;
    gate2_sentiment: boolean;
    gate3_technical: boolean;
    gates_passed: boolean;
  };
  error?: string;
}

interface MarketPulse {
  nifty: { price: number; change_pct: number; sparkline: number[] };
  vix: { price: number; color: string };
  fii_flow: { total_flow: number; fii_net: number; dii_net: number; sentiment: string } | null;
  status: string;
}

interface DashboardStats {
  today_buys: number;
  today_sells: number;
  avg_confidence: number;
  market_breadth: { buys: number; sells: number; holds: number; total: number };
  top_signal: { ticker: string; conf: number; action: string; price: number };
}

interface LogEntry {
  timestamp: string;
  message: string;
  level: string;
}

interface PortfolioStats {
  pnl: number;
  return_pct: number;
  active_positions: number;
}

// ── CONSTANTS ─────────────────────────────────────────────────
const API_BASE = "";
const NSE_TICKERS = [
  "RELIANCE.NS","TCS.NS","HDFCBANK.NS","ICICIBANK.NS","INFY.NS",
  "SBIN.NS","BHARTIARTL.NS","ITC.NS","LT.NS","BAJFINANCE.NS",
  "HCLTECH.NS","MARUTI.NS","SUNPHARMA.NS","WIPRO.NS","NTPC.NS",
  "KOTAKBANK.NS","TITAN.NS","AXISBANK.NS","TECHM.NS","ONGC.NS"
];

// ── API HELPERS ────────────────────────────────────────────────
const fetchWithTimeout = async (url: string, timeout = 12000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
};

// ── MINI SPARKLINE SVG ────────────────────────────────────────
function Sparkline({ data, color, height = 36, width = 100 }: {
  data: number[]; color: string; height?: number; width?: number;
}) {
  if (!data || data.length < 2) return (
    <div style={{ width, height }} className="flex items-end">
      <div className="w-full h-px opacity-20" style={{ backgroundColor: color }} />
    </div>
  );

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-500"
      />
    </svg>
  );
}

// ── SKELETON LOADER ───────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-white/5 ${className}`} />
  );
}

// ── SIGNAL BADGE ──────────────────────────────────────────────
function SignalBadge({ action, size = "sm" }: { action: string; size?: "sm" | "lg" }) {
  const cfg = {
    BUY:  { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/40" },
    SELL: { bg: "bg-rose-500/20",    text: "text-rose-400",    border: "border-rose-500/40" },
    HOLD: { bg: "bg-amber-500/20",   text: "text-amber-400",   border: "border-amber-500/40" },
  }[action] ?? { bg: "bg-white/5", text: "text-white/50", border: "border-white/10" };

  return (
    <span className={`
      inline-flex items-center border rounded font-mono font-bold tracking-wider
      ${cfg.bg} ${cfg.text} ${cfg.border}
      ${size === "lg" ? "text-xs px-3 py-1" : "text-[10px] px-2 py-0.5"}
    `}>
      {action === "BUY" ? "▲ " : action === "SELL" ? "▼ " : "— "}
      {action}
    </span>
  );
}

// ── CONFIDENCE BAR ────────────────────────────────────────────
function ConfBar({ value, action }: { value: number; action: string }) {
  const color = action === "BUY" ? "#10b981" : action === "SELL" ? "#f43f5e" : "#f59e0b";
  const pct = Math.round(value * 100);
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-white/40 font-mono tracking-wider">CONFIDENCE</span>
        <span className="text-xs font-bold font-mono" style={{ color }}>{pct}%</span>
      </div>
      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
        />
      </div>
    </div>
  );
}

// ── GATE STATUS INDICATOR ─────────────────────────────────────
function GateStatus({ gates }: { gates: SignalData["gate_results"] }) {
  if (!gates) return null;
  const items = [
    { key: "gate1_cone", label: "Cone" },
    { key: "gate2_sentiment", label: "Sent" },
    { key: "gate3_technical", label: "Tech" },
  ] as const;
  return (
    <div className="flex gap-1.5 items-center">
      {items.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${gates[key] ? "bg-emerald-400" : "bg-rose-500"}`} />
          <span className="text-[9px] font-mono text-white/30">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── PRIMARY SIGNAL CARD ────────────────────────────────────────
function PrimeSignalCard({ signal, loading }: { signal: SignalData | null; loading: boolean }) {
  if (loading) return (
    <div className="relative rounded-2xl border border-white/5 bg-white/[0.02] p-6 overflow-hidden min-h-[200px] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-cyan-500/40 border-t-cyan-500 rounded-full animate-spin mx-auto mb-3" />
        <div className="text-[11px] font-mono text-white/30 tracking-widest">NEURAL GENESIS IN PROGRESS</div>
        <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent mx-auto mt-3 animate-pulse" />
      </div>
    </div>
  );

  if (!signal) return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 min-h-[200px] flex items-center justify-center">
      <div className="text-center text-white/30">
        <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
        <div className="text-xs font-mono">No signal data — check backend</div>
      </div>
    </div>
  );

  const isUp = signal.price_change_pct >= 0;
  const actionColor = signal.action === "BUY" ? "#10b981" : signal.action === "SELL" ? "#f43f5e" : "#f59e0b";

  return (
    <div
      className="relative rounded-2xl border overflow-hidden transition-all duration-300"
      style={{ borderColor: `${actionColor}30`, background: `linear-gradient(135deg, ${actionColor}06 0%, transparent 60%)` }}
    >
      {/* Glow top bar */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${actionColor}60, transparent)` }} />

      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[10px] font-mono text-white/30 tracking-widest mb-1">// PRIMARY INTELLIGENCE</div>
            <div className="text-4xl font-black text-white tracking-tight leading-none">
              {signal.ticker.replace(".NS", "").replace(".BO", "")}
            </div>
          </div>
          <SignalBadge action={signal.action} size="lg" />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5">
          {/* ✅ FIXED: Using current_price NOT p50 */}
          <div>
            <div className="text-[10px] font-mono text-white/30 tracking-wider mb-1">MARKET ENTRY</div>
            <div className="text-2xl font-bold text-white font-mono">
              ₹{signal.current_price?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "—"}
            </div>
            <div className={`text-xs font-mono flex items-center gap-1 mt-0.5 ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
              {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(signal.price_change_pct ?? 0).toFixed(2)}%
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-white/30 tracking-wider mb-1">CONFIDENCE INDEX</div>
            <div className="text-2xl font-bold font-mono" style={{ color: actionColor }}>
              {Math.round((signal.confidence ?? 0) * 100)}%
            </div>
            <div className="w-full h-0.5 bg-white/5 rounded mt-2 overflow-hidden">
              <div className="h-full rounded transition-all duration-700" style={{ width: `${(signal.confidence ?? 0) * 100}%`, backgroundColor: actionColor }} />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-white/30 tracking-wider mb-1">RSI</div>
            <div className={`text-2xl font-bold font-mono ${
              (signal.rsi ?? 50) > 70 ? "text-rose-400" :
              (signal.rsi ?? 50) < 30 ? "text-emerald-400" : "text-white"
            }`}>
              {(signal.rsi ?? 0).toFixed(1)}
            </div>
            <div className="text-[10px] text-white/30 font-mono mt-0.5">
              {(signal.rsi ?? 50) > 70 ? "OVERBOUGHT" : (signal.rsi ?? 50) < 30 ? "OVERSOLD" : "NEUTRAL"}
            </div>
          </div>
        </div>

        {/* P10 / P50 / P90 Cone */}
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 mb-4">
          <div className="text-[9px] font-mono text-white/25 tracking-widest mb-2">QUANTILE FORECAST CONE</div>
          <div className="flex justify-between">
            {[
              { label: "P10 BEAR", val: signal.p10, color: "#f43f5e" },
              { label: "P50 BASE", val: signal.p50, color: "#00d2ff" },
              { label: "P90 BULL", val: signal.p90, color: "#10b981" },
            ].map(({ label, val, color }) => (
              <div key={label} className="text-center">
                <div className="text-[9px] font-mono mb-1" style={{ color }}>{label}</div>
                <div className="text-sm font-bold font-mono text-white">
                  ₹{(val ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <GateStatus gates={signal.gate_results} />
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/20">
            <Cpu className="w-3 h-3" />
            COMPUTED VIA TCN V3.2
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SECONDARY SIGNAL CARD ─────────────────────────────────────
function SecondaryCard({ signal }: { signal: SignalData }) {
  const isUp = (signal.price_change_pct ?? 0) >= 0;
  const actionColor = signal.action === "BUY" ? "#10b981" : signal.action === "SELL" ? "#f43f5e" : "#f59e0b";

  return (
    <div
      className="relative rounded-xl border p-4 transition-all duration-200 hover:scale-[1.02] cursor-pointer group overflow-hidden"
      style={{ borderColor: `${actionColor}25`, background: `${actionColor}05` }}
    >
      <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
           style={{ background: `linear-gradient(90deg, transparent, ${actionColor}50, transparent)` }} />

      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-base font-black text-white tracking-tight">
            {signal.ticker.replace(".NS", "").replace(".BO", "")}
          </div>
          {/* ✅ FIXED: Using current_price, not p50 */}
          <div className="text-[11px] font-mono text-white/50 mt-0.5">
            ₹{(signal.current_price ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            <span className={`ml-1.5 ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
              {isUp ? "+" : ""}{(signal.price_change_pct ?? 0).toFixed(2)}%
            </span>
          </div>
        </div>
        <SignalBadge action={signal.action} />
      </div>

      <div className="mb-3">
        <Sparkline
          data={signal.sparkline ?? []}
          color={isUp ? "#10b981" : "#f43f5e"}
          height={32}
          width={120}
        />
      </div>

      <ConfBar value={signal.confidence ?? 0} action={signal.action} />

      {signal.gate_results && (
        <div className="mt-2 pt-2 border-t border-white/5">
          <GateStatus gates={signal.gate_results} />
        </div>
      )}
    </div>
  );
}

// ── MARKET METRIC CARD ────────────────────────────────────────
function MetricCard({ label, value, sub, color, icon: Icon, sparkline }: {
  label: string; value: string; sub?: string;
  color: string; icon?: any; sparkline?: number[];
}) {
  return (
    <div className="relative rounded-xl border border-white/5 bg-white/[0.02] p-4 overflow-hidden">
      <div className="flex items-start justify-between mb-2">
        <div className="text-[10px] font-mono text-white/30 tracking-widest flex items-center gap-1.5">
          {Icon && <Icon className="w-3 h-3" />}
          {label}
        </div>
        {sparkline && sparkline.length > 1 && (
          <Sparkline data={sparkline} color={color} height={24} width={60} />
        )}
      </div>
      <div className="text-2xl font-black font-mono" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-[11px] font-mono text-white/30 mt-1">{sub}</div>}
    </div>
  );
}

// ── HEATMAP BAR ───────────────────────────────────────────────
function HeatmapBar({ signals }: { signals: SignalData[] }) {
  if (!signals.length) return (
    <div className="flex gap-1.5">
      {Array.from({ length: 20 }).map((_, i) => (
        <Skeleton key={i} className="flex-1 h-10" />
      ))}
    </div>
  );

  return (
    <div className="flex gap-1">
      {signals.map((s) => {
        const isUp = (s.price_change_pct ?? 0) >= 0;
        const intensity = Math.min(Math.abs(s.price_change_pct ?? 0) / 3, 1);
        const color = isUp
          ? `rgba(16, 185, 129, ${0.2 + intensity * 0.6})`
          : `rgba(244, 63, 94, ${0.2 + intensity * 0.6})`;
        return (
          <div
            key={s.ticker}
            className="flex-1 rounded-sm flex flex-col items-center justify-center py-2 cursor-pointer hover:opacity-80 transition-opacity"
            style={{ backgroundColor: color, minWidth: 0 }}
            title={`${s.ticker}: ₹${s.current_price} (${s.price_change_pct?.toFixed(2)}%)`}
          >
            <span className="text-[8px] font-mono text-white/70 truncate w-full text-center px-0.5">
              {s.ticker.replace(".NS","").replace(".BO","").slice(0,3)}
            </span>
            <span className="text-[8px] font-mono text-white/50">
              {isUp ? "+" : ""}{(s.price_change_pct ?? 0).toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── TACTICAL LOG ──────────────────────────────────────────────
function TacticalLog({ logs }: { logs: LogEntry[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="font-mono text-[11px] space-y-1.5 max-h-64 overflow-y-auto scrollbar-hide">
      {logs.length === 0 ? (
        <div className="text-white/20 text-center py-4">Waiting for system events...</div>
      ) : (
        logs.map((log, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="text-white/25 shrink-0">[{log.timestamp}]</span>
            <span className={
              log.level === "SUCCESS" ? "text-emerald-400" :
              log.level === "ERROR" ? "text-rose-400" :
              log.level === "WARNING" ? "text-amber-400" :
              "text-cyan-400/80"
            }>
              {log.message}
            </span>
          </div>
        ))
      )}
      <div ref={endRef} />
    </div>
  );
}

// ── REGIME BANNER ─────────────────────────────────────────────
function RegimeBanner({ regime }: { regime: string | null }) {
  if (!regime) return null;
  const cfg: Record<string, { color: string; bg: string; desc: string }> = {
    BULLISH:   { color: "text-emerald-400", bg: "border-emerald-500/30 bg-emerald-500/5", desc: "Trend-following strategies recommended" },
    BEARISH:   { color: "text-rose-400",    bg: "border-rose-500/30 bg-rose-500/5",       desc: "Defensive positioning advised" },
    SIDEWAYS:  { color: "text-amber-400",   bg: "border-amber-500/30 bg-amber-500/5",     desc: "Scalp-only strategies. Avoid trending bets." },
    CRISIS:    { color: "text-rose-300",    bg: "border-rose-500/50 bg-rose-500/10",      desc: "Capital preservation priority. Reduce exposure." },
    UNKNOWN:   { color: "text-white/40",    bg: "border-white/5 bg-white/[0.02]",          desc: "Regime detection pending..." },
  };
  const r = cfg[regime.toUpperCase()] ?? cfg.UNKNOWN;
  return (
    <div className={`rounded-xl border p-4 ${r.bg}`}>
      <div className={`text-xs font-black font-mono tracking-widest ${r.color} mb-1`}>
        {regime.toUpperCase()} REGIME
      </div>
      <div className="text-[11px] text-white/40">{r.desc}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ══════════════════════════════════════════════════════════════
export const DashboardPage: React.FC = () => {
  // ── STATE ──────────────────────────────────────────────────
  const [pulse, setPulse]           = useState<MarketPulse | null>(null);
  const [stats, setStats]           = useState<DashboardStats | null>(null);
  const [portfolio, setPortfolio]   = useState<PortfolioStats | null>(null);
  const [signals, setSignals]       = useState<SignalData[]>([]);
  const [logs, setLogs]             = useState<LogEntry[]>([]);
  const [regime, setRegime]         = useState<string | null>(null);
  const [primaryTicker, setPrimaryTicker] = useState("RELIANCE.NS");

  const [loadingPulse,   setLoadingPulse]   = useState(true);
  const [loadingSignals, setLoadingSignals] = useState(true);
  const [loadingStats,   setLoadingStats]   = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [lastUpdated, setLastUpdated]       = useState<Date | null>(null);
  const [online, setOnline]                 = useState(true);

  // ── FETCH MARKET PULSE ─────────────────────────────────────
  const fetchPulse = useCallback(async () => {
    try {
      const data = await fetchWithTimeout(`${API_BASE}/api/market-pulse`);
      if (data.status !== "ERROR") {
        setPulse(data);
        setOnline(true);
      }
    } catch {
      setOnline(false);
    } finally {
      setLoadingPulse(false);
    }
  }, []);

  // ── FETCH STATS ────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const [statsData, portfolioData, regimeData] = await Promise.allSettled([
        fetchWithTimeout(`${API_BASE}/api/dashboard-stats`),
        fetchWithTimeout(`${API_BASE}/api/portfolio/stats`),
        fetchWithTimeout(`${API_BASE}/api/regime`),
      ]);
      if (statsData.status === "fulfilled")   setStats(statsData.value);
      if (portfolioData.status === "fulfilled") setPortfolio(portfolioData.value);
      if (regimeData.status === "fulfilled")  setRegime(regimeData.value?.regime ?? null);
    } catch {
      // Partial data OK
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // ── FETCH SIGNALS — FIXED: fetch top 6 in parallel ─────────
  const fetchSignals = useCallback(async () => {
    setLoadingSignals(true);
    setError(null);
    try {
      const top6 = NSE_TICKERS.slice(0, 6);
      const results = await Promise.allSettled(
        top6.map(t => fetchWithTimeout(`${API_BASE}/api/signal/${t}?mode=swing`, 15000))
      );

      const valid: SignalData[] = [];
      for (const r of results) {
        if (r.status === "fulfilled" && !r.value.error) {
          // ✅ CRITICAL FIX: Ensure current_price is correct
          const sig = r.value as SignalData;
          if (sig.current_price && sig.current_price > 0) {
            valid.push(sig);
          }
        }
      }

      if (valid.length > 0) {
        setSignals(valid);
        // Set first valid as primary
        const buySignals = valid.filter(s => s.action === "BUY");
        const primary = buySignals[0] ?? valid[0];
        if (primary) setPrimaryTicker(primary.ticker);
        setLastUpdated(new Date());
      } else {
        setError("Backend models loading — prices may be approximate");
      }
    } catch (e) {
      setError("Cannot connect to Apex AI backend at port 9001");
    } finally {
      setLoadingSignals(false);
    }
  }, []);

  // ── FETCH LOGS ─────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    try {
      const data = await fetchWithTimeout(`${API_BASE}/api/logs`);
      if (data?.logs) {
        const newLogs: LogEntry[] = data.logs.map((msg: string) => ({
          timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }),
          message: msg.replace(/^\[.*?\]\s*/, ""),
          level: msg.includes("BUY") || msg.includes("SUCCESS") ? "SUCCESS" :
                 msg.includes("ERROR") ? "ERROR" : "INFO"
        }));
        setLogs(prev => [...prev.slice(-20), ...newLogs].slice(-25));
      }
    } catch {}
  }, []);

  // ── FETCH DASHBOARD LOGS ───────────────────────────────────
  const fetchDashboardLogs = useCallback(async () => {
    try {
      const data = await fetchWithTimeout(`${API_BASE}/api/dashboard/logs`);
      if (Array.isArray(data)) {
        setLogs(data.slice(-20).map((l: any) => ({
          timestamp: l.timestamp ?? "",
          message: l.message ?? "",
          level: l.level ?? "INFO"
        })));
      }
    } catch {}
  }, []);

  // ── INITIAL LOAD ───────────────────────────────────────────
  useEffect(() => {
    fetchPulse();
    fetchStats();
    fetchSignals();
    fetchDashboardLogs();

    // Poll every 45s for pulse, 90s for signals
    const pulseTimer   = setInterval(fetchPulse, 45_000);
    const signalTimer  = setInterval(fetchSignals, 90_000);
    const logsTimer    = setInterval(fetchDashboardLogs, 20_000);

    return () => {
      clearInterval(pulseTimer);
      clearInterval(signalTimer);
      clearInterval(logsTimer);
    };
  }, [fetchPulse, fetchStats, fetchSignals, fetchDashboardLogs]);

  // ── DERIVED DATA ───────────────────────────────────────────
  const primarySignal = signals.find(s => s.ticker === primaryTicker) ?? signals[0] ?? null;
  const secondarySignals = signals.filter(s => s.ticker !== primaryTicker).slice(0, 3);
  const niftyUp = (pulse?.nifty.change_pct ?? 0) >= 0;
  const fiiUp = (pulse?.fii_flow?.total_flow ?? 0) >= 0;

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#020408] text-white antialiased">

      {/* ── ERROR BANNER ──────────────────────────────── */}
      {error && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-2 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span className="text-xs font-mono text-rose-400">{error}</span>
          <button onClick={fetchSignals} className="ml-auto text-[10px] text-rose-400/70 hover:text-rose-400 font-mono">
            RETRY →
          </button>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">

        {/* ── SECTION HEADER ─────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono text-white/25 tracking-[0.3em] mb-1">
              // UNIFIED NEURAL STRATEGIC COMMAND TERMINAL
            </div>
            <h1 className="text-3xl font-black tracking-tight text-cyan-400 leading-none">
              MISSION CONTROL
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <div className="text-[10px] font-mono text-white/25">
                Updated {lastUpdated.toLocaleTimeString("en-IN", { hour12: false })}
              </div>
            )}
            <button
              onClick={() => { fetchPulse(); fetchSignals(); fetchStats(); }}
              className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400/60
                         hover:text-cyan-400 border border-white/5 hover:border-cyan-500/30
                         px-3 py-1.5 rounded-lg transition-all"
            >
              <RefreshCw className="w-3 h-3" />
              REFRESH
            </button>
            <div className="flex items-center gap-1.5">
              {online
                ? <><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /><span className="text-[10px] font-mono text-emerald-400/70">NSE LIVE</span></>
                : <><WifiOff className="w-3 h-3 text-rose-400" /><span className="text-[10px] font-mono text-rose-400">OFFLINE</span></>
              }
            </div>
          </div>
        </div>

        {/* ── TOP METRICS ROW ────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* NIFTY 50 */}
          {loadingPulse ? (
            <>
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </>
          ) : (
            <>
              <MetricCard
                label="MARKET INDEX"
                value={pulse?.nifty.price
                  ? pulse.nifty.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })
                  : "—"
                }
                sub={`${niftyUp ? "▲" : "▼"} ${Math.abs(pulse?.nifty.change_pct ?? 0).toFixed(2)}%`}
                color={niftyUp ? "#10b981" : "#f43f5e"}
                icon={BarChart2}
                sparkline={pulse?.nifty.sparkline}
              />
              <MetricCard
                label="VOLATILITY (VIX)"
                value={pulse?.vix.price ? pulse.vix.price.toFixed(2) : "—"}
                sub={
                  (pulse?.vix.price ?? 0) > 20 ? "HIGH — Caution advised" :
                  (pulse?.vix.price ?? 0) > 15 ? "MODERATE" : "LOW — Calm market"
                }
                color={
                  (pulse?.vix.price ?? 0) > 20 ? "#f43f5e" :
                  (pulse?.vix.price ?? 0) > 15 ? "#f59e0b" : "#10b981"
                }
                icon={Activity}
              />
              <MetricCard
                label="INSTITUTIONAL FLOW"
                value={
                  pulse?.fii_flow
                    ? `${fiiUp ? "▲" : "▼"} ₹${Math.abs(pulse.fii_flow.total_flow).toLocaleString("en-IN")} Cr`
                    : "N/A"
                }
                sub={pulse?.fii_flow?.sentiment ?? "Data pending"}
                color={fiiUp ? "#10b981" : "#f43f5e"}
                icon={TrendingUp}
              />
              <MetricCard
                label="NEXT SESSION"
                value={pulse?.status === "LIVE" ? "LIVE NOW" : "09:15 IST"}
                sub={pulse?.status === "LIVE" ? "Market Open" : "Market Closed"}
                color={pulse?.status === "LIVE" ? "#10b981" : "#f59e0b"}
                icon={Clock}
              />
            </>
          )}
        </div>

        {/* ── BREADTH ROW ────────────────────────────── */}
        {(loadingStats || stats) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {loadingStats ? (
              <><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></>
            ) : (
              <>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
                  <div className="text-[9px] font-mono text-white/25 tracking-widest mb-1">BUY BREADTH</div>
                  <div className="text-2xl font-black text-emerald-400">{stats?.today_buys ?? 0}</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
                  <div className="text-[9px] font-mono text-white/25 tracking-widest mb-1">SELL BREADTH</div>
                  <div className="text-2xl font-black text-rose-400">{stats?.today_sells ?? 0}</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
                  <div className="text-[9px] font-mono text-white/25 tracking-widest mb-1">AVG CONFIDENCE</div>
                  <div className="text-2xl font-black text-cyan-400">{stats?.avg_confidence ?? 0}%</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
                  <div className="text-[9px] font-mono text-white/25 tracking-widest mb-1">TICKERS SCANNED</div>
                  <div className="text-2xl font-black text-white">{stats?.market_breadth?.total ?? 0}</div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── MAIN CONTENT: SIGNALS + SIDEBAR ───────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

          {/* LEFT — Signals */}
          <div className="space-y-5">

            {/* Apex Prime Signal */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] font-mono text-white/40 tracking-widest">APEX PRIME SIGNAL</span>
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[9px] font-mono text-white/20">COMPUTED VIA TCN V3.2</span>
              </div>

              <PrimeSignalCard signal={primarySignal} loading={loadingSignals && signals.length === 0} />

              {/* Ticker selector pills */}
              {signals.length > 1 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {signals.map(s => (
                    <button
                      key={s.ticker}
                      onClick={() => setPrimaryTicker(s.ticker)}
                      className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-all ${
                        s.ticker === primaryTicker
                          ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
                          : "border-white/5 text-white/30 hover:text-white/60 hover:border-white/10"
                      }`}
                    >
                      {s.ticker.replace(".NS","").replace(".BO","")}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sector Liquidity Heatmap */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-white/40 tracking-widest">// SECTOR LIQUIDITY HEATMAP</span>
                <span className="text-[9px] font-mono text-white/20">{signals.length} TICKERS ACTIVE</span>
              </div>
              <HeatmapBar signals={signals} />
            </div>

            {/* Secondary Directives */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-white/40 tracking-widest">SECONDARY DIRECTIVES</span>
                <button className="text-[10px] font-mono text-cyan-400/60 hover:text-cyan-400 flex items-center gap-1 transition-colors">
                  FULL STRATEGIC SCREENER <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {loadingSignals && secondarySignals.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[0,1,2].map(i => <Skeleton key={i} className="h-48" />)}
                </div>
              ) : secondarySignals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {secondarySignals.map(sig => (
                    <SecondaryCard key={sig.ticker} signal={sig} />
                  ))}
                </div>
              ) : !loadingSignals ? (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center">
                  <div className="text-white/20 text-xs font-mono">No secondary signals — screener running</div>
                </div>
              ) : null}
            </div>
          </div>

          {/* RIGHT — Portfolio + Regime + Logs */}
          <div className="space-y-4">

            {/* Portfolio Snapshot */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[9px] font-mono text-white/25 tracking-widest">PORTFOLIO SNAPSHOT</div>
                  <div className="text-xs font-bold text-white mt-0.5">LIVE COMMAND P&L</div>
                </div>
                <Activity className="w-4 h-4 text-emerald-400/50" />
              </div>

              <div className="text-3xl font-black text-emerald-400 mb-1">
                {portfolio
                  ? `${(portfolio.pnl ?? 0) >= 0 ? "+" : ""}₹${Math.abs(portfolio.pnl ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                  : "+₹0"
                }
              </div>
              <div className="text-[10px] font-mono text-white/25 mb-4">UNREALIZED / REALIZED DELTA</div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.03] rounded-lg p-2.5">
                  <div className="text-[9px] font-mono text-white/25 mb-1">ROE INDEX</div>
                  <div className={`text-sm font-bold font-mono ${(portfolio?.return_pct ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {(portfolio?.return_pct ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(portfolio?.return_pct ?? 0).toFixed(2)}%
                  </div>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-2.5">
                  <div className="text-[9px] font-mono text-white/25 mb-1">OPEN TACTICS</div>
                  <div className="text-sm font-bold font-mono text-white">
                    {portfolio?.active_positions ?? 0} Active
                  </div>
                </div>
              </div>
            </div>

            {/* Market Regime */}
            <RegimeBanner regime={regime} />

            {/* Tactical Activity Log */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                <span className="text-[10px] font-mono text-white/40 tracking-widest">TACTICAL ACTIVITY</span>
              </div>
              <TacticalLog logs={logs} />
            </div>

            {/* Health Check */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-[9px] font-mono text-white/25 tracking-widest mb-3">SYSTEM STATUS</div>
              <div className="space-y-2">
                {[
                  { label: "Neural Engine", ok: online },
                  { label: "Price Feed", ok: signals.some(s => s.current_price > 0) },
                  { label: "Market Pulse", ok: !!pulse },
                  { label: "Portfolio Engine", ok: !!portfolio },
                ].map(({ label, ok }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-white/40">{label}</span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-500"}`} />
                      <span className={`text-[10px] font-mono ${ok ? "text-emerald-400/70" : "text-rose-400/70"}`}>
                        {ok ? "ONLINE" : "OFFLINE"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
