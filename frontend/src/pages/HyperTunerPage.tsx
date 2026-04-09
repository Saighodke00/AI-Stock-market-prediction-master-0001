import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, Sliders, Shield, Zap, Info, Play, Target, Activity, Search } from 'lucide-react';
import { NeuralSpinner } from '../components/ui/LoadingStates';

export const HyperTunerPage: React.FC = () => {
    const [settings, setSettings] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [optimizing, setOptimizing] = useState(false);
    const [ticker, setTicker] = useState('RELIANCE');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [settRes, statsRes] = await Promise.all([
                fetch('/api/tuner'),
                fetch(`/api/tuner/backtest?ticker=${ticker}`)
            ]);
            const sett = await settRes.json();
            const st = await statsRes.json();
            setSettings(sett);
            setStats(st);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const runBacktest = async () => {
        try {
            const res = await fetch(`/api/tuner/backtest?ticker=${ticker}`);
            const data = await res.json();
            setStats(data);
        } catch (err) {
            console.error(err);
        }
    };

    const runOptimize = async () => {
        setOptimizing(true);
        try {
            const res = await fetch(`/api/tuner/optimize?ticker=${ticker}`);
            const data = await res.json();
            if (data.status === "OPTIMIZED") {
                setSettings({
                    ...settings,
                    gate_thresholds: {
                        ...settings.gate_thresholds,
                        ...data.best_config
                    }
                });
                // Auto-run backtest for new settings
                setTimeout(runBacktest, 500);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setOptimizing(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await fetch('/api/tuner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            alert('PROTOCOL UPDATED: Neural weights synchronized.');
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const updateGate = (key: string, val: number) => {
        setSettings({
            ...settings,
            gate_thresholds: {
                ...settings.gate_thresholds,
                [key]: val
            }
        });
    };

    if (loading) return (
        <div className="h-full flex flex-col items-center justify-center gap-8">
            <div className="relative">
                <NeuralSpinner />
                <div className="absolute -inset-4 bg-indigo-500/20 blur-2xl animate-pulse -z-10" />
            </div>
            <p className="text-indigo-400/60 font-data text-[10px] tracking-[0.4em] uppercase animate-pulse">Accessing Core Logic Streams...</p>
        </div>
    );

    return (
        <div className="p-8 md:p-12 max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700 bg-void min-h-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
                <div className="flex flex-col gap-3">
                    <div className="text-[10px] font-mono text-cyan-400/40 tracking-[0.3em] mb-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-500/50 animate-pulse" />
                        // NEURAL ENGINE TUNING TERMINAL
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">
                        HYPER <span className="text-cyan-400 scanline-effect px-2 py-0.5 rounded border border-cyan-500/20 bg-cyan-500/5">TUNER</span>
                    </h1>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-cyan-400/50">
                            <Target size={14} />
                        </div>
                        <input 
                            type="text"
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value.toUpperCase())}
                            className="bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-11 pr-4 text-xs font-mono text-cyan-400 focus:outline-none focus:border-cyan-500/50 transition-all w-32"
                            placeholder="TICKER"
                        />
                    </div>
                    <button 
                        onClick={runOptimize}
                        disabled={optimizing}
                        className={`flex items-center gap-2 px-6 py-3 border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 rounded-xl text-[10px] font-black tracking-widest uppercase hover:bg-indigo-500/20 transition-all ${optimizing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <Search size={14} className={optimizing ? "animate-spin" : ""} />
                        {optimizing ? 'OPTIMIZING...' : 'NEURAL SEARCH'}
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex items-center gap-2 px-8 py-3 bg-cyan-500 text-void rounded-xl font-black text-[10px] tracking-widest uppercase hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
                    >
                        <Save size={14} strokeWidth={3} /> COMMIT PROTOCOL
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
                {/* Gate Thresholds */}
                <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-white/[0.01] p-10 flex flex-col gap-10 overflow-hidden group neural-hud relative">
                     <div className="absolute inset-0 scanline-effect opacity-[0.01] pointer-events-none" />
                     <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Shield size={120} className="text-white" />
                    </div>
                    
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
                            <Sliders size={24} />
                        </div>
                        <div>
                            <h2 className="font-black text-xl text-white uppercase tracking-tight">Confluence Guardrails</h2>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">Adjusting sensitivity for neural trade gates</p>
                        </div>
                    </div>

                    <div className="space-y-12 relative z-10">
                        {settings?.gate_thresholds && Object.entries(settings.gate_thresholds).map(([key, value]: [string, any]) => (
                            <div key={key} className="group/slider">
                                <div className="flex justify-between items-end mb-4 px-1">
                                    <label className="text-[10px] font-mono font-black text-white/30 uppercase tracking-[0.2em] group-hover/slider:text-cyan-400 transition-colors">{key.replace(/_/g, ' ')}</label>
                                    <span className="text-sm font-mono font-bold text-cyan-400 bg-void/50 px-3 py-1 rounded-lg border border-cyan-500/20 glow-cyan">{value}</span>
                                </div>
                                <div className="relative h-2 flex items-center">
                                    <div className="absolute inset-x-0 h-1 bg-white/5 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 shadow-[0_0_15px_rgba(34,211,238,0.3)]" 
                                            style={{ width: `${(value / (key.includes('rsi') ? 100 : 1)) * 100}%` }}
                                        />
                                    </div>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max={key.includes('rsi') ? "100" : "1"} 
                                        step="0.01" 
                                        value={value}
                                        onChange={(e) => updateGate(key, parseFloat(e.target.value))}
                                        className="absolute inset-x-0 w-full opacity-0 cursor-pointer h-full z-10"
                                    />
                                    <div 
                                        className="absolute w-5 h-5 bg-white rounded-full border-[6px] border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.5)] transition-all duration-300 pointer-events-none"
                                        style={{ left: `calc(${(value / (key.includes('rsi') ? 100 : 1)) * 100}% - 10px)` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Model Params & System */}
                <div className="lg:col-span-5 flex flex-col gap-8 relative z-10">
                    <div className="neon-frame p-8 flex flex-col gap-8">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-cyan/10 text-cyan rounded-2xl border border-cyan/20">
                                <Sliders size={24} />
                            </div>
                            <h2 className="font-display font-black text-xl text-white uppercase tracking-tight">Engine Specs</h2>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="bg-void/40 p-5 rounded-2xl border border-white/5 space-y-4 shadow-inner">
                                <div className="flex justify-between items-center group/item hover:translate-x-1 transition-transform">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Temporal Window</span>
                                    <span className="px-3 py-1 bg-cyan/10 text-cyan text-xs font-data font-bold rounded-lg border border-cyan/10">{settings?.model_params?.sequence_length} STEPS</span>
                                </div>
                                <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                                <div className="flex justify-between items-center group/item hover:translate-x-1 transition-transform">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Neuron Density</span>
                                    <span className="px-3 py-1 bg-emerald/10 text-emerald text-xs font-data font-bold rounded-lg border border-emerald/10">{settings?.model_params?.features} CORES</span>
                                </div>
                            </div>

                            <div className="p-5 bg-cyan/[0.03] rounded-2xl border border-cyan/10 flex items-start gap-4">
                                <Info size={18} className="text-cyan shrink-0 mt-0.5" />
                                <p className="text-[9px] text-slate-400 font-bold leading-relaxed uppercase tracking-tight">
                                    Ensemble weights are derived from GRU-TCN signal convergence. Dynamic weight shifting enabled for v4.0 architecture.
                                </p>
                            </div>
                        </div>
                    </div>
                    {/* Performance Telemetry */}
                    <div className="relative rounded-2xl border border-white/10 bg-white/[0.02] p-8 overflow-hidden neural-hud group">
                        <div className="absolute inset-0 scanline-effect opacity-[0.02] pointer-events-none" />
                        
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                                    <Activity size={24} />
                                </div>
                                <div>
                                    <h2 className="font-black text-lg text-white uppercase tracking-tight">Strategy Telemetry</h2>
                                    <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">30-Day Simulated Performance</p>
                                </div>
                            </div>
                            <button 
                                onClick={runBacktest}
                                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 text-slate-400 hover:text-white"
                            >
                                <RefreshCw size={16} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 text-center group/stat hover:border-cyan-500/30 transition-all">
                                <div className="text-[10px] font-mono text-white/30 tracking-widest mb-1">WIN RATE</div>
                                <div className={`text-3xl font-black ${stats?.win_rate > 50 ? 'text-emerald-400' : 'text-rose-400'} drop-shadow-[0_0_10px_rgba(16,185,129,0.2)]`}>
                                    {stats?.win_rate}%
                                </div>
                            </div>
                            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 text-center group/stat hover:border-cyan-500/30 transition-all">
                                <div className="text-[10px] font-mono text-white/30 tracking-widest mb-1">TOTAL RETURN</div>
                                <div className={`text-3xl font-black ${stats?.total_return_pct > 0 ? 'text-cyan-400' : 'text-rose-400'} drop-shadow-[0_0_10px_rgba(34,211,238,0.2)]`}>
                                    {stats?.total_return_pct}%
                                </div>
                            </div>
                            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 text-center col-span-2 flex justify-between items-center group/stat px-8">
                                <div className="text-left">
                                    <div className="text-[9px] font-mono text-white/25 tracking-widest uppercase">Signal Density</div>
                                    <div className="text-xs font-black text-white tracking-widest">{stats?.total_trades} TRADES EXECUTED</div>
                                </div>
                                <div className="h-0.5 w-24 bg-white/5 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500" 
                                        style={{ width: `${Math.min(stats?.total_trades * 5, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 p-6 bg-cyan-500/5 rounded-2xl border border-cyan-500/10 flex items-start gap-4">
                            <Info size={18} className="text-cyan-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-tight">
                                Backtest simulations incorporate trading fees (0.1%) and use a 3-day mean-reversion exit logic. {ticker} specific regime detected as SIDEWAYS.
                            </p>
                        </div>
                    </div>

                    {/* System Meta */}
                    <div className="relative rounded-2xl border border-white/10 bg-white/[0.01] p-10 flex flex-col gap-6 relative overflow-hidden group neural-hud">
                        <div className="absolute -right-4 -bottom-4 p-8 opacity-5 group-hover:scale-125 transition-transform duration-1000">
                            <Zap size={140} className="text-white" />
                        </div>
                        <div className="flex items-center gap-4 text-white/20 relative z-10">
                            <Zap size={24} />
                            <h2 className="font-black text-xl uppercase tracking-tight">System ID</h2>
                        </div>
                        <div className="font-mono text-[11px] text-cyan-400/30 bg-void/50 p-6 rounded-2xl border border-white/5 relative z-10 leading-loose uppercase tracking-[0.3em] font-bold italic">
                            {`ID: APEX-TUNER-ENGINE\nSTATUS: VERIFIED\nKERNEL: OPTIMIZED`}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
