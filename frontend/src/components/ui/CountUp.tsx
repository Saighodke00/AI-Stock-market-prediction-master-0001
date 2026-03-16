import React, { useState, useEffect } from 'react';

export const CountUp: React.FC<{ end: number, duration?: number, suffix?: string, prefix?: string }> = ({ end, duration = 1500, suffix = '', prefix = '' }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            setCount(Math.floor(progress * end));
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }, [end, duration]);

    return <span>{prefix}{count.toLocaleString('en-IN')}{suffix}</span>;
};
