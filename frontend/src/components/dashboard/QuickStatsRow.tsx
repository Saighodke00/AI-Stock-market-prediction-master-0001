import React, { useEffect, useState } from 'react';
import { Target, TrendingUp, ShieldCheck, Zap } from 'lucide-react';
import { CountUp } from '../ui/CountUp';

export const QuickStatsRow: React.FC = () => {
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        const fetchStats = () => {
            fetch('/api/dashboard-stats')
                .then(res => res.json())
                .then(setStats)
                .catch(err => console.error("Stats fetch error:", err));
        };

        fetchStats();
        const interval = setInterval(fetchStats, 60000);
        return () => clearInterval(interval);
    }, []);

    if (!stats || !stats.top_signal) return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-surface/50 animate-pulse rounded-xl flex items-center justify-center text-[10px] text-secondary tracking-widest uppercase">Fetching Stats...</div>)}
        </div>
    );

    const cards = [
        { label: "Today's BUY Signals", value: stats.today_buys, suffix: '', icon: <Zap size={18} className="text-emerald" />, color: "text-emerald" },
        { label: "Today's SELL Signals", value: stats.today_sells, suffix: '', icon: <TrendingUp size={18} className="text-rose" />, color: "text-rose" },
        { label: "Avg Confidence", value: stats.avg_confidence, suffix: '%', icon: <Target size={18} className="text-cyan" />, color: "text-cyan" },
        { label: "Best Signal", value: stats.top_signal.conf, suffix: '%', prefix: `${stats.top_signal.ticker} `, icon: <ShieldCheck size={18} className="text-gold" />, color: "text-gold" },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-6">
            {cards.map((card, i) => (
                <div key={i} className="bg-surface border border-dim rounded-xl p-5 group hover:border-white/20 transition-all hover:shadow-2xl">
                    <div className="flex justify-between items-start mb-2">
                        <div className={`p-2 bg-void/50 rounded-lg border border-white/5`}>
                            {card.icon}
                        </div>
                        <span className="font-data text-[10px] text-secondary tracking-widest uppercase">{card.label}</span>
                    </div>
                    <div className={`font-display text-2xl font-black ${card.color}`}>
                        {typeof card.value === 'number' ? (
                            <CountUp end={card.value} suffix={card.suffix} prefix={card.prefix} />
                        ) : (
                            card.value
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
