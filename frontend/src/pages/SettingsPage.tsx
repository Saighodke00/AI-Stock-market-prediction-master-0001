import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import {
  Settings, Sliders, Info, User, Bell, Shield, Database,
  ChevronRight, Save, RefreshCw, Activity, TrendingUp,
  Newspaper, LogOut, Zap, CheckCircle2, AlertTriangle,
  BarChart2, Target, Clock, ExternalLink
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TunerConfig {
  gate_thresholds: {
    cone_max: number;
    sent_buy_min: number;
    sent_sell_max: number;
    rsi_buy_lo: number;
    rsi_buy_hi: number;
  };
  model_params?: {
    sequence_length: number;
    features: number;
  };
}

interface BacktestResult {
  win_rate: number;
  total_return_pct: number;
  total_trades: number;
  avg_trade_pct: number;
  status: string;
  error?: string;
}

interface OptimizeResult {
  best_config: Record<string, number>;
  optimized_score: number;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number, d = 2) => Number(n).toFixed(d);

type SettingsTab = "tuner" | "about" | "account" | "system";

// ─── Slider Component ─────────────────────────────────────────────────────────

const GateSlider: React.FC<{
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
  colorClass?: string;
  bgFillClass?: string;
}> = ({ label, description, value, min, max, step, onChange, formatValue, colorClass = "text-cyan", bgFillClass = "bg-cyan" }) => {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-1.5">
        <div>
          <div className="text-[13px] font-bold font-data text-text-primary">{label}</div>
          <div className="text-[10px] text-text-muted mt-0.5">{description}</div>
        </div>
        <span className={"text-sm font-bold font-data  bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-md min-w-[64px] text-center"}>
          {formatValue ? formatValue(value) : fmt(value)}
        </span>
      </div>

      <div className="relative h-1.5 bg-white/5 rounded-full mt-2">
        <div 
          className={"absolute left-0 top-0 h-full rounded-full transition-all `}
          style={{ width: ${pct}% }} 
        />
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer m-0"
        />
        <div 
          className={"absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-bg-base pointer-events-none `}
          style={{ left: ${pct}%, boxShadow: "0 0 8px currentColor" }}
        />
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-text-muted font-data">{min}</span>
        <span className="text-[9px] text-text-muted font-data">{max}</span>
      </div>
    </div>
  );
};

// ─── HyperTuner Section ───────────────────────────────────────────────────────

const HyperTunerSection: React.FC = () => {
  const [config, setConfig] = useState<TunerConfig | null>(null);
  const [localConfig, setLocalConfig] = useState<TunerConfig["gate_thresholds"] | null>(null);
  const [backtestTicker, setBacktestTicker] = useState("RELIANCE");
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [activeSubTab, setActiveSubTab] = useState<"thresholds" | "backtest" | "optimize">("thresholds");

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/tuner");
      if (res.ok) {
        const d: TunerConfig = await res.json();
        setConfig(d);
        setLocalConfig({ ...d.gate_thresholds });
      }
    } catch {}
  }, []);

  useEffect(() => { fetchConfig(); }, []);

  const handleSave = async () => {
    if (!localConfig) return;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/tuner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gate_thresholds: localConfig }),
      });
      setSaveStatus(res.ok ? "saved" : "error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const handleBacktest = async () => {
    setLoading(true);
    setBacktestResult(null);
    try {
      const res = await fetch(/api/tuner/backtest?ticker=.NS);
      if (res.ok) setBacktestResult(await res.json());
    } catch {}
    setLoading(false);
  };

  const handleOptimize = async () => {
    setLoading(true);
    setOptimizeResult(null);
    try {
      const res = await fetch(/api/tuner/optimize?ticker=.NS);
      if (res.ok) {
        const d: OptimizeResult = await res.json();
        setOptimizeResult(d);
        if (d.best_config && localConfig) {
          setLocalConfig({ ...localConfig, ...d.best_config });
        }
      }
    } catch {}
    setLoading(false);
  };

  const updateGate = (key: keyof TunerConfig["gate_thresholds"], val: number) => {
    setLocalConfig(prev => prev ? { ...prev, [key]: val } : prev);
  };

  const subTabs: { id: "thresholds" | "backtest" | "optimize"; label: string; icon: React.ReactNode }[] = [
    { id: "thresholds", label: "Gate Thresholds", icon: <Sliders size={13} /> },
    { id: "backtest", label: "Backtest", icon: <BarChart2 size={13} /> },
    { id: "optimize", label: "Neural Optimize", icon: <Zap size={13} /> },
  ];

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex gap-2 mb-6 border-b border-border-dim pb-4">
        {subTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveSubTab(t.id)}
            className={"flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border font-data text-xs transition-all "}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Thresholds Tab ─────────────────────────────────────────────────── */}
      {activeSubTab === "thresholds" && localConfig && (
        <div className="animate-page-in">
          <div className="bg-cyan/5 border border-cyan/10 rounded-lg p-4 mb-6 text-xs text-text-secondary leading-relaxed">
            <strong className="text-cyan">Gate System:</strong> The 3-Gate engine vetoes any signal that doesn't pass all three checks — Cone Width (model certainty), Sentiment (news alignment), and RSI (technical momentum). Adjust these thresholds to be more strict or permissive.
          </div>

          {/* Gate 1 */}
          <div className="glass-card p-5 border border-indigo-500/10 mb-4 bg-indigo-500/5">
            <div className="font-data-tiny text-indigo-400 tracking-widest mb-4 uppercase">
              GATE 1 — PREDICTION CONE WIDTH
            </div>
            <GateSlider
              label="Max Cone Width"
              description="Max (P90-P10)/P50 ratio. Tighter = more selective signals."
              value={localConfig.cone_max}
              min={0.05} max={0.30} step={0.01}
              onChange={v => updateGate("cone_max", v)}
              colorClass="text-indigo-400"
              bgFillClass="bg-indigo-500"
            />
          </div>

          {/* Gate 2 */}
          <div className="glass-card p-5 border border-amber/10 mb-4 bg-amber/5">
            <div className="font-data-tiny text-amber tracking-widest mb-4 uppercase">
              GATE 2 — FINBERT SENTIMENT ALIGNMENT
            </div>
            <GateSlider
              label="Min Sentiment (BUY)"
              description="FinBERT score must be ≥ this for a BUY signal to pass."
              value={localConfig.sent_buy_min}
              min={-0.30} max={0.30} step={0.01}
              onChange={v => updateGate("sent_buy_min", v)}
              formatValue={v => v >= 0 ? + : fmt(v)}
              colorClass="text-amber"
              bgFillClass="bg-amber"
            />
            <GateSlider
              label="Max Sentiment (SELL)"
              description="FinBERT score must be ≤ this for a SELL signal to pass."
              value={localConfig.sent_sell_max}
              min={0} max={0.20} step={0.01}
              onChange={v => updateGate("sent_sell_max", v)}
              colorClass="text-amber"
              bgFillClass="bg-amber"
            />
          </div>

          {/* Gate 3 */}
          <div className="glass-card p-5 border border-emerald/10 mb-6 bg-emerald/5">
            <div className="font-data-tiny text-emerald tracking-widest mb-4 uppercase">
              GATE 3 — RSI TECHNICAL CONFLUENCE
            </div>
            <GateSlider
              label="RSI Lower Bound (BUY)"
              description="RSI must be ≥ this for a BUY. Lower catches deeper dips."
              value={localConfig.rsi_buy_lo}
              min={20} max={55} step={1}
              onChange={v => updateGate("rsi_buy_lo", v)}
              formatValue={v => ${v}}
              colorClass="text-emerald"
              bgFillClass="bg-emerald"
            />
            <GateSlider
              label="RSI Upper Bound (BUY)"
              description="RSI must be ≤ this for a BUY. Higher allows breakout momentum."
              value={localConfig.rsi_buy_hi}
              min={60} max={90} step={1}
              onChange={v => updateGate("rsi_buy_hi", v)}
              formatValue={v => ${v}}
              colorClass="text-emerald"
              bgFillClass="bg-emerald"
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className={"w-full flex items-center justify-center gap-2 p-3 rounded-xl font-data text-sm font-bold transition-all "}
          >
            {saveStatus === "saving" ? <><RefreshCw size={14} className="animate-spin" /> Saving...</>
              : saveStatus === "saved" ? <><CheckCircle2 size={14} /> Saved Successfully</>
                : saveStatus === "error" ? <><AlertTriangle size={14} /> Save Failed</>
                  : <><Save size={14} /> Save Threshold Configuration</>}
          </button>
        </div>
      )}

      {/* ── Backtest Tab ──────────────────────────────────────────────────── */}
      {activeSubTab === "backtest" && (
        <div className="animate-page-in">
          <div className="flex flex-wrap gap-2 mb-6">
            <div className="flex-1 flex items-center gap-2 bg-white/5 border border-border-dim rounded-lg px-3 py-2 focus-within:border-border-bright">
              <Activity size={13} className="text-text-muted" />
              <input
                value={backtestTicker}
                onChange={e => setBacktestTicker(e.target.value.toUpperCase())}
                placeholder="Ticker (e.g. RELIANCE)"
                className="w-full bg-transparent border-none outline-none text-text-primary text-sm font-data"
              />
            </div>
            <button
              onClick={handleBacktest}
              disabled={loading}
              className="px-4 py-2 bg-cyan/10 border border-cyan/30 rounded-lg text-cyan font-data text-xs flex items-center gap-1.5 hover:bg-cyan/20"
            >
              {loading ? <><RefreshCw size={13} className="animate-spin" /> Running...</> : <><BarChart2 size={13} /> Run Backtest</>}
            </button>
          </div>

          {backtestResult && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Win Rate", value: ${fmt(backtestResult.win_rate)}%, good: backtestResult.win_rate >= 50 },
                { label: "Total Return", value: ${backtestResult.total_return_pct >= 0 ? "+" : ""}%, good: backtestResult.total_return_pct >= 0 },
                { label: "Total Trades", value: backtestResult.total_trades, good: null },
                { label: "Avg Trade", value: ${fmt(backtestResult.avg_trade_pct)}%, good: backtestResult.avg_trade_pct >= 0 },
              ].map(stat => (
                <div key={stat.label} className="glass-card p-4 rounded-xl">
                  <div className="text-[10px] text-text-muted font-data mb-1.5">{stat.label}</div>
                  <div className={"text-xl font-bold font-data `}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!backtestResult && !loading && (
            <div className="py-12 text-center text-text-muted">
              <BarChart2 size={36} className="mx-auto mb-3 opacity-40" />
              <p className="font-data text-sm">
                Enter a ticker and run backtest to evaluate current gate thresholds.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Optimize Tab ──────────────────────────────────────────────────── */}
      {activeSubTab === "optimize" && (
        <div className="animate-page-in">
          <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-4 mb-5 text-xs text-indigo-200/70 leading-relaxed">
            <strong className="text-indigo-400">Neural Optimization:</strong> The AI will grid-search over threshold combinations and find the best parameters for the selected ticker. This may take 20-30 seconds.
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <div className="flex-1 flex items-center gap-2 bg-white/5 border border-border-dim rounded-lg px-3 py-2 focus-within:border-border-bright">
              <Activity size={13} className="text-text-muted" />
              <input
                value={backtestTicker}
                onChange={e => setBacktestTicker(e.target.value.toUpperCase())}
                placeholder="Ticker (e.g. RELIANCE)"
                className="w-full bg-transparent border-none outline-none text-text-primary text-sm font-data"
              />
            </div>
            <button
              onClick={handleOptimize}
              disabled={loading}
              className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400 font-data text-xs flex items-center gap-1.5 hover:bg-indigo-500/20"
            >
              {loading ? <><RefreshCw size={13} className="animate-spin" /> Optimizing...</> : <><Zap size={13} /> Start Neural Search</>}
            </button>
          </div>

          {optimizeResult && (
            <div>
              <div className="flex justify-between items-center bg-emerald/5 border border-emerald/20 rounded-xl p-4 mb-4">
                <div>
                  <div className="text-[10px] text-emerald/80 font-data tracking-wider mb-0.5">OPTIMIZATION SCORE</div>
                  <div className="text-3xl font-black font-data text-emerald tracking-tight">
                    {fmt(optimizeResult.optimized_score)}
                  </div>
                </div>
                <CheckCircle2 size={32} className="text-emerald" />
              </div>

              <div className="text-xs text-text-muted font-data mb-2.5">
                Optimal thresholds (auto-applied above):
              </div>
              <div className="flex flex-col gap-1.5">
                {Object.entries(optimizeResult.best_config).map(([key, val]) => (
                  <div key={key} className="flex justify-between bg-white/5 border border-border-dim rounded-lg px-3 py-2.5">
                    <span className="text-xs font-data text-text-secondary">{key}</span>
                    <span className="text-xs font-bold font-data text-indigo-400">{fmt(val as number)}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSave}
                className="w-full mt-4 flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-indigo-500/10 to-cyan/10 border border-indigo-500/30 rounded-xl font-data text-sm font-bold text-indigo-400 hover:from-indigo-500/20 hover:to-cyan/20 transition-all"
              >
                <Save size={14} /> Apply & Save Optimized Config
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── About Section ────────────────────────────────────────────────────────────

const AboutSection: React.FC = () => {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    fetch("/api/health").then(r => r.json()).then(setHealth).catch(() => {});
  }, []);

  return (
    <div className="animate-page-in">
      {/* Hero */}
      <div className="glass-card p-6 rounded-2xl mb-5 flex items-center gap-5 backdrop-blur-md">
        <div className="w-14 h-14 bg-gradient-to-br from-indigo-900 to-cyan-900 rounded-xl flex items-center justify-center border border-cyan/30 text-2xl">
          ⚡
        </div>
        <div>
          <div className="text-xl font-black font-display text-text-primary tracking-wide">
            APEX AI
          </div>
          <div className="text-xs text-cyan font-data mt-0.5">
            v{health?.version ?? "3.0.2"} — Advanced Stock Market Intelligence
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            AI-powered trading signals for the NSE Indian market
          </div>
        </div>
      </div>

      {/* System Status */}
      {health && (
        <div className="glass border border-border-mid rounded-xl p-5 mb-5">
          <div className="text-[10px] tracking-widest text-text-muted font-data mb-3.5 uppercase">
            System Status
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "API Status", value: health.status === "ok" ? "ONLINE" : "DEGRADED", good: health.status === "ok" },
              { label: "Scaler Loaded", value: health.scaler_loaded ? "YES" : "NO", good: health.scaler_loaded },
              { label: "TFLite Models", value: health.tflite_models?.length ?? 0, good: null },
              { label: "Companies DB", value: health.geo_count ?? 0, good: null },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-border-dim rounded-lg px-3 py-2.5">
                <div className="text-[9px] text-text-muted font-data">{s.label}</div>
                <div className={"text-sm font-bold font-data mt-0.5 `}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team */}
      <div className="glass border border-border-mid rounded-xl p-5">
        <div className="text-[10px] tracking-widest text-text-muted font-data mb-3.5 uppercase">
          Built By
        </div>
        <div className="flex flex-col">
          {[
            { name: "Sai Narendra Ghodke", role: "Lead AI Architect" },
            { name: "Sunraj Shetty", role: "Quantitative Analyst" },
            { name: "Siddhartha Vijay Bhosale", role: "Full-Stack Engineer" },
          ].map(m => (
            <div key={m.name} className="flex items-center gap-3 py-2.5 border-b border-border-dim last:border-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-700 to-teal-700 flex items-center justify-center text-xs font-bold text-white shadow-md">
                {m.name[0]}
              </div>
              <div>
                <div className="text-xs font-bold text-text-primary">{m.name}</div>
                <div className="text-[10px] text-text-muted font-data mt-0.5">{m.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main Settings Page ───────────────────────────────────────────────────────

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("tuner");
  const navigate = useNavigate();
  const { user, logout } = useAuthStore() as any;

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "tuner", label: "Hyper Tuner", icon: <Sliders size={15} /> },
    { id: "about", label: "About", icon: <Info size={15} /> },
    { id: "account", label: "Account", icon: <User size={15} /> },
    { id: "system", label: "System", icon: <Database size={15} /> },
  ];

  return (
    <div className="page-container !p-0 min-h-[calc(100vh-64px)]">
      <div className="grid md:grid-cols-[240px_1fr] min-h-[calc(100vh-64px)]">
        
        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <div className="border-r border-border-dim bg-white/[0.01] py-8 flex flex-col">
          <div className="px-6 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Settings size={16} className="text-cyan" />
              <span className="text-sm font-bold font-display tracking-widest text-text-primary uppercase">
                SETTINGS
              </span>
            </div>
            <div className="text-[10px] text-text-muted font-data">
              APEX AI Configuration Hub
            </div>
          </div>

          <nav className="flex-1">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={"w-full px-6 py-3 flex items-center gap-2.5 font-data text-[13px] transition-all text-left border-l-2 "}
              >
                {t.icon} {t.label}
                {activeTab === t.id && <ChevronRight size={12} className="ml-auto opacity-50" />}
              </button>
            ))}

            {/* Quick links */}
            <div className="px-6 pt-5 mt-5 border-t border-border-dim">
              <div className="text-[9px] tracking-widest text-text-muted font-data mb-2.5 uppercase">
                QUICK LINKS
              </div>
              {[
                { label: "Stock News", icon: <Newspaper size={13} />, path: "/news" },
                { label: "Paper Trading", icon: <Target size={13} />, path: "/paper" },
                { label: "Screener", icon: <Activity size={13} />, path: "/screener" },
              ].map(l => (
                <button
                  key={l.label}
                  onClick={() => navigate(l.path)}
                  className="w-full py-2 bg-transparent border-none flex items-center gap-2 text-text-muted font-data text-xs hover:text-cyan transition-colors"
                >
                  {l.icon} {l.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Logout */}
          {user && (
            <div className="px-6 mt-8">
              <button
                onClick={() => { logout(); navigate("/login"); }}
                className="w-full flex items-center justify-center gap-1.5 p-2.5 bg-rose/5 border border-rose/10 rounded-lg text-rose font-data text-xs hover:bg-rose/10 transition-all"
              >
                <LogOut size={13} /> Sign Out
              </button>
            </div>
          )}
        </div>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        <div className="p-8 md:p-10 max-h-[100vh] overflow-y-auto custom-scrollbar">
          {/* Section header */}
          <div className="mb-7">
            <h2 className="m-0 text-xl font-display font-bold text-text-primary tracking-wide">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            <div className="h-[1px] bg-border-dim mt-4" />
          </div>

          {/* Tab Content */}
          <div className="max-w-3xl">
            {activeTab === "tuner" && <HyperTunerSection />}
            {activeTab === "about" && <AboutSection />}
            {activeTab === "account" && (
              <div className="animate-page-in">
                <div className="glass border border-border-mid rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-700 to-teal-700 flex items-center justify-center text-xl font-bold text-white shadow-md">
                      {user?.username?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <div className="text-base font-bold text-text-primary">{user?.username ?? "Guest"}</div>
                      <div className="text-xs text-text-muted font-data">{user?.email ?? ""}</div>
                      <div className={"inline-block mt-1 text-[9px] px-2 py-0.5 rounded font-data tracking-widest uppercase `}>
                        {user?.role ?? "USER"}
                      </div>
                    </div>
                  </div>
                  {user?.role === "ADMIN" && (
                    <button
                      onClick={() => navigate("/admin")}
                      className="w-full flex items-center justify-center gap-1.5 p-2.5 bg-amber/10 border border-amber/20 rounded-lg text-amber font-data text-xs font-bold hover:bg-amber/20 transition-all"
                    >
                      <Shield size={13} /> Open Admin Dashboard
                    </button>
                  )}
                </div>
              </div>
            )}
            {activeTab === "system" && (
              <div className="text-text-muted font-data text-sm animate-page-in">
                <p>System diagnostics and model info will appear here.</p>
                <p className="mt-2">Navigate to <strong className="text-cyan font-bold">/api/health</strong> to see full system status.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
