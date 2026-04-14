import React, { useState, useEffect, useCallback } from 'react';
import { 
  RefreshCw, Sliders, Shield, Zap, Info, 
  Target, Activity, Search, Box, Binary,
  Cpu, AlertTriangle, Terminal, LayoutGrid
} from 'lucide-react';
import { NeuralSpinner } from '../components/ui/LoadingStates';

// ─────────────────────────────────────────────────────────────────────────────
//  Intelligence Mapping & Localization
// ─────────────────────────────────────────────────────────────────────────────

const GATE_INTEL: Record<string, { title: string; logic: string; impact: string }> = {
  cone_max: {
    title: "Stability Horizon",
    logic: "Controls the AI's tolerance for price divergence (uncertainty).",
    impact: "Lowering this makes the AI extremely picky, only trading when price action is precise and predictable."
  },
  sent_buy_min: {
    title: "Sentiment Catalyst",
    logic: "Minimum neural sentiment score required for a LONG signal.",
    impact: "Increase this to ensure the AI only buys when news, social buzz, and institutional volume provide strong confirmation."
  },
  sent_sell_max: {
    title: "Pessimism Ceiling",
    logic: "The threshold of negative sentiment that triggers a distribution exit.",
    impact: "Lower values result in faster exits when the news cycle turns bearish."
  },
  rsi_buy_lo: {
    title: "Momentum Floor",
    logic: "The minimum RSI value required to prove underlying buying pressure.",
    impact: "Prevents entries on dead instruments by ensuring a baseline level of investor interest."
  },
  rsi_buy_hi: {
    title: "Momentum Ceiling",
    logic: "Protective RSI boundary that prevents entries into exhaustion zones.",
    impact: "The 'Don't Chase' gate. Prevents buying into overbought blow-offs where a reversal is imminent."
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const LogicCard = ({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) => {
  const intel = GATE_INTEL[id] || { title: label, logic: "Neural Weight Configuration", impact: "Modifies core signal confluence." };
  const [showIntel, setShowIntel] = useState(false);

  const max = id.includes('rsi') ? 100 : 1;
  const pct = (value / max) * 100;

  return (
    <div className="group/gate relative p-6 rounded-3xl border border-dim bg-white/[0.01] hover:bg-white/[0.03] transition-all duration-500 overflow-hidden">
      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-cyan-500/50 uppercase tracking-[0.3em] font-mono leading-none">
              Gate_{id.slice(0, 3).toUpperCase()}
            </span>
            <h3 className="text-lg font-display font-black text-white uppercase tracking-tight group-hover/gate:text-cyan-400 transition-colors">
              {intel.title}
            </h3>
          </div>
          <div className="flex items-center gap-3">
             <button 
                onClick={() => setShowIntel(!showIntel)}
                className={`p-2 rounded-xl border transition-all ${showIntel ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'border-dim text-muted hover:text-white'}`}
             >
                <Info size={14} />
             </button>
             <div className="px-4 py-2 bg-void/50 border border-mid rounded-xl font-mono font-black text-cyan-400 text-sm shadow-inner glow-cyan">
                {value}
             </div>
          </div>
        </div>

        {showIntel && (
          <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/10 space-y-2 animate-in slide-in-from-top-2 duration-300">
             <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">{intel.logic}</p>
             <p className="text-secondary text-[10px] font-bold leading-relaxed uppercase opacity-80">{intel.impact}</p>
          </div>
        )}

        <div className="relative h-2 flex items-center">
            <div className="absolute inset-x-0 h-1.5 bg-void rounded-full border border-dim overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-indigo-500 transition-all duration-500" 
                    style={{ width: `${pct}%` }}
                />
            </div>
            <input 
                type="range" 
                min={id.includes('rsi') ? "0" : "0"} 
                max={max} 
                step="0.01" 
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="absolute inset-x-0 w-full opacity-0 cursor-pointer h-full z-10"
            />
            <div 
                className="absolute w-6 h-6 bg-white rounded-full border-[6px] border-cyan-500 shadow-xl transition-all duration-100 pointer-events-none group-hover/gate:scale-110"
                style={{ left: `calc(${pct}% - 12px)` }}
            />
        </div>
      </div>

      {/* Decorative pulse when gate is 'active' */}
      <div className={`absolute -bottom-16 -right-16 w-32 h-32 blur-3xl opacity-5 transition-opacity group-hover/gate:opacity-20 pointer-events-none bg-cyan-500`} />
    </div>
  );
};

const MetricHub = ({ label, value, sub, color, loading }: { label: string; value: string | number; sub: string; color: string; loading?: boolean }) => (
    <div className={`p-6 rounded-3xl border border-mid bg-void shadow-2xl relative overflow-hidden group hover:scale-[1.02] transition-transform ${loading ? 'opacity-50 grayscale' : ''}`}>
        <div className="relative z-10 flex flex-col gap-1">
            <span className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">{label}</span>
            <div className={`text-3xl font-display font-black tracking-tighter ${color}`}>{value}</div>
            <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest mt-1 italic">{sub}</span>
        </div>
        <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-3xl opacity-10 pointer-events-none ${color.replace('text-', 'bg-')}`} />
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  Main Page
// ─────────────────────────────────────────────────────────────────────────────

export const HyperTunerPage: React.FC = () => {
    const [settings, setSettings] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [optimizing, setOptimizing] = useState(false);
    const [ticker, setTicker] = useState('RELIANCE');
    const [syncing, setSyncing] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [settRes, statsRes] = await Promise.all([
                fetch('/api/tuner'),
                fetch(`/api/tuner/backtest?ticker=${ticker}`)
            ]);
            setSettings(await settRes.json());
            setStats(await statsRes.json());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const runOptimization = async () => {
        setOptimizing(true);
        try {
            const res = await fetch(`/api/tuner/optimize?ticker=${ticker}`);
            const data = await res.json();
            if (data.status === "OPTIMIZED") {
                setSettings({
                    ...settings,
                    gate_thresholds: { ...settings.gate_thresholds, ...data.best_config }
                });
                // Re-backtest
                const bRes = await fetch(`/api/tuner/backtest?ticker=${ticker}`);
                setStats(await bRes.json());
            }
        } finally {
            setOptimizing(false);
        }
    };

    const handleSave = async () => {
        setSyncing(true);
        try {
            await fetch('/api/tuner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
        } finally {
            setTimeout(() => setSyncing(false), 800);
        }
    };

    const updateGate = (key: string, val: number) => {
        setSettings({
            ...settings,
            gate_thresholds: { ...settings.gate_thresholds, [key]: val }
        });
    };

    if (loading) return (
        <div className="h-full flex flex-col items-center justify-center gap-6">
            <NeuralSpinner />
            <span className="text-[10px] font-black tracking-[0.4em] text-cyan-500/60 uppercase animate-pulse">Initializing Neural Interface</span>
        </div>
    );

    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Header Terminal */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8 border-b border-dim pb-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-2xl shadow-indigo-500/5 group hover:border-indigo-500/50 transition-all">
                            <Cpu className="text-indigo-400 group-hover:rotate-90 transition-transform duration-700" size={28} />
                        </div>
                        <div>
                            <h1 className="text-5xl font-display font-black text-white tracking-tighter uppercase leading-none">
                                Hyper <span className="text-cyan-400 italic">Tuner</span>
                            </h1>
                            <p className="text-muted text-[10px] font-black uppercase tracking-[0.4em] mt-2 flex items-center gap-2">
                                <Terminal size={12} className="text-indigo-500" />
                                Apex_AI // Parametric_Strategy_Synthesizer
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 p-2 bg-void/50 border border-dim rounded-3xl backdrop-blur-3xl shadow-inner">
                    <div className="relative">
                        <Target size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-cyan-400 opacity-50" />
                        <input 
                            type="text"
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value.toUpperCase())}
                            onBlur={loadData}
                            className="bg-void/50 border border-dim rounded-2xl py-4 pl-12 pr-6 text-xs font-mono font-black text-white focus:outline-none focus:border-cyan-500/30 transition-all w-48 uppercase"
                            placeholder="LOAD_TICKER"
                        />
                    </div>
                    
                    <button 
                        onClick={runOptimization}
                        disabled={optimizing}
                        className="flex items-center gap-3 px-8 py-4 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-2xl text-[10px] font-black tracking-widest uppercase hover:bg-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {optimizing ? <RefreshCw className="animate-spin" size={14} /> : <Search size={14} />}
                        {optimizing ? 'Neural Search Active' : 'Neural Optimization'}
                    </button>

                    <button 
                        onClick={handleSave}
                        disabled={syncing}
                        className="flex items-center gap-3 px-10 py-4 bg-cyan-500 text-void rounded-2xl font-black text-[11px] tracking-[0.2em] uppercase hover:bg-cyan-400 transition-all shadow-xl shadow-cyan-500/20 active:scale-95 group"
                    >
                        {syncing ? <RefreshCw className="animate-spin" size={14} /> : <Zap size={14} className="group-hover:animate-pulse fill-current" />}
                        {syncing ? 'Syncing...' : 'Commit Protocol'}
                    </button>
                </div>
            </div>

            {/* Performance Modules */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricHub label="Simulation Success" value={`${stats?.win_rate || 0}%`} sub="Backtested Win Rate" color="text-emerald-400" />
                <MetricHub label="Total Alpha" value={`${stats?.total_return_pct || 0}%`} sub="Net Cumulative Return" color="text-cyan-400" />
                <MetricHub label="Signal Density" value={stats?.total_trades || 0} sub="Ops per 30D Window" color="text-indigo-400" />
                <MetricHub label="Execution Logic" value="GRIT_V4" sub="Ensemble Confluence" color="text-secondary" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-stretch pt-4">
                {/* Neural Gates Panel */}
                <div className="xl:col-span-8 flex flex-col gap-6">
                    <div className="p-8 pb-4">
                       <h2 className="text-white font-display font-black text-xl uppercase tracking-tight flex items-center gap-4">
                          <Sliders className="text-cyan-400" size={20} />
                          Intelligence Gates
                       </h2>
                       <p className="text-muted text-[10px] font-bold uppercase tracking-widest mt-2 px-1 text-center lg:text-left">
                          Adjusting these thresholds will modify the signal confluence criteria in real-time across the entire Apex AI platform.
                       </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {settings?.gate_thresholds && Object.entries(settings.gate_thresholds).map(([key, val]: [string, any]) => (
                            <LogicCard key={key} id={key} label={key} value={val} onChange={(v) => updateGate(key, v)} />
                        ))}
                    </div>

                    <div className="mt-4 p-8 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col lg:flex-row items-center gap-8 group">
                         <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                            <Activity className="text-indigo-400 group-hover:scale-110 transition-transform" size={32} />
                         </div>
                         <div className="flex-1 text-center lg:text-left">
                            <h4 className="text-white font-display font-black text-xs uppercase tracking-widest mb-2 font-mono">Neural Inference Engine Stats (v4.3)</h4>
                            <p className="text-[10px] text-muted font-bold leading-relaxed uppercase tracking-tight max-w-2xl font-body">
                                Your current configuration requires a confluence of {Object.keys(settings?.gate_thresholds || {}).length} unique data gates. This ensures that every BUY/SELL signal is backed by a harmonic resonance of technical, social, and institutional telemetry. 
                                <span className="text-cyan-400 opacity-60 ml-2 italic">Expect lower signal density with more conservative thresholds.</span>
                            </p>
                         </div>
                    </div>
                </div>

                {/* System Specs & Sidebar */}
                <div className="xl:col-span-4 flex flex-col gap-8">
                    <div className="glass-card p-10 flex flex-col h-full bg-void shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Box size={140} className="text-white" />
                        </div>
                        
                        <div className="flex items-center gap-3 mb-10">
                           <LayoutGrid size={20} className="text-cyan-400" />
                           <h3 className="text-white font-display font-black text-sm uppercase tracking-[0.3em]">System Manifest</h3>
                        </div>

                        <div className="space-y-6 flex-1 relative z-10">
                            {[
                                { label: "Temporal Depth", value: "60 Steps", icon: <RefreshCw size={14} /> },
                                { label: "Neuron Clusters", value: "32 Cores", icon: <Cpu size={14} /> },
                                { label: "Optimizer Logic", value: "Genetic_Search", icon: <Search size={14} /> },
                                { label: "Kernal Variant", value: "Apex_v4.2", icon: <Binary size={14} /> }
                            ].map((spec, i) => (
                                <div key={i} className="flex justify-between items-center group/spec py-2">
                                    <div className="flex items-center gap-3 text-muted group-hover/spec:text-secondary transition-colors">
                                        {spec.icon}
                                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">{spec.label}</span>
                                    </div>
                                    <span className="font-mono text-[10px] font-black text-white px-3 py-1 bg-white/5 border border-dim rounded-lg group-hover/spec:border-cyan-500/30 transition-all">{spec.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-12 p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex gap-4 items-start">
                            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[9px] text-amber-500/80 font-black leading-relaxed uppercase tracking-tighter">
                                Warning: Over-tuning for high win-rates may cause "Overfitting." Ensure the Strategy Telemetry remains stable across multiple tickers before committing.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
