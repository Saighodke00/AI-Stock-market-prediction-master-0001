import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface EquityCurveProps {
    data: { date: string; value: number }[];
}

export const EquityCurveChart: React.FC<EquityCurveProps> = ({ data }) => {
    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="10 10" stroke="#ffffff03" vertical={false} />
                    <XAxis 
                        dataKey="date" 
                        hide 
                    />
                    <YAxis 
                        domain={['auto', 'auto']} 
                        tick={{ fill: '#475569', fontSize: 9, fontWeight: 'bold' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-void/90 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{payload[0].payload.date}</p>
                                        <p className="text-white font-mono font-bold">₹{(payload[0].value as number)?.toLocaleString("en-IN")}</p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#6366f1" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#equityGradient)" 
                        animationDuration={2000}
                        strokeLinecap="round"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
