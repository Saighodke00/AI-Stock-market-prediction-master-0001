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
        <div className="relative group overflow-hidden rounded-xl border border-white/5 shadow-2xl">
            {/* Scanline Effect Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] animate-pulse" />
            
            <div className="bg-void/80 backdrop-blur-sm border border-dim rounded-xl p-4 h-[400px] overflow-y-auto font-mono scrollbar-hide select-none transition-all relative z-10 flex flex-col-reverse">
                <div ref={logEndRef} className="h-px" />
                {logs.map((log, i) => {
                    const isAlert = log.level === 'ERROR' || log.level === 'WARNING';
                    const isSuccess = log.level === 'SUCCESS';
                    
                    return (
                        <div key={i} className="font-data text-[10px] mb-2 whitespace-pre-wrap flex gap-3 border-l-2 border-white/5 pl-3 hover:border-cyan/50 hover:bg-white/5 transition-all group/line animate-slide-in-right">
                            <span className="text-muted shrink-0 opacity-50 font-bold">[{log.timestamp}]</span>
                            <span className={`${isAlert ? 'text-rose glow-rose' : isSuccess ? 'text-emerald glow-emerald' : 'text-cyan'} tracking-tight`}>
                                {log.message}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
