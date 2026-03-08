import React, { useState, useEffect } from 'react';
import { fetchScreener, ScreenerRow } from '../api/api';
import { NeuralSpinner } from '../components/ui/LoadingStates';
import { Filter, ArrowUpDown } from 'lucide-react';

const SECTORS = ['All', 'IT', 'Banking', 'Auto', 'Energy', 'FMCG', 'Metals', 'Pharma'];

export const ScreenerPage: React.FC = () => {
    const [data, setData] = useState<ScreenerRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [sectorFilter, setSectorFilter] = useState('All');
    const [sortCol, setSortCol] = useState<keyof ScreenerRow>('confidence');
    const [sortDesc, setSortDesc] = useState(true);

    useEffect(() => {
        fetchScreener()
            .then(res => setData(res))
            .catch(err => {
                console.error(err);
                // Fallback mock data if API unavailable
                setData([
                    { ticker: 'RELIANCE.NS', sector: 'Energy', action: 'BUY', confidence: 0.88, expected_return: 2.1, current_price: 2987.5, price_change_pct: 1.2, p10: 2900, p50: 3050, p90: 3100, sentiment_score: 0.4, gate_results: { gate1_attention: true, gate2_cone: true, gate3_sentiment: true, gate4_pattern: true }, explanation: '', patterns: [] },
                    { ticker: 'TCS.NS', sector: 'IT', action: 'BUY', confidence: 0.92, expected_return: 3.4, current_price: 4102.0, price_change_pct: 2.4, p10: 4000, p50: 4240, p90: 4300, sentiment_score: 0.8, gate_results: { gate1_attention: true, gate2_cone: true, gate3_sentiment: true, gate4_pattern: true }, explanation: '', patterns: [] },
                    { ticker: 'HDFCBANK.NS', sector: 'Banking', action: 'HOLD', confidence: 0.45, expected_return: 0.5, current_price: 1452.9, price_change_pct: 0.1, p10: 1400, p50: 1460, p90: 1500, sentiment_score: -0.1, gate_results: { gate1_attention: true, gate2_cone: false, gate3_sentiment: false, gate4_pattern: true }, explanation: '', patterns: [] },
                    { ticker: 'INFY.NS', sector: 'IT', action: 'SELL', confidence: 0.76, expected_return: -1.8, current_price: 1643.2, price_change_pct: -0.8, p10: 1550, p50: 1610, p90: 1680, sentiment_score: -0.6, gate_results: { gate1_attention: true, gate2_cone: true, gate3_sentiment: true, gate4_pattern: false }, explanation: '', patterns: [] },
                    { ticker: 'MARUTI.NS', sector: 'Auto', action: 'SELL', confidence: 0.82, expected_return: -2.3, current_price: 11450.0, price_change_pct: -1.4, p10: 10800, p50: 11180, p90: 11600, sentiment_score: -0.4, gate_results: { gate1_attention: true, gate2_cone: true, gate3_sentiment: true, gate4_pattern: true }, explanation: '', patterns: [] },
                ]);
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSort = (col: keyof ScreenerRow) => {
        if (sortCol === col) setSortDesc(!sortDesc);
        else {
            setSortCol(col);
            setSortDesc(true);
        }
    };

    const filteredData = data
        .filter(row => sectorFilter === 'All' || row.sector === sectorFilter)
        .sort((a, b) => {
            const valA = a[sortCol];
            const valB = b[sortCol];
            if (valA < valB) return sortDesc ? 1 : -1;
            if (valA > valB) return sortDesc ? -1 : 1;
            return 0;
        });

    if (loading) return <NeuralSpinner />;

    return (
        <div className="flex flex-col h-full bg-base overflow-y-auto p-6 animate-page-in min-w-[320px]">
            {/* Header & Filters */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="font-display font-medium text-primary text-xl tracking-wider">MARKET SCREENER</h2>

                <div className="flex items-center gap-3 bg-surface border border-dim rounded px-3 py-1.5 shadow-md">
                    <Filter size={16} className="text-cyan" />
                    <span className="font-body text-xs text-secondary uppercase tracking-widest">Sector:</span>
                    <select
                        value={sectorFilter}
                        onChange={(e) => setSectorFilter(e.target.value)}
                        className="bg-transparent border-none text-primary font-body text-sm outline-none cursor-pointer"
                    >
                        {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-surface border border-dim rounded-xl overflow-hidden shadow-lg w-full">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-void border-b border-dim font-display text-xs text-secondary tracking-widest">
                                <th className="p-4 font-medium whitespace-nowrap cursor-pointer hover:text-cyan transition-colors" onClick={() => handleSort('ticker')}>
                                    <div className="flex items-center gap-1">TICKER <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="p-4 font-medium whitespace-nowrap cursor-pointer hover:text-cyan transition-colors" onClick={() => handleSort('sector')}>
                                    <div className="flex items-center gap-1">SECTOR <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="p-4 font-medium whitespace-nowrap cursor-pointer hover:text-cyan transition-colors" onClick={() => handleSort('action')}>
                                    <div className="flex items-center gap-1">SIGNAL <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="p-4 font-medium whitespace-nowrap cursor-pointer hover:text-cyan transition-colors" onClick={() => handleSort('confidence')}>
                                    <div className="flex items-center gap-1">CONFIDENCE <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="p-4 font-medium whitespace-nowrap cursor-pointer hover:text-cyan transition-colors" onClick={() => handleSort('current_price')}>
                                    <div className="flex items-center gap-1">PRICE <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="p-4 font-medium whitespace-nowrap cursor-pointer hover:text-cyan transition-colors" onClick={() => handleSort('expected_return')}>
                                    <div className="flex items-center gap-1">TARGET RETURN <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="p-4 font-medium whitespace-nowrap">GATES ALIGNED</th>
                            </tr>
                        </thead>
                        <tbody className="font-data text-sm">
                            {filteredData.map((row) => {
                                const isBuy = row.action === 'BUY';
                                const isSell = row.action === 'SELL';
                                const actionColor = isBuy ? 'text-green' : isSell ? 'text-red' : 'text-gold';
                                const actionBadge = isBuy ? 'bg-green-dim border border-green/30' : isSell ? 'bg-red-dim border border-red/30' : 'bg-gold-dim border border-gold/30';

                                // Count passed gates
                                const gatesPassed = Object.values(row?.gate_results || {}).filter(Boolean).length;
                                const gateFraction = `${gatesPassed}/4`;

                                return (
                                    <tr key={row.ticker} className="border-b border-dim/50 hover:bg-raised transition-colors group cursor-default">
                                        <td className="p-4 font-display font-medium text-cyan group-hover:glow-cyan">
                                            {row.ticker}
                                        </td>
                                        <td className="p-4 text-secondary font-body">{row.sector}</td>
                                        <td className="p-4">
                                            <div className={`inline-block px-2 py-0.5 rounded ${actionBadge} ${actionColor} font-bold text-xs tracking-wider`}>
                                                {row.action}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <span className="w-10 text-right">{Math.round(row.confidence * 100)}%</span>
                                                <div className="w-16 h-1.5 bg-void rounded-full overflow-hidden border border-dim">
                                                    <div className={`h-full ${actionColor.replace('text-', 'bg-')}`} style={{ width: `${row.confidence * 100}%` }} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-primary">₹{(row?.current_price ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        <td className={`p-4 ${(row?.expected_return ?? 0) > 0 ? 'text-green' : (row?.expected_return ?? 0) < 0 ? 'text-red' : 'text-gold'}`}>
                                            {(row?.expected_return ?? 0) > 0 ? '+' : ''}{(row?.expected_return ?? 0).toFixed(2)}%
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-1">
                                                <div className={`w-3 h-3 rounded-sm ${row?.gate_results?.gate1_attention ? 'bg-green glow-green' : 'bg-void border border-dim'}`} />
                                                <div className={`w-3 h-3 rounded-sm ${row?.gate_results?.gate2_cone ? 'bg-green glow-green' : 'bg-void border border-dim'}`} />
                                                <div className={`w-3 h-3 rounded-sm ${row?.gate_results?.gate3_sentiment ? 'bg-green glow-green' : 'bg-void border border-dim'}`} />
                                                <div className={`w-3 h-3 rounded-sm ${row?.gate_results?.gate4_pattern ? 'bg-green glow-green' : 'bg-void border border-dim'}`} />
                                                <span className="text-[10px] text-muted ml-2 font-body">{gateFraction}</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-secondary font-body italic">
                                        No signals found matching criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
