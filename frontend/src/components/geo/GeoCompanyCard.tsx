import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  X, ExternalLink, MapPin, Building2, BarChart3, TrendingUp, 
  TrendingDown, Activity, Globe, Info, Newspaper, ArrowUpRight
} from 'lucide-react';

interface CompanyData {
    id: number;
    name: string;
    ticker: string;
    sector: string;
    city: string;
    state: string;
    description: string;
    stock?: {
        current_price: number;
        change_pct: number;
        market_cap: number;
        volume: number;
        is_up: boolean;
        color: string;
    };
    news?: { title: string; url: string; publisher: string }[];
}

interface Props {
    companyId: number;
    onClose: () => void;
}

const API = import.meta.env.VITE_API_URL || '';

const SECTOR_COLORS: Record<string, string> = {
    IT: '#8b5cf6', Banking: '#3b82f6', Pharma: '#ef4444', Auto: '#f59e0b',
    Energy: '#10b981', Metals: '#6b7280', FMCG: '#ec4899',
    Infrastructure: '#14b8a6', Consumer: '#f97316', Telecom: '#06b6d4'
};

const GeoCompanyCard: React.FC<Props> = ({ companyId, onClose }) => {
    const [data, setData] = useState<CompanyData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        axios
            .get(`${API}/api/geo/company/${companyId}`)
            .then((r) => setData(r.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));

        const iv = setInterval(() => {
            axios.get(`${API}/api/geo/company/${companyId}`).then((r) => setData(r.data));
        }, 45000);
        return () => clearInterval(iv);
    }, [companyId]);

    const isUp = data?.stock?.change_pct != null ? data.stock.change_pct >= 0 : true;

    return (
        <div
            className="neural-hud custom-scrollbar animate-in slide-in-from-right duration-700"
            style={{
                position: 'absolute',
                top: 70,
                right: 12,
                bottom: 12,
                zIndex: 1000,
                width: 340,
                background: 'rgba(6, 11, 20, 0.92)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20,
                overflowY: 'auto',
                boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
            }}
        >
            {/* Intel Header */}
            <div className="flex items-center justify-between p-4 pb-3 border-b border-dim bg-white/[0.02]">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                        <Globe size={12} className={loading ? "animate-spin" : ""} />
                    </div>
                    <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] font-mono">
                       Neural_Intel_Dossier
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-xl bg-white/5 border border-mid text-muted hover:text-white hover:bg-rose-500/10 transition-all"
                >
                    <X size={16} />
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-20 gap-4">
                    <Activity className="text-cyan-500/40 animate-pulse" size={40} />
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest">Accessing Node Data...</span>
                </div>
            ) : !data ? (
                <div className="p-20 text-center text-rose-500 font-black text-[10px] uppercase tracking-widest">
                    Fatal: Transmission Interrupted
                </div>
            ) : (
                <div className="p-6 space-y-8 pb-12">
                    {/* Primary Identifier */}
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-mid flex items-center justify-center shadow-inner overflow-hidden relative group">
                                <Building2 className="text-white/40 group-hover:scale-110 transition-transform" size={24} />
                                <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 to-transparent" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-display font-black text-white tracking-tighter uppercase leading-tight">
                                    {data.name}
                                </h3>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <span 
                                        className="text-[9px] font-black px-3 py-1 rounded-lg border uppercase tracking-widest"
                                        style={{ 
                                            color: SECTOR_COLORS[data.sector] || '#6b7280',
                                            borderColor: `${SECTOR_COLORS[data.sector] || '#6b7280'}30`,
                                            background: `${SECTOR_COLORS[data.sector] || '#6b7280'}10`
                                        }}
                                    >
                                        {data.sector}
                                    </span>
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-dim text-muted">
                                        <MapPin size={10} />
                                        <span className="text-[9px] font-bold uppercase">{data.city}, {data.state}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p className="text-[11px] text-secondary font-bold leading-relaxed uppercase tracking-tight italic opacity-80 border-l-2 border-mid pl-4 py-2 bg-white/[0.01]">
                            {data.description}
                        </p>
                    </div>

                    {/* Stock Telemetry */}
                    {data.stock && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-cyan-400/60">
                                <BarChart3 size={12} />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] font-mono">Real-Time Data Streams</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-void/50 border border-dim space-y-1.5 group hover:border-cyan-500/30 transition-all">
                                    <span className="text-[8px] font-black text-muted uppercase tracking-widest leading-none">Market_Val</span>
                                    <div className="text-lg font-display font-black text-white tracking-tighter">
                                        ₹{data.stock.current_price?.toLocaleString()}
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl bg-void/50 border border-dim space-y-1.5 group hover:border-cyan-500/30 transition-all">
                                    <span className="text-[8px] font-black text-muted uppercase tracking-widest leading-none">Net_Alpha</span>
                                    <div className={`text-lg font-display font-black tracking-tighter flex items-center gap-1.5 ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                        {Math.abs(data.stock.change_pct ?? 0).toFixed(2)}%
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-white/[0.02] border border-dim flex justify-between items-center px-6">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Gross_Volume</span>
                                    <span className="text-xs font-mono font-black text-secondary">{data.stock.volume?.toLocaleString()}</span>
                                </div>
                                <div className="h-8 w-px bg-border-dim" />
                                <div className="flex flex-col gap-1 text-right">
                                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Capitalization</span>
                                    <span className="text-xs font-mono font-black text-white">₹{(data.stock.market_cap / 1e7).toFixed(0)} Cr</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Neural News Feed */}
                    {data.news && data.news.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-indigo-400/60">
                                <Newspaper size={12} />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] font-mono">Global News Clusters</span>
                            </div>
                            <div className="space-y-3">
                                {data.news.map((item, i) => (
                                    <a
                                        key={i}
                                        href={item.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block p-4 rounded-2xl bg-white/[0.01] border border-dim hover:bg-white/[0.04] hover:border-indigo-500/20 transition-all group relative overflow-hidden"
                                    >
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="text-[11px] font-black text-secondary uppercase italic tracking-tight leading-relaxed group-hover:text-white transition-colors">
                                                {item.title}
                                            </div>
                                            <ArrowUpRight size={14} className="text-slate-700 group-hover:text-indigo-400 transition-colors shrink-0" />
                                        </div>
                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="text-[9px] font-black text-indigo-400/60 uppercase tracking-widest">{item.publisher}</span>
                                            <div className="w-8 h-0.5 bg-indigo-500/10 rounded-full group-hover:w-12 transition-all duration-500" />
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Protocol Links */}
                    <div className="pt-4">
                        <a
                            href={`https://www.nseindia.com/get-quotes/equity?symbol=${data.ticker?.replace('.NS', '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-3 w-full py-4 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-cyan-500/20 transition-all active:scale-[0.98] group"
                        >
                            External_Reference: NSE_India
                            <ExternalLink size={12} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GeoCompanyCard;
