import React, { useState } from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';

interface ChartDataPoint {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    sma20?: number;
    sma50?: number;
    p10?: number;
    p50?: number;
    p90?: number;
    isForecast?: boolean;
}

interface ForecastChartProps {
    data: ChartDataPoint[];
    patterns?: any[];
    isLoading?: boolean;
}

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'];

export const ForecastChart: React.FC<ForecastChartProps> = ({ data, patterns, isLoading }) => {
    const [activeTf, setActiveTf] = useState('1D');

    if (isLoading || !data || data.length === 0) {
        return (
            <div className="w-full h-[400px] md:h-[500px] bg-surface rounded-xl border border-dim flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute inset-0 shimmer opacity-[0.03]" />
                <div className="font-data text-cyan tracking-widest text-sm animate-pulse z-10 w-full text-center">
                    SYNCING NEURAL TIME-SERIES...
                </div>
            </div>
        );
    }

    // Find min/max for Y-axis domain
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    data.forEach(d => {
        const minVal = Math.min(d.low ?? Infinity, d.p10 ?? Infinity);
        const maxVal = Math.max(d.high ?? -Infinity, d.p90 ?? -Infinity);
        if (minVal < minPrice) minPrice = minVal;
        if (maxVal > maxPrice) maxPrice = maxVal;
    });

    // Add 2% padding
    const yDomain = [minPrice * 0.98, maxPrice * 1.02];

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const point = payload[0].payload as ChartDataPoint;
            return (
                <div className="bg-overlay/90 backdrop-blur-sm border border-dim p-3 rounded shadow-xl min-w-[150px]">
                    <p className="font-data text-[10px] text-muted tracking-widest border-b border-dim/50 pb-2 mb-2">{point.date}</p>
                    {!point.isForecast ? (
                        <div className="flex flex-col gap-1 font-data text-xs">
                            <div className="flex justify-between"><span className="text-secondary">O:</span><span className="text-primary">{(point.open ?? 0).toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-secondary">H:</span><span className="text-primary">{(point.high ?? 0).toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-secondary">L:</span><span className="text-primary">{(point.low ?? 0).toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-secondary">C:</span><span className={(point.close ?? 0) >= (point.open ?? 0) ? 'text-green' : 'text-red'}>{(point.close ?? 0).toFixed(2)}</span></div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1 font-data text-xs">
                            <div className="flex justify-between"><span className="text-red">P10 (Bear):</span><span className="text-primary">{(point.p10 ?? 0).toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-green">P50 (Target):</span><span className="text-primary font-bold">{(point.p50 ?? 0).toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-cyan">P90 (Bull):</span><span className="text-primary">{(point.p90 ?? 0).toFixed(2)}</span></div>
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full bg-surface rounded-xl border border-dim flex flex-col min-h-[420px] h-[500px]">
            {/* Chart Header */}
            <div className="flex items-center justify-between p-4 border-b border-dim shrink-0">
                <h3 className="font-display font-medium text-primary text-sm tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan glow-cyan" /> TERMINAL VIEW
                </h3>
                <div className="flex items-center gap-1 bg-void p-1 rounded border border-dim">
                    {TIMEFRAMES.map(tf => (
                        <button
                            key={tf}
                            onClick={() => setActiveTf(tf)}
                            className={`px-3 py-1 font-display text-[11px] rounded transition-colors ${activeTf === tf
                                ? 'bg-cyan text-void font-bold shadow-glow-cyan'
                                : 'bg-transparent text-secondary hover:text-primary'
                                }`}
                        >
                            {tf}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart Body */}
            <div className="flex-1 p-4 relative pt-6">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-dim)" opacity={0.5} vertical={false} />
                        <XAxis
                            dataKey="date"
                            tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'Share Tech Mono' }}
                            tickLine={false}
                            axisLine={{ stroke: 'var(--border-dim)' }}
                            minTickGap={30}
                        />
                        <YAxis
                            domain={yDomain}
                            tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'Share Tech Mono' }}
                            tickLine={false}
                            axisLine={{ stroke: 'var(--border-dim)' }}
                            tickFormatter={(v) => (v ?? 0).toFixed(0)}
                            orientation="right"
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--cyan)', strokeWidth: 1, opacity: 0.4 }} />

                        {/* Historical Price (Line approximation since Recharts doesn't have native Candlestick) */}
                        <Line type="monotone" dataKey="close" stroke="var(--text-primary)" strokeWidth={1.5} dot={false} activeDot={{ r: 4, fill: 'var(--cyan)' }} />

                        {/* SMAs */}
                        <Line type="monotone" dataKey="sma20" stroke="var(--cyan)" strokeWidth={1} strokeDasharray="4 4" dot={false} opacity={0.7} />
                        <Line type="monotone" dataKey="sma50" stroke="var(--violet)" strokeWidth={1} strokeDasharray="4 4" dot={false} opacity={0.7} />

                        {/* Forecast Cone */}
                        <Area type="monotone" dataKey="p90" stroke="none" fill="var(--green)" fillOpacity={0.06} connectNulls />
                        <Area type="monotone" dataKey="p10" stroke="none" fill="var(--bg-surface)" fillOpacity={1} connectNulls /> {/* Mask out bottom */}

                        <ReferenceLine
                            x={data.find(d => d.isForecast)?.date}
                            stroke="var(--cyan)"
                            strokeDasharray="5 5"
                            label={{ value: 'TODAY', position: 'top', fill: 'var(--cyan)', fontSize: 10, fontFamily: 'Share Tech Mono' }}
                        />

                        <Line type="monotone" dataKey="p50" stroke="var(--green)" strokeWidth={2} dot={false} strokeDasharray="5 5" connectNulls />
                        <Line type="monotone" dataKey="p90" stroke="var(--cyan)" strokeWidth={1} strokeDasharray="3 3" dot={false} opacity={0.5} connectNulls />
                        <Line type="monotone" dataKey="p10" stroke="var(--red)" strokeWidth={1} strokeDasharray="3 3" dot={false} opacity={0.5} connectNulls />

                        {/* Pattern Targets */}
                        {patterns?.map((p, idx) => p.target && (
                            <ReferenceLine
                                key={`target-${idx}`}
                                y={p.target}
                                stroke={p.type === 'Bullish' ? 'var(--green)' : (p.type === 'Bearish' ? 'var(--red)' : 'var(--cyan)')}
                                strokeDasharray="3 3"
                                opacity={0.4}
                                label={{ 
                                    value: `${p.name} Target`, 
                                    position: 'right', 
                                    fill: p.type === 'Bullish' ? 'var(--green)' : (p.type === 'Bearish' ? 'var(--red)' : 'var(--cyan)'),
                                    fontSize: 8,
                                    fontFamily: 'Share Tech Mono'
                                }}
                            />
                        ))}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
