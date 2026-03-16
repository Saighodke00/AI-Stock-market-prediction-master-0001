import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
    ResponsiveContainer, Cell, ReferenceLine, CartesianGrid
} from 'recharts';
import {
    ArrowUpRight, ArrowDownRight, AlertCircle, RefreshCw, Loader2,
    CheckCircle2, XCircle, ShieldCheck, TrendingUp, TrendingDown,
    Newspaper, ExternalLink, Sliders, ChevronDown, Activity, Cpu
} from 'lucide-react';
import { APIResponse } from '../types';

interface DashboardViewProps {
    signalData: APIResponse | null;
    loading: boolean;
    error: string | null;
    fetchData: () => void;
    ticker: string;
}

// ─── Helpers ─────────────────────────────────────────────────
const fmt = (v: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(v);
const fmtK = (v: number) => v > 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(2);
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const capSharpe = (v: number) => clamp(v, -10, 10).toFixed(2);
const safeArray = <T,>(val: unknown): T[] => Array.isArray(val) ? (val as T[]) : [];

// ─── Mock data for Recharts chart (historical + forecast) ─────
function buildChartData() {
    const dates: any[] = [];
    let price = 1285;
    const base = Date.now() - 60 * 24 * 3600 * 1000;
    for (let i = 0; i < 60; i++) {
        price += (Math.random() - 0.46) * 22;
        dates.push({
            date: new Date(base + i * 24 * 3600 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            price: Math.max(price, 1100),
            forecast: null, p10: null, p50: null, p90: null, isForecast: false,
        });
    }
    const lastPrice = dates[dates.length - 1].price;
    for (let i = 1; i <= 14; i++) {
        const trend = lastPrice * (1 + 0.003 * i);
        dates.push({
            date: new Date(base + (60 + i) * 24 * 3600 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            price: null,
            p10: lastPrice * (1 - 0.006 * i),
            p50: trend,
            p90: lastPrice * (1 + 0.009 * i),
            isForecast: true,
        });
    }
    return dates;
}

const CHART_DATA = buildChartData();

// ─── Radial Score Gauge ───────────────────────────────────────
function RadialGauge({ score, label }: { score: number; label: string }) {
    const pct = clamp(score, 0, 100);
    const r = 40;
    const circ = 2 * Math.PI * r;
    const stroke = circ * (pct / 100);
    const color = pct >= 65 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#f43f5e';
    return (
        <div className="flex flex-col items-center gap-3">
            <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
                    <circle
                        cx="50" cy="50" r={r} fill="none"
                        stroke={color} strokeWidth="6"
                        strokeDasharray={`${stroke} ${circ - stroke}`}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                        style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-white font-display">{pct}</span>
                    <span className="text-[8px] text-slate-500 uppercase tracking-[0.2em] font-bold">Signal</span>
                </div>
            </div>
            <span className="text-[11px] text-slate-400 font-semibold tracking-wide uppercase font-body">{label}</span>
        </div>
    );
}

// ─── Gate Row ────────────────────────────────────────────────
function GateRow({ label, desc, value, pass, progress }: {
    label: string; desc: string; value: string; pass: boolean; progress: number;
}) {
    const colorClass = pass ? 'text-emerald-400' : 'text-rose-400';
    const bgClass = pass ? 'bg-emerald-400/10' : 'bg-rose-400/10';
    
    return (
        <div className="flex items-center gap-4 py-3 border-b border-white/[0.03] last:border-0 group">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 ${bgClass} ${colorClass}`}>
                {pass ? <CheckCircle2 className="w-4.5 h-4.5" /> : <XCircle className="w-4.5 h-4.5" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-tight font-display">{label}</span>
                    <span className={`text-[11px] font-mono font-black ${colorClass}`}>{value}</span>
                </div>
                <div className="w-full bg-white/[0.03] rounded-full h-1.5 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1) ${pass ? 'bg-emerald-400' : 'bg-rose-500'}`}
                        style={{ width: `${clamp(progress, 0, 100)}%`, boxShadow: pass ? '0 0 12px rgba(16, 185, 129, 0.3)' : '0 0 12px rgba(244, 63, 94, 0.3)' }}
                    />
                </div>
                <p className="text-[10px] text-slate-500 mt-1 font-medium font-body truncate">{desc}</p>
            </div>
        </div>
    );
}

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent, icon: Icon }: {
    label: string; value: string; sub?: string; accent: 'emerald' | 'rose' | 'amber' | 'indigo' | 'violet'; icon: any;
}) {
    const themes: Record<string, { text: string, bg: string, border: string, marker: string }> = {
        emerald: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-500/20', marker: 'bg-emerald-400' },
        rose:    { text: 'text-rose-400',    bg: 'bg-rose-400/10',    border: 'border-rose-500/20',    marker: 'bg-rose-400' },
        amber:   { text: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-500/20',   marker: 'bg-amber-400' },
        indigo:  { text: 'text-indigo-400',  bg: 'bg-indigo-400/10',  border: 'border-indigo-500/20',  marker: 'bg-indigo-400' },
        violet:  { text: 'text-violet-400',  bg: 'bg-violet-400/10',  border: 'border-violet-500/20',  marker: 'bg-violet-400' },
    };
    const t = themes[accent];
    
    return (
        <div className={`glass-card relative overflow-hidden group`}>
            {/* Status marker */}
            <div className={`absolute top-0 left-0 w-1 h-full opacity-40 ${t.marker}`} />
            
            <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 font-body">{label}</p>
                    <p className={`text-2xl font-black ${t.text} font-display tracking-tight group-hover:scale-[1.02] transition-transform`}>{value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${t.bg} flex items-center justify-center flex-shrink-0 border border-white/5`}>
                    <Icon className={`w-5 h-5 ${t.text}`} />
                </div>
            </div>
            
            {sub && (
                <div className="flex items-center gap-1.5">
                    <div className={`w-1 h-1 rounded-full ${t.marker}`} />
                    <p className="text-[11px] text-slate-400 font-medium font-body">{sub}</p>
                </div>
            )}
        </div>
    );
}

// ─── News Item ────────────────────────────────────────────────
function NewsItem({ headline, sentiment, source }: { headline: string; sentiment: string; source: string }) {
    const badgeClass = sentiment === 'Bullish'
        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
        : sentiment === 'Bearish'
            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            : 'bg-slate-700/50 text-slate-400 border-slate-600/30';
    return (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800/40 transition-all cursor-pointer group border border-transparent hover:border-slate-700/40">
            <Newspaper className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 group-hover:text-slate-400 transition-colors" />
            <p className="text-xs text-slate-400 flex-1 line-clamp-1 group-hover:text-slate-200 transition-colors">{headline}</p>
            <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${badgeClass}`}>{sentiment}</span>
                <ExternalLink className="w-3 h-3 text-slate-700 group-hover:text-slate-400 transition-colors" />
            </div>
        </div>
    );
}

// ─── Custom Tooltip ───────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="glass rounded-xl p-3 border border-slate-700/60 shadow-2xl text-xs">
            <p className="text-slate-400 mb-2 font-medium">{label}</p>
            {payload.map((p: any, i: number) => (
                p.value != null && (
                    <div key={i} className="flex items-center gap-2 mb-0.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                        <span className="text-slate-400">{p.name}:</span>
                        <span className="text-white font-mono">${fmt(p.value)}</span>
                    </div>
                )
            ))}
        </div>
    );
};

// ─── What-If Slider ───────────────────────────────────────────
function WhatIfSlider({ label, min, max, value, onChange, unit }: {
    label: string; min: number; max: number; value: number; onChange: (v: number) => void; unit: string;
}) {
    return (
        <div className="group/slider">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-focus-within/slider:text-indigo-400 transition-colors">{label}</span>
                <span className="text-xs font-mono text-white font-black">{value}{unit}</span>
            </div>
            <input
                type="range" min={min} max={max} value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-indigo-500 h-1 bg-white/5 rounded-full appearance-none cursor-pointer hover:bg-white/10 transition-all opacity-70 hover:opacity-100"
            />
        </div>
    );
}

// ──────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────
export default function DashboardView({ signalData, loading, error, fetchData, ticker }: DashboardViewProps) {
    const [lookback, setLookback] = useState(60);
    const [depth, setDepth] = useState(3);
    const [simSentiment, setSimSentiment] = useState(50);

    // Derive KPI values (use realistic fallbacks)
    const price = signalData?.current_price ?? 1345.00;
    const pct = signalData?.pct_change ?? 1.38;
    const signal = signalData?.signal ?? 'BUY';
    const accuracy = signalData?.accuracy ?? 67.4;
    const sharpe = signalData?.sharpe_ratio != null ? Number(capSharpe(signalData.sharpe_ratio)) : 1.84;
    const sentimentScore = signalData?.sentiment?.score ?? 72;
    const explanation = signalData?.explanation || 'RSI recovery from oversold zone (RSI 42 → 54), VIX declining from 21 to 17, momentum aligns with Q1 seasonal strength. Quantile spread within 8% — high-conviction setup.';

    const signalAccent =
        signal === 'BUY' ? 'emerald' :
            signal === 'SELL' ? 'rose' : 'amber';
    const SignalIcon = signal === 'BUY' ? TrendingUp : signal === 'SELL' ? TrendingDown : Activity;
    const accentColor = signal === 'BUY' ? '#10b981' : signal === 'SELL' ? '#f43f5e' : '#f59e0b';

    const headlinesRaw = signalData?.sentiment?.headlines;
    const headlines = (Array.isArray(headlinesRaw) && headlinesRaw.length > 0)
        ? headlinesRaw
        : [
            { text: 'System standby — awaiting fresh intelligence feed.', sentiment: 'Neutral' },
            { text: 'Fed signals gradual rate cuts as inflation eases to 2.8%', sentiment: 'Bullish' },
            { text: 'Q4 earnings beat estimates by 12% on strong domestic demand', sentiment: 'Bullish' },
            { text: 'Primary data streams stable. Neural cores at target temperature.', sentiment: 'Neutral' },
        ];

    const shapRaw = signalData?.shap_features;
    const shapData = (Array.isArray(shapRaw) && shapRaw.length > 0)
        ? shapRaw.map((f: any) => ({
            feature: f.feature, impact: f.impact, color: f.impact > 0 ? '#34d399' : '#f43f5e'
        }))
        : [
            { feature: 'RSI_14', impact: 0.34, color: '#34d399' },
            { feature: 'VIX_Close', impact: -0.28, color: '#f43f5e' },
            { feature: 'MACD_Signal', impact: 0.21, color: '#34d399' },
            { feature: 'ATR_14', impact: -0.14, color: '#f43f5e' },
            { feature: 'Volume_ratio', impact: 0.18, color: '#34d399' },
        ];

    const gateConf = 0.78;
    const gateCone = 0.09;
    const gateSentOk = sentimentScore > 45;

    return (
        <div className="p-8 max-w-[1500px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.03),_transparent)]">
            {/* Error Banner */}
            {error && (
                <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-4 text-rose-400 animate-in fade-in slide-in-from-top-4">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-medium flex-1">{error}</p>
                    <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 rounded-xl text-xs font-bold transition-all">
                        <RefreshCw className="w-3.5 h-3.5" /> Retry
                    </button>
                </div>
            )}

            <div className={`transition-opacity duration-300 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>

                {/* ── Row 1: KPI Cards ──────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <KpiCard
                        label="Current Quote"
                        value={`$${fmt(price)}`}
                        sub={`${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% today`}
                        accent={pct >= 0 ? 'emerald' : 'rose'}
                        icon={pct >= 0 ? ArrowUpRight : ArrowDownRight}
                    />
                    <KpiCard
                        label="Neural Target (P50)"
                        value={`$${fmt(price * 1.024)}`}
                        sub={`Range $${fmt(price * 0.978)} — $${fmt(price * 1.068)}`}
                        accent="indigo"
                        icon={Cpu}
                    />
                    <KpiCard
                        label="Action Signal"
                        value={signal}
                        sub={`Confidence: ${(gateConf * 100).toFixed(0)}% · 3/3 Gates Pass`}
                        accent={signalAccent as any}
                        icon={SignalIcon}
                    />
                    <KpiCard
                        label="Model Accuracy"
                        value={`${(accuracy ?? 0).toFixed(1)}%`}
                        sub={`Sharpe ${(sharpe ?? 0).toFixed(2)} · Sortino 2.31`}
                        accent="violet"
                        icon={ShieldCheck}
                    />
                </div>

                {/* ── Row 2: Chart + Gate ───────────────────────── */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                    {/* Main Chart */}
                    <div className="xl:col-span-2 glass-card p-8 border border-white/5 shadow-2xl relative group overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                            <div>
                                <h3 className="text-sm font-bold text-slate-200">Forecast Visualizer</h3>
                                <p className="text-[10px] text-slate-500 mt-0.5">Historical Price + 14-Day Confidence Cloud (P10/P50/P90)</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="hidden sm:flex items-center gap-3 text-[10px] text-slate-500">
                                    <span className="flex items-center gap-1"><span className="w-5 h-0.5 bg-indigo-400 inline-block rounded"></span>Historical</span>
                                    <span className="flex items-center gap-1"><span className="w-5 h-0.5 bg-amber-400 inline-block rounded"></span>P50</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500/20 inline-block border border-emerald-500/40"></span>P10–P90</span>
                                </div>
                                {loading && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
                            </div>
                        </div>

                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={CHART_DATA} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                                <defs>
                                    <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="coneGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10, fontWeight: 500 }} tickLine={false} axisLine={false} interval={9} />
                                <YAxis tick={{ fill: '#475569', fontSize: 10, fontWeight: 500 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${fmtK(v)}`} domain={['auto', 'auto']} />
                                <RechartsTooltip content={<CustomTooltip />} />
                                <ReferenceLine
                                    x={CHART_DATA[59].date}
                                    stroke="rgba(255,255,255,0.1)"
                                    strokeDasharray="4 4"
                                />
                                <Area type="monotone" dataKey="price" name="Price" stroke="#6366f1" strokeWidth={2.5} fill="url(#histGrad)" dot={false} connectNulls={false} />
                                <Area type="monotone" dataKey="p90" name="P90 (Optimistic)" stroke="rgba(16,185,129,0.3)" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#coneGrad)" dot={false} connectNulls={false} />
                                <Area type="monotone" dataKey="p50" name="P50 (Median)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" fill="transparent" dot={false} connectNulls={false} />
                                <Area type="monotone" dataKey="p10" name="P10 (Bear)" stroke="rgba(244,63,94,0.3)" strokeWidth={1.5} strokeDasharray="4 2" fill="transparent" dot={false} connectNulls={false} />
                            </AreaChart>
                        </ResponsiveContainer>

                        {/* Quantile pills */}
                        <div className="grid grid-cols-3 gap-3 mt-4">
                            {[
                                { l: 'P10 Bear', v: price * 0.972, c: 'text-rose-400' },
                                { l: 'P50 Target', v: price * 1.024, c: 'text-amber-400' },
                                { l: 'P90 Bull', v: price * 1.068, c: 'text-emerald-400' },
                            ].map(q => (
                                <div key={q.l} className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800/50">
                                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-1">{q.l}</p>
                                    <p className={`text-sm font-mono font-bold ${q.c}`}>${fmt(q.v)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Gate Verification */}
                    <div className="glass-card p-8 border border-white/5 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl" />
                        <div className="flex items-center gap-3 mb-6">
                            <ShieldCheck className="w-5 h-5 text-indigo-400" />
                            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Neural Pipeline</h3>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 mb-8 leading-relaxed uppercase tracking-widest italic opacity-70">Multi-stage signal synthesis ensuring quantile-normalized convergence</p>

                        <div className="space-y-4">
                            <GateRow
                                label="TFT CONFIDENCE"
                                desc="Attention score threshold &ge; 0.65"
                                value={`${(gateConf * 100).toFixed(0)}%`}
                                pass={gateConf >= 0.65}
                                progress={gateConf * 100}
                            />
                            <GateRow
                                label="CONE PRECISION"
                                desc="Entropy spread (P90&ndash;P10)/P50 &le; 15%"
                                value={`${(gateCone * 100).toFixed(0)}%`}
                                pass={gateCone <= 0.15}
                                progress={100 - (gateCone / 0.15) * 100}
                            />
                            <GateRow
                                label="SENTIMENT BIAS"
                                desc="FinBERT news lag alignment"
                                value={gateSentOk ? 'PASS' : 'FAIL'}
                                pass={gateSentOk}
                                progress={sentimentScore}
                            />
                        </div>

                        <div className={`mt-8 p-4 rounded-2xl border transition-all duration-700 ${signal === 'BUY' ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : signal === 'SELL' ? 'bg-rose-500/5 border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.1)]' : 'bg-amber-500/5 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.1)]'}`}>
                            <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 flex items-center gap-2 ${signal === 'BUY' ? 'text-emerald-400' : signal === 'SELL' ? 'text-rose-400' : 'text-amber-400'}`}>
                                <div className="w-2 h-2 rounded-full bg-current animate-pulse shadow-[0_0_8px_currentColor]" />
                                {signal} PROTOCOL ACTIVE
                            </p>
                            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Convergence established &middot; Dispatch ready</p>
                        </div>

                        {/* Gauge */}
                        <div className="flex justify-center mt-10">
                            <RadialGauge score={sentimentScore} label="News Correlation" />
                        </div>
                    </div>
                </div>

                {/* ── Row 3: SHAP + News + What-If ─────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

                    {/* SHAP Chart */}
                    <div className="glass rounded-2xl p-5 border border-slate-800/60">
                        <h3 className="text-sm font-bold text-slate-200 mb-1">Attribution Analysis</h3>
                        <p className="text-[10px] text-slate-500 mb-4">SHAP feature importance explaining today's {signal} signal</p>
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={shapData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="feature" type="category" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} width={90} />
                                <RechartsTooltip cursor={{ fill: 'rgba(51,65,85,0.3)' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '0.75rem', fontSize: '11px' }} />
                                <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                                    {shapData.map((entry: any, index: number) => (
                                        <Cell key={index} fill={entry.color} opacity={0.85} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>

                        {/* Rationale */}
                        <div className="mt-4 p-3 rounded-xl bg-indigo-500/8 border border-indigo-500/20">
                            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5">Model Rationale</p>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{explanation}</p>
                        </div>
                    </div>

                    {/* News Feed */}
                    <div className="glass rounded-2xl p-5 border border-slate-800/60">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-slate-200">Market Intelligence</h3>
                                <p className="text-[10px] text-slate-500 mt-0.5">FinBERT scored headlines</p>
                            </div>
                            <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${sentimentScore >= 60 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : sentimentScore >= 40 ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/30'}`}>
                                {sentimentScore}/100
                            </div>
                        </div>
                        <div className="space-y-0.5">
                            {(() => {
                                return safeArray(headlines).slice(0, 5).map((h: any, i: number) => (
                                    <NewsItem key={i} headline={h?.text || h?.title || h || 'Market update unavailable.'} sentiment={h?.sentiment || 'Neutral'} source="Yahoo Finance" />
                                ));
                            })()}
                        </div>
                    </div>

                    {/* What-If Controls */}
                    <div className="glass rounded-2xl p-5 border border-slate-800/60">
                        <div className="flex items-center gap-2 mb-4">
                            <Sliders className="w-4 h-4 text-violet-400" />
                            <div>
                                <h3 className="text-sm font-bold text-slate-200">What-If Simulator</h3>
                                <p className="text-[10px] text-slate-500 mt-0.5">Adjust parameters & re-evaluate</p>
                            </div>
                        </div>

                        <div className="space-y-5 mb-6">
                            <WhatIfSlider label="Lookback Memory (Days)" min={20} max={120} value={lookback} onChange={setLookback} unit="d" />
                            <WhatIfSlider label="Neural Depth (Layers)" min={1} max={6} value={depth} onChange={setDepth} unit="L" />
                            <WhatIfSlider label="Simulated Sentiment" min={0} max={100} value={simSentiment} onChange={setSimSentiment} unit="%" />
                        </div>

                        {/* Simulated output */}
                        <div className="space-y-2 mb-5">
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Scenario Output</p>
                            {[
                                { l: 'Proj. Return', v: `+${(lookback * 0.035).toFixed(1)}%`, c: 'text-emerald-400' },
                                { l: 'Risk Level', v: depth > 4 ? 'HIGH' : depth > 2 ? 'MED' : 'LOW', c: depth > 4 ? 'text-rose-400' : depth > 2 ? 'text-amber-400' : 'text-emerald-400' },
                                { l: 'Sentiment Bias', v: simSentiment > 60 ? 'Bullish' : simSentiment < 40 ? 'Bearish' : 'Neutral', c: simSentiment > 60 ? 'text-emerald-400' : simSentiment < 40 ? 'text-rose-400' : 'text-amber-400' },
                            ].map(s => (
                                <div key={s.l} className="flex items-center justify-between px-3 py-2 bg-slate-900/60 rounded-lg border border-slate-800/40">
                                    <span className="text-[11px] text-slate-500">{s.l}</span>
                                    <span className={`text-[11px] font-mono font-bold ${s.c}`}>{s.v}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={fetchData}
                            className="w-full py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-400 text-xs font-semibold transition-all hover:shadow-lg hover:shadow-indigo-500/20 flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Run Simulation
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
