import React, { useState, useEffect } from 'react';

export const NeuralSpinner: React.FC = () => {
    const [dots, setDots] = useState('.');

    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '.' : prev + '.');
        }, 500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-full w-full min-h-[200px] gap-6">
            <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-2 border-t-cyan border-r-transparent border-b-dim border-l-transparent rounded-full animate-[spin_1s_linear_infinite]" />
                <div className="absolute inset-2 border-2 border-b-cyan border-l-transparent border-t-dim border-r-transparent rounded-full animate-[spin_1.5s_linear_infinite_reverse]" />
                <div className="absolute inset-4 border-2 border-dotted border-cyan rounded-full animate-[spin_3s_linear_infinite]" />
            </div>
            <div className="font-data text-cyan tracking-widest text-xs">
                NEURAL ENGINE CALIBRATING{dots}
            </div>
        </div>
    );
};

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => {
    return (
        <div className={`shimmer rounded-lg border border-dim ${className}`} />
    );
};

export const SkeletonRow: React.FC<{ className?: string }> = ({ className = '' }) => {
    return (
        <div className={`h-10 w-full shimmer rounded border border-dim ${className}`} />
    );
};

export const ProgressBar: React.FC<{ progress: number, text: string }> = ({ progress, text }) => {
    return (
        <div className="flex flex-col gap-2 w-full max-w-sm">
            <div className="flex justify-between items-center px-1">
                <span className="font-body text-secondary text-sm">{text}</span>
                <span className="font-data text-cyan text-xs">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full bg-raised rounded-full overflow-hidden border border-dim">
                <div
                    className="h-full bg-cyan transition-all duration-300 ease-out shadow-glow-cyan"
                    style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                />
            </div>
        </div>
    );
};
