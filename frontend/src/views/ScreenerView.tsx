import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    TrendingUp, TrendingDown, Minus, ArrowUpRight,
    ArrowDownRight, Loader2, Search, Filter
} from 'lucide-react';
import { APIResponse, ScreenerResponse } from '../types';

export default function ScreenerView() {
    const [data, setData] = useState<APIResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchScreener = async () => {
            setLoading(true);
            try {
                const response = await axios.get<ScreenerResponse>('/api/screener');
                setData(response.data.results);
            } catch (err) {
                console.error("Screener fetch failed", err);
            } finally {
                setLoading(false);
            }
        };
        fetchScreener();
    }, []);

    const filteredData = data.filter(item =>
        item.ticker.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Market Screener</h2>
                    <p className="text-gray-400 text-sm">Real-time AI signals across key market tickers</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Filter tickers..."
                            className="bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button className="p-2 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors">
                        <Filter className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                            <th className="px-6 py-4 font-semibold">Asset</th>
                            <th className="px-6 py-4 font-semibold text-right">Price</th>
                            <th className="px-6 py-4 font-semibold text-right">Change</th>
                            <th className="px-6 py-4 font-semibold text-center">Signal</th>
                            <th className="px-6 py-4 font-semibold text-right">Confidence</th>
                            <th className="px-6 py-4 font-semibold">AI Logic Summary</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {loading ? (
                            Array(5).fill(0).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td className="px-6 py-4"><div className="h-4 w-12 bg-gray-800 rounded" /></td>
                                    <td className="px-6 py-4"><div className="h-4 w-16 bg-gray-800 rounded ml-auto" /></td>
                                    <td className="px-6 py-4"><div className="h-4 w-12 bg-gray-800 rounded ml-auto" /></td>
                                    <td className="px-6 py-4"><div className="h-6 w-16 bg-gray-800 rounded-full mx-auto" /></td>
                                    <td className="px-6 py-4"><div className="h-4 w-10 bg-gray-800 rounded ml-auto" /></td>
                                    <td className="px-6 py-4"><div className="h-4 w-48 bg-gray-800 rounded" /></td>
                                </tr>
                            ))
                        ) : filteredData.map((item) => (
                            <tr key={item.ticker} className="hover:bg-gray-800/30 transition-colors cursor-pointer group">
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-white font-bold group-hover:text-indigo-400 transition-colors">{item.ticker}</span>
                                        <span className={`text-[10px] font-bold uppercase tracking-tighter ${item.regime === 'Bull' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {item.regime} Regime
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-gray-300">
                                    ${item.current_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className={`px-6 py-4 text-right font-medium ${item.pct_change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    <div className="flex items-center justify-end gap-1">
                                        {item.pct_change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {item.pct_change.toFixed(2)}%
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${item.signal === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                                            item.signal === 'SELL' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                                                'bg-gray-500/10 text-gray-400 border-gray-500/30'
                                        }`}>
                                        {item.signal}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex flex-col items-end">
                                        <span className="text-white font-mono">{(item.confidence * 100).toFixed(0)}%</span>
                                        <div className="w-16 h-1 bg-gray-800 rounded-full mt-1 overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-500 rounded-full"
                                                style={{ width: `${item.confidence * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 max-w-xs">
                                    <p className="text-gray-400 text-xs truncate italic" title={item.explanation}>
                                        {item.explanation}
                                    </p>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!loading && filteredData.length === 0 && (
                    <div className="p-12 text-center text-gray-500">
                        No results found for "{searchTerm}"
                    </div>
                )}
            </div>
        </div>
    );
}
