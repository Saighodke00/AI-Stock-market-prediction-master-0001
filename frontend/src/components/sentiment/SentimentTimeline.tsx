import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, CartesianGrid, ReferenceLine 
} from 'recharts';

interface HistoryPoint {
  date: string;
  score: number;
}

interface SentimentTimelineProps {
  data: HistoryPoint[];
  isLoading?: boolean;
}

export const SentimentTimeline: React.FC<SentimentTimelineProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return <div className="h-64 bg-white/5 animate-pulse rounded-xl border border-white/5" />;
  }

  // Split data for gradient thresholds if needed, but simple area with a reference line is more terminal-accurate
  return (
    <div className="w-full h-72 bg-[#020409] border border-cyan/10 rounded-xl p-4 relative overflow-hidden group">
      <div className="flex justify-between items-center mb-6 z-10 relative">
        <h4 className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">Historical Sentiment Pulse</h4>
        <div className="flex gap-2">
           {['7D', '30D', '90D'].map(t => (
             <button key={t} className={`px-2 py-0.5 rounded text-[9px] font-bold border ${t === '7D' ? 'bg-cyan text-void border-cyan' : 'border-white/10 text-slate-500 hover:border-white/20'}`}>
               {t}
             </button>
           ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height="80%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#00e5ff" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#4a6080', fontSize: 9, fontWeight: 'bold' }} 
            interval="preserveStartEnd"
          />
          <YAxis 
            domain={[-1, 1]} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#4a6080', fontSize: 9, fontWeight: 'bold' }} 
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0a0f1d', border: '1px solid #1a3050', borderRadius: '8px', fontSize: '11px', color: '#fff' }} 
            itemStyle={{ color: '#00e5ff' }}
            cursor={{ stroke: 'rgba(0, 229, 255, 0.2)', strokeWidth: 2 }}
          />
          <ReferenceLine y={0} stroke="#1a3050" strokeWidth={1} />
          <Area 
            type="monotone" 
            dataKey="score" 
            stroke="#00e5ff" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorSent)" 
            isAnimationActive={true}
            animationDuration={2000}
            dot={{ r: 3, fill: '#00e5ff', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#fff', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
