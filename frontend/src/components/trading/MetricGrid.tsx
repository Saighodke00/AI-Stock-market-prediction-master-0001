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

    let formatted = '';
    if (format === 'percent') formatted = (displayValue ?? 0).toFixed(1) + '%';
    else if (format === 'decimal') formatted = (displayValue ?? 0).toFixed(2);
    else if (format === 'currency') formatted = '₹' + (displayValue ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    else formatted = Math.round(displayValue ?? 0).toString();

    return <span>{formatted}</span>;
}

export const MetricGrid: React.FC<MetricGridProps> = ({ metrics }) => {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {metrics.map((metric, i) => {
                const isPositiveValue = metric.value > 0;
                let valColor = 'text-cyan';
                if (metric.format === 'percent' || metric.delta !== undefined) {
                    const positiveObj = metric.inverseColors ? !isPositiveValue : isPositiveValue;
                    const isNeutral = metric.value === 0;
                    valColor = isNeutral ? 'text-primary' : positiveObj ? 'text-green' : 'text-red';
                }

                return (
                    <div key={i} className="bg-surface border border-dim rounded-lg p-3 hover:border-bright hover:-translate-y-0.5 transition-all outline-none">
                        <div className="font-body text-[9px] text-muted tracking-[0.2em] uppercase mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
                            {metric.label}
                        </div>

                        <div className={`font-display font-bold text-xl py-0.5 ${valColor}`}>
                            <AnimatedNumber value={metric.value} format={metric.format} />
                        </div>

                        {metric.delta !== undefined && (
                            <div className={`font-data text-[10px] mt-1 ${metric.delta >= 0 ? 'text-green' : 'text-red'}`}>
                                {metric.delta >= 0 ? '▲ +' : '▼ '}{metric.delta.toFixed(1)}%
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
