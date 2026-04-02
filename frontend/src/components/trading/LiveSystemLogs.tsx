import React, { useState, useEffect, useRef } from 'react';

interface LogEntry {
    timestamp: string;
    message: string;
    level: string;
}

export const LiveSystemLogs: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const logEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchLogs = () => {
            fetch('/api/dashboard/logs')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setLogs(data);
                    }
                })
                .catch(err => console.error("Logs fetch error:", err));
        };

        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="relative group overflow-hidden rounded-3xl neon-frame">
            {/* Scanline Effect Overlay - slightly more intense */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.05] z-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%),linear-gradient(90deg,rgba(0,210,255,0.06),rgba(16,185,129,0.02),rgba(244,63,94,0.06))] bg-[length:100%_2px,3px_100%]" />
            
            <div className="bg-void/40 backdrop-blur-xl p-5 h-[420px] overflow-y-auto scrollbar-hide select-none transition-all relative z-10 flex flex-col-reverse">
                <div ref={logEndRef} className="h-px" />
                {logs.slice(0, 50).map((log, i) => {
                    const isAlert = log.level === 'ERROR' || log.level === 'WARNING';
                    const isSuccess = log.level === 'SUCCESS';
                    
                    return (
                        <div key={i} className="font-data text-[9px] mb-2.5 whitespace-pre-wrap flex gap-4 border-l border-white/5 pl-4 hover:border-cyan/40 hover:bg-white/[0.02] transition-all group/line animate-slide-in-right py-0.5">
                            <span className="text-slate-600 shrink-0 font-bold tracking-tighter">[{log.timestamp}]</span>
                            <span className={`${isAlert ? 'text-rose glow-rose' : isSuccess ? 'text-emerald glow-emerald' : 'text-cyan'} tracking-wide leading-relaxed`}>
                                {log.message}
                            </span>
                        </div>
                    );
                })}
            </div>
            
            {/* Bottom Glow */}
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-void to-transparent z-20 pointer-events-none" />
        </div>
    );

};
