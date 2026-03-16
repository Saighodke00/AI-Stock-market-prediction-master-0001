import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface WinLossPieProps {
    wins: number;
    losses: number;
}

export const WinLossPie: React.FC<WinLossPieProps> = ({ wins, losses }) => {
    const data = [
        { name: 'Wins', value: wins, color: '#10b981' },
        { name: 'Losses', value: losses, color: '#f43f5e' },
    ];

    return (
        <div className="h-56 w-full relative flex items-center justify-center">
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Efficiency</span>
                <span className="text-2xl font-display font-black text-white tracking-tighter">
                    {((wins / (wins + losses || 1)) * 100).toFixed(0)}%
                </span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        innerRadius={70}
                        outerRadius={90}
                        paddingAngle={10}
                        dataKey="value"
                        animationDuration={1500}
                        stroke="none"
                    >
                        {data.map((entry, index) => (
                            <Cell 
                                key={`cell-${index}`} 
                                fill={entry.color} 
                                className="filter hover:brightness-110 transition-all duration-300 cursor-pointer"
                            />
                        ))}
                    </Pie>
                    <Tooltip 
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-void/90 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl">
                                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: payload[0].payload.color }}>
                                            {payload[0].name}
                                        </p>
                                        <p className="text-white font-mono font-bold">{payload[0].value} Trades</p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};
