/**
 * SettingsPage.tsx — APEX AI Settings
 *
 * Combines:
 *  1. Hyper Tuner (moved from its own page)
 *  2. About / System Info
 *  3. Links to Stock News
 *  4. User preferences
 *
 * The HyperTuner logic is embedded directly here and calls /api/tuner endpoints.
 */

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
  color?: string;
}> = ({ label, description, value, min, max, step, onChange, formatValue, color = "#63b3ed" }) => {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#c8d8f0", fontFamily: "monospace" }}>{label}</div>
          <div style={{ fontSize: 10, color: "#3a5a7a", marginTop: 2 }}>{description}</div>
        </div>
        <span style={{
          fontSize: 15, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
          color,
          background: `${color}18`,
          border: `1px solid ${color}30`,
          padding: "2px 10px", borderRadius: 6,
          minWidth: 64, textAlign: "center",
        }}>
          {formatValue ? formatValue(value) : fmt(value)}
        </span>
      </div>

      <div style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 99 }}>
        <div style={{
          position: "absolute", left: 0, top: 0, height: "100%",
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          borderRadius: 99,
          transition: "width 0.1s",
        }} />
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            opacity: 0, cursor: "pointer", margin: 0,
          }}
        />
        <div style={{
          position: "absolute",
          left: `${pct}%`,
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 14, height: 14,
          background: color,
          borderRadius: "50%",
          border: "2px solid #060b14",
          pointerEvents: "none",
          boxShadow: `0 0 8px ${color}60`,
        }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
        <span style={{ fontSize: 9, color: "#2a4a6a", fontFamily: "monospace" }}>{min}</span>
        <span style={{ fontSize: 9, color: "#2a4a6a", fontFamily: "monospace" }}>{max}</span>
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
      const res = await fetch(`/api/tuner/backtest?ticker=${backtestTicker}.NS`);
      if (res.ok) setBacktestResult(await res.json());
    } catch {}
    setLoading(false);
  };

  const handleOptimize = async () => {
    setLoading(true);
    setOptimizeResult(null);
    try {
      const res = await fetch(`/api/tuner/optimize?ticker=${backtestTicker}.NS`);
      if (res.ok) {
        const d: OptimizeResult = await res.json();
        setOptimizeResult(d);
        // Apply optimized config
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

  const gateColor = (key: string) => {
    if (key.includes("cone")) return "#a78bfa";
    if (key.includes("sent")) return "#fbbf24";
    if (key.includes("rsi")) return "#00e676";
    return "#63b3ed";
  };

  const subTabs: { id: "thresholds" | "backtest" | "optimize"; label: string; icon: React.ReactNode }[] = [
    { id: "thresholds", label: "Gate Thresholds", icon: <Sliders size={13} /> },
    { id: "backtest", label: "Backtest", icon: <BarChart2 size={13} /> },
    { id: "optimize", label: "Neural Optimize", icon: <Zap size={13} /> },
  ];

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 16 }}>
        {subTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveSubTab(t.id)}
            style={{
              background: activeSubTab === t.id ? "rgba(99,179,237,0.1)" : "transparent",
              border: `1px solid ${activeSubTab === t.id ? "rgba(99,179,237,0.3)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: 8,
              padding: "7px 14px",
              cursor: "pointer",
              color: activeSubTab === t.id ? "#63b3ed" : "#5a7a9a",
              fontSize: 12,
              fontFamily: "monospace",
              display: "flex", alignItems: "center", gap: 6,
              transition: "all 0.15s",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Thresholds Tab ─────────────────────────────────────────────────── */}
      {activeSubTab === "thresholds" && localConfig && (
        <div>
          <div style={{
            background: "rgba(99,179,237,0.04)",
            border: "1px solid rgba(99,179,237,0.12)",
            borderRadius: 10, padding: "12px 16px", marginBottom: 24,
            fontSize: 12, color: "#4a7a9a", lineHeight: 1.6,
          }}>
            <strong style={{ color: "#63b3ed" }}>Gate System:</strong> The 3-Gate engine vetoes any signal that doesn't pass all three checks — Cone Width (model certainty), Sentiment (news alignment), and RSI (technical momentum). Adjust these thresholds to be more strict or permissive.
          </div>

          {/* Gate 1 */}
          <div style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.1)", borderRadius: 10, padding: "16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#6a5a8a", fontFamily: "monospace", letterSpacing: 1, marginBottom: 12 }}>
              GATE 1 — PREDICTION CONE WIDTH
            </div>
            <GateSlider
              label="Max Cone Width"
              description="Max (P90-P10)/P50 ratio. Tighter = more selective signals."
              value={localConfig.cone_max}
              min={0.05}
              max={0.30}
              step={0.01}
              onChange={v => updateGate("cone_max", v)}
              color="#a78bfa"
            />
          </div>

          {/* Gate 2 */}
          <div style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.1)", borderRadius: 10, padding: "16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "#8a7a3a", fontFamily: "monospace", letterSpacing: 1, marginBottom: 12 }}>
              GATE 2 — FINBERT SENTIMENT ALIGNMENT
            </div>
            <GateSlider
              label="Min Sentiment (BUY)"
              description="FinBERT score must be ≥ this for a BUY signal to pass."
              value={localConfig.sent_buy_min}
              min={-0.30}
              max={0.30}
              step={0.01}
              onChange={v => updateGate("sent_buy_min", v)}
              formatValue={v => v >= 0 ? `+${fmt(v)}` : fmt(v)}
              color="#fbbf24"
            />
            <GateSlider
              label="Max Sentiment (SELL)"
              description="FinBERT score must be ≤ this for a SELL signal to pass."
              value={localConfig.sent_sell_max}
              min={0}
              max={0.20}
              step={0.01}
              onChange={v => updateGate("sent_sell_max", v)}
              color="#fbbf24"
            />
          </div>

          {/* Gate 3 */}
          <div style={{ background: "rgba(0,230,118,0.04)", border: "1px solid rgba(0,230,118,0.1)", borderRadius: 10, padding: "16px", marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#2a7a4a", fontFamily: "monospace", letterSpacing: 1, marginBottom: 12 }}>
              GATE 3 — RSI TECHNICAL CONFLUENCE
            </div>
            <GateSlider
              label="RSI Lower Bound (BUY)"
              description="RSI must be ≥ this for a BUY. Lower catches deeper dips."
              value={localConfig.rsi_buy_lo}
              min={20}
              max={55}
              step={1}
              onChange={v => updateGate("rsi_buy_lo", v)}
              formatValue={v => `${v}`}
              color="#00e676"
            />
            <GateSlider
              label="RSI Upper Bound (BUY)"
              description="RSI must be ≤ this for a BUY. Higher allows breakout momentum."
              value={localConfig.rsi_buy_hi}
              min={60}
              max={90}
              step={1}
              onChange={v => updateGate("rsi_buy_hi", v)}
              formatValue={v => `${v}`}
              color="#00e676"
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            style={{
              width: "100%",
              background: saveStatus === "saved"
                ? "rgba(0,230,118,0.12)"
                : saveStatus === "error"
                  ? "rgba(255,75,75,0.12)"
                  : "linear-gradient(135deg, #1a4a8a, #0e2a5a)",
              border: `1px solid ${saveStatus === "saved" ? "rgba(0,230,118,0.3)" : saveStatus === "error" ? "rgba(255,75,75,0.3)" : "rgba(99,179,237,0.3)"}`,
              borderRadius: 10,
              padding: "12px",
              cursor: "pointer",
              color: saveStatus === "saved" ? "#00e676" : saveStatus === "error" ? "#ff4b4b" : "#63b3ed",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "monospace",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s",
            }}
          >
            {saveStatus === "saving" ? <><RefreshCw size={14} /> Saving...</>
              : saveStatus === "saved" ? <><CheckCircle2 size={14} /> Saved Successfully</>
                : saveStatus === "error" ? <><AlertTriangle size={14} /> Save Failed</>
                  : <><Save size={14} /> Save Threshold Configuration</>}
          </button>
        </div>
      )}

      {/* ── Backtest Tab ──────────────────────────────────────────────────── */}
      {activeSubTab === "backtest" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <div style={{
              flex: 1,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8, padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <Activity size={13} color="#4a7a9a" />
              <input
                value={backtestTicker}
                onChange={e => setBacktestTicker(e.target.value.toUpperCase())}
                placeholder="Ticker (e.g. RELIANCE)"
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  color: "#c8d8f0", fontSize: 13, fontFamily: "monospace",
                }}
              />
            </div>
            <button
              onClick={handleBacktest}
              disabled={loading}
              style={{
                background: "rgba(99,179,237,0.1)",
                border: "1px solid rgba(99,179,237,0.25)",
                borderRadius: 8, padding: "10px 18px",
                cursor: "pointer", color: "#63b3ed",
                fontSize: 12, fontFamily: "monospace",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {loading ? <><RefreshCw size={13} /> Running...</> : <><BarChart2 size={13} /> Run Backtest</>}
            </button>
          </div>

          {backtestResult && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {[
                { label: "Win Rate", value: `${fmt(backtestResult.win_rate)}%`, good: backtestResult.win_rate >= 50 },
                { label: "Total Return", value: `${backtestResult.total_return_pct >= 0 ? "+" : ""}${fmt(backtestResult.total_return_pct)}%`, good: backtestResult.total_return_pct >= 0 },
                { label: "Total Trades", value: backtestResult.total_trades, good: null },
                { label: "Avg Trade", value: `${fmt(backtestResult.avg_trade_pct)}%`, good: backtestResult.avg_trade_pct >= 0 },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10, padding: "16px",
                }}>
                  <div style={{ fontSize: 10, color: "#3a5a7a", fontFamily: "monospace", marginBottom: 6 }}>{stat.label}</div>
                  <div style={{
                    fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                    color: stat.good === null ? "#c8d8f0" : stat.good ? "#00e676" : "#ff4b4b",
                  }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!backtestResult && !loading && (
            <div style={{ textAlign: "center", padding: "50px 0", color: "#3a5a7a" }}>
              <BarChart2 size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontFamily: "monospace", fontSize: 13 }}>
                Enter a ticker and run backtest to evaluate current gate thresholds.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Optimize Tab ──────────────────────────────────────────────────── */}
      {activeSubTab === "optimize" && (
        <div>
          <div style={{
            background: "rgba(167,139,250,0.04)",
            border: "1px solid rgba(167,139,250,0.12)",
            borderRadius: 10, padding: "12px 16px", marginBottom: 20,
            fontSize: 12, color: "#6a5a8a", lineHeight: 1.6,
          }}>
            <strong style={{ color: "#a78bfa" }}>Neural Optimization:</strong> The AI will grid-search over threshold combinations and find the best parameters for the selected ticker. This may take 20-30 seconds.
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            <div style={{
              flex: 1,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8, padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <Activity size={13} color="#4a7a9a" />
              <input
                value={backtestTicker}
                onChange={e => setBacktestTicker(e.target.value.toUpperCase())}
                placeholder="Ticker (e.g. RELIANCE)"
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  color: "#c8d8f0", fontSize: 13, fontFamily: "monospace",
                }}
              />
            </div>
            <button
              onClick={handleOptimize}
              disabled={loading}
              style={{
                background: "rgba(167,139,250,0.1)",
                border: "1px solid rgba(167,139,250,0.25)",
                borderRadius: 8, padding: "10px 18px",
                cursor: "pointer", color: "#a78bfa",
                fontSize: 12, fontFamily: "monospace",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {loading ? <><RefreshCw size={13} /> Optimizing...</> : <><Zap size={13} /> Start Neural Search</>}
            </button>
          </div>

          {optimizeResult && (
            <div>
              <div style={{
                background: "rgba(0,230,118,0.06)",
                border: "1px solid rgba(0,230,118,0.15)",
                borderRadius: 10, padding: "16px", marginBottom: 16,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 10, color: "#2a7a4a", fontFamily: "monospace" }}>OPTIMIZATION SCORE</div>
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: "#00e676" }}>
                    {fmt(optimizeResult.optimized_score)}
                  </div>
                </div>
                <CheckCircle2 size={32} color="#00e676" />
              </div>

              <div style={{ fontSize: 12, color: "#4a6a8a", fontFamily: "monospace", marginBottom: 10 }}>
                Optimal thresholds (auto-applied above):
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(optimizeResult.best_config).map(([key, val]) => (
                  <div key={key} style={{
                    display: "flex", justifyContent: "space-between",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 8, padding: "8px 12px",
                  }}>
                    <span style={{ fontSize: 12, fontFamily: "monospace", color: "#7a9ab0" }}>{key}</span>
                    <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "#a78bfa" }}>{fmt(val as number)}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSave}
                style={{
                  width: "100%", marginTop: 16,
                  background: "linear-gradient(135deg, rgba(167,139,250,0.15), rgba(99,179,237,0.1))",
                  border: "1px solid rgba(167,139,250,0.3)",
                  borderRadius: 10, padding: "12px",
                  cursor: "pointer", color: "#a78bfa",
                  fontSize: 13, fontWeight: 600, fontFamily: "monospace",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
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
    <div>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, rgba(10,25,50,0.8), rgba(6,15,30,0.9))",
        border: "1px solid rgba(99,179,237,0.15)",
        borderRadius: 14,
        padding: "24px",
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        gap: 20,
      }}>
        <div style={{
          width: 56, height: 56,
          background: "linear-gradient(135deg, #1a4a8a, #0e2a5a)",
          borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid rgba(99,179,237,0.3)",
          fontSize: 24,
        }}>
          ⚡
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Orbitron', monospace", color: "#e2e8f0" }}>
            APEX AI
          </div>
          <div style={{ fontSize: 12, color: "#63b3ed", fontFamily: "monospace" }}>
            v{health?.version ?? "3.0.2"} — Advanced Stock Market Intelligence
          </div>
          <div style={{ fontSize: 11, color: "#4a6a8a", marginTop: 4 }}>
            AI-powered trading signals for the NSE Indian market
          </div>
        </div>
      </div>

      {/* System Status */}
      {health && (
        <div style={{
          background: "rgba(8,16,32,0.6)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          padding: "18px",
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#4a6a8a", fontFamily: "monospace", marginBottom: 14, textTransform: "uppercase" }}>
            System Status
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "API Status", value: health.status === "ok" ? "ONLINE" : "DEGRADED", good: health.status === "ok" },
              { label: "Scaler Loaded", value: health.scaler_loaded ? "YES" : "NO", good: health.scaler_loaded },
              { label: "TFLite Models", value: health.tflite_models?.length ?? 0, good: null },
              { label: "Companies DB", value: health.geo_count ?? 0, good: null },
            ].map(s => (
              <div key={s.label} style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 8, padding: "10px 12px",
              }}>
                <div style={{ fontSize: 9, color: "#3a5a7a", fontFamily: "monospace" }}>{s.label}</div>
                <div style={{
                  fontSize: 14, fontWeight: 700, fontFamily: "monospace", marginTop: 3,
                  color: s.good === null ? "#7a9ab0" : s.good ? "#00e676" : "#ff4b4b",
                }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team */}
      <div style={{
        background: "rgba(8,16,32,0.6)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14,
        padding: "18px",
      }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "#4a6a8a", fontFamily: "monospace", marginBottom: 14, textTransform: "uppercase" }}>
          Built By
        </div>
        {[
          { name: "Sai Narendra Ghodke", role: "Lead AI Architect" },
          { name: "Sunraj Shetty", role: "Quantitative Analyst" },
          { name: "Siddhartha Vijay Bhosale", role: "Full-Stack Engineer" },
        ].map(m => (
          <div key={m.name} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 0",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #1a4a8a, #2a6a5a)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "#e2e8f0",
            }}>
              {m.name[0]}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#c8d8f0" }}>{m.name}</div>
              <div style={{ fontSize: 10, color: "#3a6a8a", fontFamily: "monospace" }}>{m.role}</div>
            </div>
          </div>
        ))}
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
    <div style={{
      minHeight: "100vh",
      background: "#060b14",
      color: "#c8d8f0",
      fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        input[type=range]::-webkit-slider-thumb { display: none; }
        input[type=range] { -webkit-appearance: none; }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh" }}>

        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <div style={{
          borderRight: "1px solid rgba(255,255,255,0.05)",
          padding: "32px 0",
          background: "rgba(4,10,22,0.6)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "0 24px", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Settings size={16} color="#63b3ed" />
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Orbitron', monospace", color: "#e2e8f0", letterSpacing: 1 }}>
                SETTINGS
              </span>
            </div>
            <div style={{ fontSize: 10, color: "#3a5a7a", fontFamily: "monospace" }}>
              APEX AI Configuration Hub
            </div>
          </div>

          <nav style={{ flex: 1 }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  width: "100%",
                  background: activeTab === t.id
                    ? "linear-gradient(90deg, rgba(99,179,237,0.1), transparent)"
                    : "transparent",
                  border: "none",
                  borderLeft: `2px solid ${activeTab === t.id ? "#63b3ed" : "transparent"}`,
                  padding: "12px 24px",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 10,
                  color: activeTab === t.id ? "#63b3ed" : "#5a7a9a",
                  fontSize: 13, fontFamily: "monospace",
                  transition: "all 0.15s",
                  textAlign: "left",
                }}
              >
                {t.icon} {t.label}
                {activeTab === t.id && <ChevronRight size={12} style={{ marginLeft: "auto" }} />}
              </button>
            ))}

            {/* Quick links */}
            <div style={{ padding: "20px 24px 0", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 20 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#2a4a6a", fontFamily: "monospace", marginBottom: 10 }}>
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
                  style={{
                    width: "100%", background: "transparent", border: "none",
                    padding: "8px 0", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                    color: "#4a6a8a", fontSize: 12, fontFamily: "monospace",
                    transition: "color 0.15s",
                  }}
                >
                  {l.icon} {l.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Logout */}
          {user && (
            <div style={{ padding: "0 24px" }}>
              <button
                onClick={() => { logout(); navigate("/login"); }}
                style={{
                  width: "100%", background: "rgba(255,75,75,0.06)",
                  border: "1px solid rgba(255,75,75,0.15)",
                  borderRadius: 8, padding: "10px",
                  cursor: "pointer", color: "#ff4b4b",
                  fontSize: 12, fontFamily: "monospace",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <LogOut size={13} /> Sign Out
              </button>
            </div>
          )}
        </div>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        <div style={{ padding: "32px 40px", overflowY: "auto", maxHeight: "100vh" }}>
          {/* Section header */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{
              margin: 0, fontSize: 20,
              fontFamily: "'Orbitron', monospace",
              color: "#e2e8f0", fontWeight: 700, letterSpacing: 0.5,
            }}>
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginTop: 16 }} />
          </div>

          {/* Tab Content */}
          <div style={{ animation: "fadeIn 0.25s ease" }}>
            {activeTab === "tuner" && <HyperTunerSection />}
            {activeTab === "about" && <AboutSection />}
            {activeTab === "account" && (
              <div>
                <div style={{
                  background: "rgba(8,16,32,0.6)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 14, padding: "24px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: "50%",
                      background: "linear-gradient(135deg, #1a4a8a, #2a6a5a)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, fontWeight: 700, color: "#e2e8f0",
                    }}>
                      {user?.username?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>{user?.username ?? "Guest"}</div>
                      <div style={{ fontSize: 12, color: "#4a7a9a", fontFamily: "monospace" }}>{user?.email ?? ""}</div>
                      <div style={{
                        display: "inline-block", marginTop: 4,
                        background: user?.role === "ADMIN" ? "rgba(251,191,36,0.12)" : "rgba(99,179,237,0.12)",
                        color: user?.role === "ADMIN" ? "#fbbf24" : "#63b3ed",
                        fontSize: 9, padding: "1px 8px", borderRadius: 4,
                        fontFamily: "monospace", letterSpacing: 1,
                      }}>
                        {user?.role ?? "USER"}
                      </div>
                    </div>
                  </div>
                  {user?.role === "ADMIN" && (
                    <button
                      onClick={() => navigate("/admin")}
                      style={{
                        width: "100%",
                        background: "rgba(251,191,36,0.06)",
                        border: "1px solid rgba(251,191,36,0.2)",
                        borderRadius: 8, padding: "10px",
                        cursor: "pointer", color: "#fbbf24",
                        fontSize: 12, fontFamily: "monospace",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}
                    >
                      <Shield size={13} /> Open Admin Dashboard
                    </button>
                  )}
                </div>
              </div>
            )}
            {activeTab === "system" && (
              <div style={{ color: "#4a6a8a", fontFamily: "monospace", fontSize: 13 }}>
                <p>System diagnostics and model info will appear here.</p>
                <p>Navigate to <strong style={{ color: "#63b3ed" }}>/api/health</strong> to see full system status.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
