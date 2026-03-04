import React, { useEffect, useRef } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
    ArrowUpRight, ArrowDownRight, AlertCircle, RefreshCw, Gauge, Loader2
} from 'lucide-react';
import { createChart, ColorType, LineStyle, CrosshairMode } from 'lightweight-charts';
import { APIResponse } from '../types';

interface DashboardViewProps {
    signalData: APIResponse | null;
    loading: boolean;
    error: string | null;
    fetchData: () => void;
    ticker: string;
}

export default function DashboardView({ signalData, loading, error, fetchData, ticker }: DashboardViewProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartContainerRef.current || !signalData) return;

        chartContainerRef.current.innerHTML = '';
        const chart = createChart(chartContainerRef.current, {
            layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#9CA3AF' },
            grid: { vertLines: { color: '#1F2937', style: LineStyle.Dotted }, horzLines: { color: '#1F2937', style: LineStyle.Dotted } },
            crosshair: { mode: CrosshairMode.Normal },
            timeScale: { borderColor: '#374151', timeVisible: true },
            rightPriceScale: { borderColor: '#374151' },
            height: 380,
        });

        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#10B981', downColor: '#EF4444',
            borderVisible: false, wickUpColor: '#10B981', wickDownColor: '#EF4444'
        });

        if (signalData.historical_data && signalData.historical_data.length > 0) {
            candlestickSeries.setData(signalData.historical_data as any);
            const lastPoint = signalData.historical_data[signalData.historical_data.length - 1];
            candlestickSeries.setMarkers([{
                time: lastPoint.time, position: 'aboveBar', color: '#6366F1', shape: 'arrowDown', text: 'TODAY'
            }]);
        }

        if (signalData.forecast_data && signalData.forecast_data.length > 0) {
            const p50Series = chart.addLineSeries({
                color: '#F59E0B', lineWidth: 2, lineStyle: LineStyle.Dashed, title: 'P50 (Median)'
            });
            p50Series.setData(signalData.forecast_data.map(d => ({ time: d.time, value: d.p50 })));

            const p90Series = chart.addLineSeries({
                color: 'rgba(59, 130, 246, 0.6)', lineWidth: 1, title: 'P90 (Optimistic)'
            });
            p90Series.setData(signalData.forecast_data.map(d => ({ time: d.time, value: d.p90 })));

            const p10Series = chart.addLineSeries({
                color: 'rgba(236, 72, 153, 0.6)', lineWidth: 1, title: 'P10 (Pessimistic)'
            });
            p10Series.setData(signalData.forecast_data.map(d => ({ time: d.time, value: d.p10 })));
        }

        chart.timeScale().fitContent();

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);
        setTimeout(handleResize, 100);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [signalData]);

    const shapData = signalData?.shap_features?.map(f => ({
        feature: f.feature,
        impact: f.impact,
        color: f.impact > 0 ? '#10B981' : '#EF4444'
    })) || [];

    return (
        <div className="p-4 md:p-6 lg:p-8 flex-1 max-w-7xl mx-auto w-full transition-opacity duration-500">
            {error && (
                <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-4 text-rose-400">
                    <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-semibold">Connection Error</h3>
                        <p className="text-sm opacity-80 mt-1">{error}</p>
                    </div>
                    <button onClick={fetchData} className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" /> Retry
                    </button>
                </div>
            )}

            <div className={`space-y-6 ${loading ? 'opacity-40' : 'opacity-100'} transition-opacity block`}>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-gray-400 font-medium px-2">Market Dynamics & Probabilistic Forecast</h3>
                        {loading && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />}
                    </div>
                    <div ref={chartContainerRef} className="w-full h-[380px] rounded-lg overflow-hidden relative border border-gray-800/50 bg-gray-950/50" />

                    {signalData && signalData.forecast_data.length > 0 && (
                        <div className="grid grid-cols-3 gap-4 mt-6">
                            {[
                                { label: 'P10 (Low)', val: signalData.forecast_data[signalData.forecast_data.length - 1].p10 },
                                { label: 'P50 (Median)', val: signalData.forecast_data[signalData.forecast_data.length - 1].p50 },
                                { label: 'P90 (High)', val: signalData.forecast_data[signalData.forecast_data.length - 1].p90 },
                            ].map((item) => (
                                <div key={item.label} className="bg-gray-950 p-4 rounded-xl border border-gray-800 flex flex-col gap-1 items-center text-center">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{item.label}</span>
                                    <span className="text-lg font-mono text-gray-200">${item.val.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 lg:col-span-2 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-200 mb-6">Attribution Analysis (SHAP)</h3>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={shapData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="feature" type="category" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 13 }} width={120} />
                                    <RechartsTooltip cursor={{ fill: '#1F2937' }} contentStyle={{ backgroundColor: '#030712', borderColor: '#1F2937', borderRadius: '0.5rem' }} />
                                    <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
                                        {shapData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-gray-900 border border-indigo-500/20 rounded-2xl p-6 shadow-sm">
                            <h3 className="text-sm font-bold text-indigo-400 mb-3 uppercase tracking-widest">Model Rationale</h3>
                            <p className="text-gray-300 text-sm leading-relaxed">{signalData?.explanation || '...'}</p>
                        </div>

                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Sentiment Pulse</h3>
                                {signalData && (
                                    <div className="flex items-center gap-2">
                                        <Gauge className={`w-5 h-5 ${signalData.sentiment.score > 60 ? 'text-emerald-500' : signalData.sentiment.score < 40 ? 'text-rose-500' : 'text-gray-400'}`} />
                                        <span className="font-mono text-lg font-medium">{signalData.sentiment.score}/100</span>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-3">
                                {signalData?.sentiment.headlines.slice(0, 3).map((news, i) => (
                                    <div key={i} className="flex gap-3 justify-between items-start text-[11px] border-b border-gray-800 pb-2 last:border-0 last:pb-0">
                                        <span className="text-gray-400 line-clamp-2 leading-tight flex-1">{news.text}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${news.sentiment === 'Bullish' ? 'bg-emerald-500/10 text-emerald-400' :
                                                news.sentiment === 'Bearish' ? 'bg-rose-500/10 text-rose-400' : 'bg-gray-800 text-gray-400'
                                            }`}>
                                            {news.sentiment}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
