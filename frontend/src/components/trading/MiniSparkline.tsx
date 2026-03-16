import React from 'react';

interface MiniSparklineProps {
    data: number[];
    color?: string;
}

export const MiniSparkline: React.FC<MiniSparklineProps> = ({ data, color = 'stroke-cyan' }) => {
    if (!data || data.length < 2) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const width = 100;
    const height = 30;
    
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="w-full h-8 opacity-80 group-hover:opacity-100 transition-opacity">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                    className={color}
                />
            </svg>
        </div>
    );
};
