import React from 'react';
import { Activity } from 'lucide-react';

export const UnderConstructionPage: React.FC<{ title: string }> = ({ title }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full w-full p-6 animate-page-in">
            <div className="flex flex-col items-center gap-6 max-w-lg text-center bg-surface border border-dim rounded-xl p-12 shadow-2xl relative overflow-hidden">

                <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />

                <div className="p-6 bg-void rounded-full text-cyan border border-dim relative z-10 shadow-glow-cyan">
                    <Activity size={48} className="animate-pulse" />
                </div>

                <div className="relative z-10">
                    <h2 className="font-display font-medium text-primary text-2xl tracking-widest mb-2">
                        {title.toUpperCase()}
                    </h2>
                    <div className="font-data text-cyan tracking-[0.3em] text-sm animate-pulse mb-6">
            // NEURAL CALIBRATION IN PROGRESS
                    </div>
                    <p className="font-body text-secondary leading-relaxed">
                        This module is currently offline for architectural upgrades. The sub-system is being integrated with the new React rendering engine.
                    </p>
                </div>

            </div>
        </div>
    );
};
