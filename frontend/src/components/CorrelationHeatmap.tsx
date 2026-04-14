import React from 'react';
import { PortfolioCorrelationResponse } from '../api/api';

interface Props {
    data: PortfolioCorrelationResponse;
}

const CorrelationHeatmap: React.FC<Props> = ({ data }) => {
    const { correlation, risk } = data;
    const { matrix, tickers } = correlation;

    // Helper to get color based on correlation value
    // -1.0 (Dark Red) -> 0.0 (White) -> +1.0 (Dark Green)
    const getCellColor = (value: number) => {
        if (value === 1 && Math.abs(value) === 1) return 'bg-white/5'; // Actually handled by isDiagonal

        // Scaling logic for Tailwind-friendly or inline styles
        // Since Tailwind doesn't support arbitrary dynamic colors well without JIT or pre-defined classes,
        // we use inline styles for the background color background for precision.

        if (value > 0) {
            // White to Dark Green
            const green = Math.round(value * 255);
            const other = Math.round((1 - value) * 255);
            return `rgb(${other}, 255, ${other})`; // Simple heuristic
        } else {
            // White to Dark Red
            const absVal = Math.abs(value);
            const red = Math.round(absVal * 255);
            const other = Math.round((1 - absVal) * 255);
            return `rgb(255, ${other}, ${other})`;
        }
    };

    const getInterpretation = (val: number) => {
        if (val > 0.8) return "Strong Positive Correlation";
        if (val > 0.5) return "Moderate Positive Correlation";
        if (val > 0.2) return "Weak Positive Correlation";
        if (val > -0.2) return "Negligible Correlation";
        if (val > -0.5) return "Weak Negative Correlation";
        if (val > -0.8) return "Moderate Negative Correlation";
        return "Strong Negative Correlation";
    };

    return (
        <div className="flex flex-col space-y-6 w-full max-w-4xl mx-auto p-6 bg-base/50 backdrop-blur-xl rounded-2xl border border-dim shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white tracking-tight">Portfolio Correlation Heatmap</h2>
                <span className="text-xs text-secondary bg-white/5/50 px-2 py-1 rounded-full border border-mid">
                    Last updated: {new Date(correlation.computed_at).toLocaleTimeString()}
                </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-dim bg-void/20 p-4">
                <table className="min-w-full border-separate border-spacing-1">
                    <thead>
                        <tr>
                            <th className="p-2"></th>
                            {tickers.map(tkr => (
                                <th key={tkr} className="p-2 text-xs font-semibold text-secondary text-center uppercase tracking-wider">
                                    {tkr}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tickers.map((tkrRow, i) => (
                            <tr key={tkrRow}>
                                <td className="p-2 text-xs font-bold text-secondary text-right uppercase pr-4 border-r border-dim">
                                    {tkrRow}
                                </td>
                                {tickers.map((tkrCol, j) => {
                                    const val = matrix[tkrRow][tkrCol];
                                    const isDiagonal = i === j;

                                    return (
                                        <td
                                            key={`${tkrRow}-${tkrCol}`}
                                            className={`relative group p-0 w-16 h-16 rounded-md transition-all duration-300 hover:scale-105 hover:z-10 cursor-help shadow-sm overflow-hidden ${isDiagonal ? 'bg-white/5 border border-mid' : ''}`}
                                            style={!isDiagonal ? { backgroundColor: getCellColor(val) } : {}}
                                        >
                                            <div className={`flex items-center justify-center w-full h-full text-xs font-bold mix-blend-difference invert antialiased`}>
                                                {val.toFixed(2)}
                                            </div>

                                            {/* Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-base border border-mid rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                                                <p className="text-[10px] text-muted uppercase tracking-widest mb-1">Correlation Analysis</p>
                                                <p className="text-xs font-bold text-white mb-1">
                                                    {tkrRow} vs {tkrCol}
                                                </p>
                                                <div className="h-px bg-border-dim my-1 w-full" />
                                                <p className="text-[11px] text-secondary leading-tight">
                                                    Value: <span className="text-white font-mono">{val.toFixed(2)}</span>
                                                </p>
                                                <p className="text-[10px] text-emerald-400 font-medium mt-1 uppercase">
                                                    {getInterpretation(val)}
                                                </p>
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center space-x-4 py-2 opacity-80">
                <span className="text-[10px] text-rose-500 font-bold uppercase">-1.0 Negative</span>
                <div className="h-2 w-32 rounded-full bg-gradient-to-r from-rose-600 via-white to-emerald-600 shadow-inner" />
                <span className="text-[10px] text-emerald-500 font-bold uppercase">+1.0 Positive</span>
            </div>

            {/* Risk Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-5 rounded-xl border ${risk.concentration_risk === 'HIGH' ? 'bg-rose-500/10 border-rose-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                    <div className="flex items-center space-x-3 mb-3">
                        <div className={`w-3 h-3 rounded-full animate-pulse ${risk.concentration_risk === 'HIGH' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'}`} />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Concentration Risk: <span className={risk.concentration_risk === 'HIGH' ? 'text-rose-400' : 'text-emerald-400'}>{risk.concentration_risk}</span></h3>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-secondary">Avg Correlation</span>
                            <span className="text-white font-mono font-bold">{(risk.avg_correlation * 100).toFixed(1)}%</span>
                        </div>
                        {risk.most_correlated_pair && (
                            <div className="flex justify-between text-xs">
                                <span className="text-secondary">Most Correlated Pair</span>
                                <span className="text-white font-bold">{risk.most_correlated_pair[0]} & {risk.most_correlated_pair[1]}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-5 rounded-xl border border-mid bg-white/5/30 flex flex-col justify-center">
                    <p className="text-[10px] text-muted uppercase tracking-widest mb-1 font-bold">Portfolio Suggestion</p>
                    <p className="text-sm text-primary leading-relaxed italic">
                        "{risk.suggestion}"
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CorrelationHeatmap;
