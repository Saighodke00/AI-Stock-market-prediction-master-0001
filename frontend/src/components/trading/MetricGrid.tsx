import React, { useEffect, useState } from 'react';

interface Metric {
    label: string;
    value: number;
    format?: 'percent' | 'decimal' | 'currency' | 'raw';
    delta?: number;
    inverseColors?: boolean; // if lower is better
}

interface MetricGridProps {
    metrics: Metric[];
}

const AnimatedNumber: React.FC<{ value: number, format?: string }> = ({ value, format = 'raw' }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        let start = 0;
        const duration = 1200; // ms
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // easeOutExpo
            const easing = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

            setDisplayValue(start + (value - start) * easing);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setDisplayValue(value);
            }
        };

        requestAnimationFrame(animate);
    }, [value]);

    if (isNaN(value)) return <span className="text-slate-600">——</span>;

    let formatted = '';
    if (format === 'percent') formatted = (displayValue ?? 0).toFixed(1) + '%';
    else if (format === 'decimal') formatted = (displayValue ?? 0).toFixed(2);
    else if (format === 'currency') formatted = '₹' + (displayValue ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    else formatted = Math.round(displayValue ?? 0).toString();

    return <span>{formatted}</span>;
}

export const MetricGrid: React.FC<MetricGridProps> = ({ metrics }) => {
    return (
        <div className="grid grid-cols-2 gap-3">
            {metrics.map((metric, i) => {
                const isPositiveValue = metric.value > 0;
                let valColor = 'text-indigo-400';
                if (metric.format === 'percent' || metric.delta !== undefined) {
                    const positiveObj = metric.inverseColors ? !isPositiveValue : isPositiveValue;
                    const isNeutral = metric.value === 0;
                    valColor = isNeutral ? 'text-slate-300' : positiveObj ? 'text-emerald-400' : 'text-rose-400';
                }

                return (
                    <div key={i} className="glass-card hover:border-white/10 hover:bg-white/[0.04] p-4 group transition-all duration-300">
                        <div className="text-[9px] font-bold text-slate-500 tracking-[0.2em] uppercase mb-1.5 whitespace-pre-wrap leading-tight h-[28px] flex items-end font-body">
                            {metric.label === 'Accuracy' ? 'Forecast ACU' : metric.label}
                        </div>

                        <div className={`font-display font-bold text-2xl tracking-tighter ${valColor}`}>
                            <AnimatedNumber value={metric.value} format={metric.format} />
                        </div>

                        {metric.delta !== undefined && (
                            <div className={`font-mono text-[10px] mt-2 font-bold flex items-center gap-1.5 ${metric.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                <div className={`w-1 h-1 rounded-full ${metric.delta >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                {metric.delta >= 0 ? '+' : ''}{metric.delta.toFixed(1)}%
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
