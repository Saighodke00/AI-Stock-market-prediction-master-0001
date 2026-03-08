import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Cpu, Activity, ArrowRight } from 'lucide-react';

const TOP_SIGNALS = [
    { symbol: 'RELIANCE.NS', action: 'BUY', conf: 0.92, ret: 2.4, price: 2987.50, glow: 'glow-green', border: 'border-green', color: 'text-green' },
    { symbol: 'TCS.NS', action: 'BUY', conf: 0.88, ret: 1.8, price: 4102.00, glow: 'glow-green', border: 'border-green', color: 'text-green' },
    { symbol: 'INFY.NS', action: 'SELL', conf: 0.85, ret: -2.1, price: 1643.20, glow: 'glow-red', border: 'border-red', color: 'text-red' }
];

const SYSTEM_LOGS = [
    "[09:15:00] SYSTEM INITIALIZED. NSE DATA STREAM ACTIVE.",
    "[09:15:02] SWING MODEL WEIGHTS LOADED SUCCESSFULLY.",
    "[09:30:15] ANOMALY DETECTED IN IT SECTOR VOLUME.",
    "[09:45:00] PATTERN RECOGNITION DEPLOYED ACROSS 50 ASSETS.",
    "[10:00:12] SENTIMENT PIPELINE PROCESSED 1402 NEWS HEADLINES."
];

export const DashboardPage: React.FC = () => {
    const nav = useNavigate();

    return (
        <div className="flex flex-col h-full overflow-y-auto p-6 animate-page-in gap-8">

            {/* Header */}
            <div>
                <h1 className="font-display font-medium text-primary text-2xl tracking-wider glow-cyan inline-block">
                    DEEP SPACE COMMAND CENTRE
                </h1>
                <p className="font-data text-xs text-muted tracking-widest mt-1">
          // SYSTEM OVERVIEW & PRIMARY INTELLIGENCE FEED
                </p>
            </div>

            {/* Top 3 Metric Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface border border-dim rounded-xl p-5 flex items-start gap-4">
                    <div className="p-3 bg-cyan-dim rounded text-cyan border border-cyan/20">
                        <Cpu size={24} />
                    </div>
                    <div>
                        <h3 className="font-data text-[10px] text-cyan tracking-widest uppercase mb-1">Compute Core</h3>
                        <div className="font-display text-2xl text-primary font-bold">ONLINE</div>
                        <p className="font-body text-xs text-secondary mt-1">Latency: 12ms | GPUs: 4/4 Active</p>
                    </div>
                </div>

                <div className="bg-surface border border-dim rounded-xl p-5 flex items-start gap-4">
                    <div className="p-3 bg-green-dim rounded text-green border border-green/20">
                        <Activity size={24} />
                    </div>
                    <div>
                        <h3 className="font-data text-[10px] text-green tracking-widest uppercase mb-1">Market Data Feed</h3>
                        <div className="font-display text-2xl text-primary font-bold">SYNCED</div>
                        <p className="font-body text-xs text-secondary mt-1">NSE Level 2 Active | 542 Tickers</p>
                    </div>
                </div>

                <div className="bg-surface border border-dim rounded-xl p-5 flex items-start gap-4">
                    <div className="p-3 bg-gold-dim rounded text-gold border border-gold/20">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <h3 className="font-data text-[10px] text-gold tracking-widest uppercase mb-1">Risk System</h3>
                        <div className="font-display text-2xl text-primary font-bold">MONITORING</div>
                        <p className="font-body text-xs text-secondary mt-1">VIX: 14.2 (Stable) | Max Drawdown Cap: 2%</p>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Col: Top Signals */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <h2 className="font-display font-medium text-primary text-sm tracking-wider">🔥 HIGH-CONFIDENCE SIGNALS</h2>
                        <button onClick={() => nav('/screener')} className="font-body text-xs text-cyan hover:text-white transition-colors flex items-center gap-1">
                            View All <ArrowRight size={14} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {TOP_SIGNALS.map((sig, i) => (
                            <div
                                key={i}
                                className={`bg-surface border border-dim border-b-2 hover:border-b-4 hover:-translate-y-1 transition-all ${sig.border} rounded-xl p-4 cursor-pointer`}
                                onClick={() => nav('/swing')}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`font-display font-bold text-lg ${sig.glow}`}>{sig.symbol}</span>
                                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${sig.color} bg-void border border-dim`}>
                                        {sig.action}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 mb-4">
                                    <div className="flex justify-between">
                                        <span className="font-data text-[10px] text-secondary tracking-widest">CONFIDENCE</span>
                                        <span className="font-data text-xs text-primary">{Math.round(sig.conf * 100)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-void rounded-full overflow-hidden">
                                        <div className={`h-full ${sig.color.replace('text-', 'bg-')}`} style={{ width: `${sig.conf * 100}%` }} />
                                    </div>
                                </div>

                                <div className="flex justify-between items-center bg-void/50 p-2 rounded border border-dim border-dashed">
                                    <span className="font-body text-xs text-secondary">Est. Return</span>
                                    <span className={`font-data text-sm font-bold ${sig.color}`}>{sig.ret > 0 ? '+' : ''}{sig.ret.toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Quick Actions */}
                    <div className="mt-4 bg-surface border border-dim rounded-xl p-5">
                        <h2 className="font-display font-medium text-primary text-sm tracking-wider mb-4">QUICK NAVIGATION</h2>
                        <div className="flex flex-wrap gap-4">
                            <button onClick={() => nav('/swing')} className="px-6 py-3 bg-void border border-cyan/30 text-cyan rounded font-body text-sm hover:bg-cyan hover:text-void shadow-glow-cyan transition-all">
                                Launch Swing Terminal
                            </button>
                            <button onClick={() => nav('/intraday')} className="px-6 py-3 bg-void border border-dim text-secondary rounded font-body text-sm hover:border-primary hover:text-primary transition-colors">
                                Intraday Scalping
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Col: Logs & Status */}
                <div className="flex flex-col gap-6">
                    <div className="bg-surface border border-dim rounded-xl p-5 flex-1 shadow-lg">
                        <h2 className="font-display font-medium text-primary text-sm tracking-wider mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded bg-cyan glow-cyan animate-pulse-dot" /> SYSTEM LOGS
                        </h2>
                        <div className="bg-void border border-dim rounded p-3 h-64 overflow-y-auto">
                            {SYSTEM_LOGS.map((log, i) => (
                                <div key={i} className="font-data text-[11px] text-secondary mb-2 whitespace-pre-wrap">
                                    {log.startsWith('[') ? (
                                        <><span className="text-muted">{log.substring(0, 10)}</span> <span className="text-cyan">{log.substring(10)}</span></>
                                    ) : log}
                                </div>
                            ))}
                            <div className="font-data text-[11px] text-green animate-pulse mt-4">_</div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
