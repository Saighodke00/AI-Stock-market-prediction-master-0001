import React, { useState } from 'react';
import axios from 'axios';
import {
    Play, LineChart as ChartIcon, ShieldCheck,
    AlertTriangle, Target, Percent, Loader2
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer
} from 'recharts';
import { BacktestResponse } from '../types';

export default function BacktestView() {
    const [ticker, setTicker] = useState('AAPL');
    const [initialCapital, setInitialCapital] = useState(10000);
    const [timeStep, setTimeStep] = useState(60);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<BacktestResponse | null>(null);

    const handleRunBacktest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await axios.post<BacktestResponse>('/api/backtest', {
                ticker,
                start_date: '2023-01-01',
                end_date: '2024-01-01',
                config: { initial_capital: initialCapital, time_step: timeStep }
            });
            setResults(response.data);
        } catch (err) {
            console.error("Backtest failed", err);
        } finally {
            setLoading(false);
        }
    };

    const chartData = results?.equity_curve.map((val, i) => ({
        day: i,
        equity: val
    })) || [];

    return (
        <div className="p-6 space-y-8 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-gray-900 border border-gray-800 p-8 rounded-3xl shadow-xl">
                <form onSubmit={handleRunBacktest} className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Target Asset</label>
                        <input
                            type="text"
                            className="bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all uppercase"
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Initial Capital ($)</label>
                        <input
                            type="number"
                            className="bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all"
                            value={initialCapital}
                            onChange={(e) => setInitialCapital(Number(e.target.value))}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Lookback Window (Days)</label>
                        <select
                            className="bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all appearance-none"
                            value={timeStep}
                            onChange={(e) => setTimeStep(Number(e.target.value))}
                        >
                            <option value={30}>30 Days (Short-term)</option>
                            <option value={60}>60 Days (Standard)</option>
                            <option value={120}>120 Days (Long-term)</option>
                        </select>
                    </div>
                </form>

                <button
                    onClick={handleRunBacktest}
                    disabled={loading}
                    className="h-[52px] px-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 whitespace-nowrap"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                    Compute Simulation
                </button>
            </div>

            {results && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
                    <div className="lg:col-span-3 bg-gray-900 border border-gray-800 rounded-3xl p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <ChartIcon className="w-6 h-6 text-indigo-400" />
                                Performance Trajectory
                            </h3>
                            <div className="text-right">
                                <span className="text-xs text-gray-500 uppercase font-bold">Terminal Equity</span>
                                <div className="text-2xl font-mono font-bold text-emerald-400">
                                    ${results.equity_curve[results.equity_curve.length - 1].toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" />
                                    <XAxis dataKey="day" hide />
                                    <YAxis
                                        domain={['auto', 'auto']}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#4b5563', fontSize: 12 }}
                                        tickFormatter={(val) => `$${val / 1000}k`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '13px' }}
                                        itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                                        formatter={(val: number) => [`$${val.toLocaleString()}`, 'Portfolio Value']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="equity"
                                        stroke="#6366f1"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorEquity)"
                                        animationDuration={1500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {[
                            { label: 'Sharpe Ratio', value: results.metrics.sharpe.toFixed(2), icon: ShieldCheck, color: 'text-indigo-400' },
                            { label: 'Sortino Ratio', value: results.metrics.sortino.toFixed(2), icon: Target, color: 'text-emerald-400' },
                            { label: 'Directional Accuracy', value: `${results.metrics.accuracy.toFixed(1)}%`, icon: Percent, color: 'text-amber-400' },
                        ].map((stat) => (
                            <div key={stat.label} className="bg-gray-900 border border-gray-800 p-6 rounded-2xl shadow-sm">
                                <stat.icon className={`w-8 h-8 ${stat.color} mb-3`} />
                                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">{stat.label}</span>
                                <div className="text-3xl font-bold text-white mt-1">{stat.value}</div>
                            </div>
                        ))}

                        <div className="bg-indigo-600/10 border border-indigo-500/20 p-6 rounded-2xl">
                            <h4 className="flex items-center gap-2 text-indigo-400 font-bold text-sm mb-2 uppercase">
                                <AlertTriangle className="w-4 h-4" /> Simulation Note
                            </h4>
                            <p className="text-xs text-gray-400 leading-relaxed italic">
                                Results based on walk-forward execution utilizing {timeStep}-day rolling feature sets. Past performance remains non-indicative of future delta.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
