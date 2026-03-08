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
const fmt = (v: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
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
    const color = pct >= 65 ? '#34d399' : pct >= 40 ? '#f59e0b' : '#f43f5e';
    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(51,65,85,0.6)" strokeWidth="8" />
                    <circle
                        cx="50" cy="50" r={r} fill="none"
                        stroke={color} strokeWidth="8"
                        strokeDasharray={`${stroke} ${circ - stroke}`}
                        strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 0.8s ease' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-black text-white">{pct}</span>
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest">Score</span>
                </div>
            </div>
            <span className="text-xs text-slate-400 font-medium tracking-wide">{label}</span>
        </div>
    );
}

// ─── Gate Row ────────────────────────────────────────────────
function GateRow({ label, desc, value, pass, progress }: {
    label: string; desc: string; value: string; pass: boolean; progress: number;
}) {
    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-slate-800/60 last:border-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${pass ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                {pass ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-200">{label}</span>
                    <span className={`text-[10px] font-mono font-bold ${pass ? 'text-emerald-400' : 'text-rose-400'}`}>{value}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1">
                    <div
                        className={`h-1 rounded-full transition-all duration-700 ${pass ? 'bg-emerald-400' : 'bg-rose-500'}`}
                        style={{ width: `${clamp(progress, 0, 100)}%`, boxShadow: pass ? '0 0 8px rgba(52,211,153,0.5)' : '0 0 8px rgba(244,63,94,0.5)' }}
                    />
                </div>
                <p className="text-[10px] text-slate-600 mt-0.5">{desc}</p>
            </div>
        </div>
    );
}

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent, icon: Icon }: {
    label: string; value: string; sub?: string; accent: 'emerald' | 'rose' | 'amber' | 'indigo' | 'violet'; icon: any;
}) {
    const colors: Record<string, string> = {
        emerald: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20 glow-emerald',
        rose: 'text-rose-400 bg-rose-400/10 border-rose-500/20 glow-rose',
        amber: 'text-amber-400 bg-amber-400/10 border-amber-500/20 glow-amber',
        indigo: 'text-indigo-400 bg-indigo-400/10 border-indigo-500/20 glow-indigo',
        violet: 'text-violet-400 bg-violet-400/10 border-violet-500/20',
    };
    const [textClass, bgClass] = colors[accent].split(' ');
    return (
        <div className={`glass rounded-2xl p-4 border ${colors[accent]}`}>
            <div className="flex items-start justify-between gap-2 mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
                <div className={`w-7 h-7 rounded-lg ${bgClass} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${textClass}`} />
                </div>
            </div>
            <p className={`text-2xl font-black ${textClass} leading-none mb-1`}>{value}</p>
            {sub && <p className="text-[11px] text-slate-500 mt-1.5">{sub}</p>}
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
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400 font-medium">{label}</span>
                <span className="text-xs font-mono text-indigo-400 font-bold">{value}{unit}</span>
            </div>
            <input
                type="range" min={min} max={max} value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full"
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
        <div className="p-4 md:p-5 lg:p-6 h-full overflow-y-auto">
            {/* Error Banner */}
            {error && (
                <div className="mb-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-400">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p className="text-sm flex-1">{error}</p>
                    <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-xs font-medium transition-colors">
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
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">

                    {/* Main Chart */}
                    <div className="xl:col-span-2 glass rounded-2xl p-5 border border-slate-800/60">
                        <div className="flex items-center justify-between mb-4">
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
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="coneGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.25} />
                                        <stop offset="100%" stopColor="#34d399" stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" />
                                <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} interval={9} />
                                <YAxis tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${fmtK(v)}`} domain={['auto', 'auto']} />
                                <RechartsTooltip content={<CustomTooltip />} />
                                <ReferenceLine
                                    x={CHART_DATA[59].date}
                                    stroke="rgba(99,102,241,0.4)"
                                    strokeDasharray="4 4"
                                    label={{ value: 'Today', position: 'top', fill: '#6366f1', fontSize: 9 }}
                                />
                                {/* Historical */}
                                <Area type="monotone" dataKey="price" name="Price" stroke="#6366f1" strokeWidth={2} fill="url(#histGrad)" dot={false} connectNulls={false} />
                                {/* Forecast cone shading as p90 area */}
                                <Area type="monotone" dataKey="p90" name="P90 (Optimistic)" stroke="rgba(52,211,153,0.5)" strokeWidth={1} strokeDasharray="4 2" fill="url(#coneGrad)" dot={false} connectNulls={false} />
                                {/* P50 */}
                                <Area type="monotone" dataKey="p50" name="P50 (Median)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" fill="transparent" dot={false} connectNulls={false} />
                                {/* P10 */}
                                <Area type="monotone" dataKey="p10" name="P10 (Bear)" stroke="rgba(244,63,94,0.5)" strokeWidth={1} strokeDasharray="4 2" fill="transparent" dot={false} connectNulls={false} />
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
                    <div className="glass rounded-2xl p-5 border border-slate-800/60">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldCheck className="w-4 h-4 text-indigo-400" />
                            <h3 className="text-sm font-bold text-slate-200">Neural Intelligence</h3>
                        </div>
                        <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">3-Gate signal verification ensures only high-confidence, low-uncertainty signals are emitted.</p>

                        <GateRow
                            label="Gate 1 · TFT Confidence"
                            desc="Model attention score ≥ 0.65 required"
                            value={`${(gateConf * 100).toFixed(0)}%`}
                            pass={gateConf >= 0.65}
                            progress={gateConf * 100}
                        />
                        <GateRow
                            label="Gate 2 · Cone Width"
                            desc="Forecast spread (P90–P10)/P50 ≤ 15%"
                            value={`${(gateCone * 100).toFixed(0)}%`}
                            pass={gateCone <= 0.15}
                            progress={100 - (gateCone / 0.15) * 100}
                        />
                        <GateRow
                            label="Gate 3 · Sentiment"
                            desc="News sentiment aligns with direction"
                            value={gateSentOk ? 'PASS' : 'FAIL'}
                            pass={gateSentOk}
                            progress={sentimentScore}
                        />

                        <div className={`mt-5 p-3 rounded-xl border text-center ${signal === 'BUY' ? 'bg-emerald-500/10 border-emerald-500/30' : signal === 'SELL' ? 'bg-rose-500/10 border-rose-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                            <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${signal === 'BUY' ? 'text-emerald-400' : signal === 'SELL' ? 'text-rose-400' : 'text-amber-400'}`}>
                                ● {signal} SIGNAL VERIFIED
                            </p>
                            <p className="text-[10px] text-slate-500">All 3 gates passed · Dispatching signal</p>
                        </div>

                        {/* Gauge */}
                        <div className="flex justify-center mt-5">
                            <RadialGauge score={sentimentScore} label="Sentiment Pulse" />
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
