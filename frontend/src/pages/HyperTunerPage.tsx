import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, Sliders, Shield, Zap, Info } from 'lucide-react';
import { NeuralSpinner } from '../components/ui/LoadingStates';

export const HyperTunerPage: React.FC = () => {
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/tuner')
            .then(res => res.json())
            .then(data => {
                setSettings(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

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
        <div className="p-8 md:p-12 max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
                <div className="flex flex-col gap-3">
                    <h1 className="text-4xl font-display font-black text-white tracking-wider inline-block uppercase bg-gradient-to-r from-indigo-400 to-cyan-500 bg-clip-text text-transparent">Hyper Tuner</h1>
                    <p className="text-slate-500 font-data text-xs tracking-[0.3em] uppercase">// MODEL THRESHOLDS & INFERENCE CONFIGURATION</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <button className="flex-1 md:flex-none p-4 bg-void/50 border border-white/10 rounded-2xl hover:text-indigo-400 transition-all backdrop-blur-md">
                        <RefreshCw size={20} />
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex-[2] md:flex-none flex items-center justify-center gap-3 px-10 py-4 bg-indigo-500 text-white rounded-2xl font-display font-black text-xs tracking-[0.2em] uppercase hover:bg-indigo-400 transition-all shadow-2xl shadow-indigo-500/30 active:scale-95"
                    >
                        <Save size={18} /> COMMIT PROTOCOL
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
                {/* Gate Thresholds */}
                <div className="lg:col-span-7 glass-card p-10 flex flex-col gap-10 border-indigo-500/20 shadow-2xl overflow-hidden group">
                     <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Shield size={120} className="text-white" />
                    </div>
                    
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
                            <Shield size={24} />
                        </div>
                        <div>
                            <h2 className="font-display font-black text-xl text-white uppercase tracking-tight">Gate Confluence</h2>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">Adjusting sensitivity for neural guardrails</p>
                        </div>
                    </div>

                    <div className="space-y-10 relative z-10">
                        {settings?.gate_thresholds && Object.entries(settings.gate_thresholds).map(([key, value]: [string, any]) => (
                            <div key={key} className="group/slider">
                                <div className="flex justify-between items-end mb-4 px-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] group-hover/slider:text-indigo-400 transition-colors">{key.replace(/_/g, ' ')}</label>
                                    <span className="text-sm font-mono font-bold text-white bg-void/50 px-3 py-1 rounded-lg border border-white/5">{value}</span>
                                </div>
                                <div className="relative h-2 flex items-center">
                                    <div className="absolute inset-x-0 h-1 bg-void rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
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
                                        className="absolute w-5 h-5 bg-white rounded-full border-4 border-indigo-500 shadow-xl transition-all duration-300 pointer-events-none"
                                        style={{ left: `calc(${(value / (key.includes('rsi') ? 100 : 1)) * 100}% - 10px)` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Model Params & System */}
                <div className="lg:col-span-5 flex flex-col gap-8 relative z-10">
                    <div className="glass-card p-8 flex flex-col gap-8 border-indigo-500/10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-400/20">
                                <Sliders size={24} />
                            </div>
                            <h2 className="font-display font-black text-xl text-white uppercase tracking-tight">Engine Specs</h2>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="bg-void/40 p-5 rounded-2xl border border-white/5 space-y-4 shadow-inner">
                                <div className="flex justify-between items-center group/item hover:translate-x-1 transition-transform">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Temporal Window</span>
                                    <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 text-xs font-mono font-bold rounded-lg border border-indigo-500/10">{settings?.model_params?.sequence_length} STEPS</span>
                                </div>
                                <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                                <div className="flex justify-between items-center group/item hover:translate-x-1 transition-transform">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Neuron Density</span>
                                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold rounded-lg border border-emerald-500/10">{settings?.model_params?.features} CORES</span>
                                </div>
                            </div>

                            <div className="p-5 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 flex items-start gap-4">
                                <Info size={18} className="text-indigo-400 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-tight">
                                    Ensemble weights are derived from GRU-TCN signal convergence. Dynamic weight shifting enabled for v4.0 architecture.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-10 bg-void border-white/5 flex flex-col gap-6 relative overflow-hidden group">
                        <div className="absolute -right-4 -bottom-4 p-8 opacity-5 group-hover:scale-125 transition-transform duration-1000">
                            <Zap size={140} className="text-white" />
                        </div>
                        <div className="flex items-center gap-4 text-cyan-400 relative z-10">
                            <Zap size={24} />
                            <h2 className="font-display font-black text-xl uppercase tracking-tight">System ID</h2>
                        </div>
                        <div className="font-mono text-[10px] text-slate-500 bg-void/50 p-6 rounded-2xl border border-white/5 relative z-10 leading-loose uppercase tracking-[0.2em] shadow-inner">
                            {`ID: APEX-PROTO-V3\nSYNC: OPERATIONAL\nREGION: DELTA-X\nKERN: VERIFIED`}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
