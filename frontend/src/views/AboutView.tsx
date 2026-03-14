import React from 'react';
import { Github, Linkedin, Twitter, Award, Code2, Database } from 'lucide-react';

const TEAM = [
    {
        name: 'Sai Narendra Ghodke',
        role: 'Lead AI Architect & Developer',
        initials: 'SG',
        gradient: 'from-indigo-500 to-violet-600',
        shadow: 'shadow-indigo-500/30',
        ring: 'ring-indigo-500/40',
        bio: 'Architected the full TFT pipeline, multi-modal feature engineering, and signal gate system. Expert in PyTorch Forecasting, Keras ensembles, and quantile regression.',
        skills: ['TFT / Transformer', 'PyTorch Lightning', 'Quantile Forecasting', 'Signal Gating'],
        icon: Code2,
        links: { github: '#', linkedin: '#', twitter: '#' },
    },
    {
        name: 'Siddhartha Vijay Bhosale',
        role: 'Data Scientist & Quantitative Analyst',
        initials: 'SB',
        gradient: 'from-emerald-500 to-teal-600',
        shadow: 'shadow-emerald-500/30',
        ring: 'ring-emerald-500/40',
        bio: 'Designed the fractional differentiation, wavelet denoising pipeline, and backtesting engine. Specialist in statistical arbitrage and walk-forward model validation.',
        skills: ['Fractal Diff.', 'Wavelet DWT', 'Backtesting', 'Monte Carlo'],
        icon: Database,
        links: { github: '#', linkedin: '#', twitter: '#' },
    },
    {
        name: 'Sunraj Shetty',
        role: 'Frontend Engineer & UI/UX Specialist',
        initials: 'SS',
        gradient: 'from-rose-500 to-pink-600',
        shadow: 'shadow-rose-500/30',
        ring: 'ring-rose-500/40',
        bio: 'Built the full React + TypeScript dashboard with TradingView charts, glassmorphism design system, and FastAPI integration. Expert in data visualization and UX.',
        skills: ['React / TypeScript', 'Recharts / TradingView', 'Glassmorphism UI', 'FastAPI Integration'],
        icon: Award,
        links: { github: '#', linkedin: '#', twitter: '#' },
    },
];

const STACK = [
    { cat: 'Deep Learning', items: ['TFT · Temporal Fusion Transformer', 'GRU + TCN Ensemble', 'LightGBM', 'Quantile Loss (P10/P50/P90)'] },
    { cat: 'NLP & Sentiment', items: ['ProsusAI/FinBERT', 'HuggingFace Transformers', 'Redis Caching (4h TTL)', 'yfinance News Scraping'] },
    { cat: 'Data Pipeline', items: ['Fractional Differentiation', 'Wavelet DWT Denoising', 'OHLCV + VIX + Macro', 'RobustScaler'] },
    { cat: 'Infrastructure', items: ['FastAPI + Uvicorn', 'Celery + Redis', 'Docker', 'Streamlit (V1)'] },
];

export default function AboutView() {
    return (
        <div className="p-8 max-w-[1400px] mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* Hero */}
            <div className="glass-card p-12 border border-white/5 relative overflow-hidden group shadow-2xl">
                {/* Background accent */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-1000" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-violet-500/20 transition-all duration-1000" />

                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 group-hover:scale-110 transition-transform duration-500">
                            <Award className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-display font-black text-white tracking-tight uppercase">Neural Architects</h2>
                            <p className="text-xs text-slate-500 font-bold tracking-[0.2em] uppercase mt-1 italic">The Forge behind Apex AI v3.0</p>
                        </div>
                    </div>
                    <p className="text-lg text-slate-400 font-body leading-relaxed max-w-3xl mb-8">
                        Apex AI is a research-grade, institutional-quality algorithmic platform engineered for high-precision market topology mapping. Our mission is to democratize institutional-grade intelligence using state-of-the-art transformer architectures.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        {['TFT Architecture', 'Probabilistic Forecasting', 'FinBERT Sentiment', 'Neural Validation', 'Vectorized Backtesting'].map(tag => (
                            <span key={tag} className="px-4 py-1.5 rounded-full text-[10px] font-black border border-indigo-500/20 bg-indigo-500/5 text-indigo-400 uppercase tracking-widest hover:bg-indigo-500/10 transition-colors shadow-inner">{tag}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Team Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {TEAM.map((member) => (
                    <div
                        key={member.name}
                        className="glass-card p-8 border border-white/5 hover:border-indigo-500/30 transition-all duration-700 group relative overflow-hidden flex flex-col shadow-2xl"
                    >
                        {/* Avatar */}
                        <div className="flex items-start justify-between mb-8">
                            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${member.gradient} flex items-center justify-center shadow-2xl ${member.shadow} ring-1 ring-white/20 group-hover:scale-110 transition-transform duration-500`}>
                                <span className="text-2xl font-display font-black text-white tracking-tighter">{member.initials}</span>
                            </div>
                            <div className="flex gap-2.5">
                                {Object.entries(member.links).map(([platform, url]) => {
                                    const Icon = platform === 'github' ? Github : platform === 'linkedin' ? Linkedin : Twitter;
                                    return (
                                        <a
                                            key={platform}
                                            href={url}
                                            className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-500 hover:text-white hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all shadow-xl"
                                        >
                                            <Icon className="w-4 h-4" />
                                        </a>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex-1">
                            <h3 className="text-xl font-display font-black text-white mb-1 uppercase tracking-tight group-hover:text-indigo-400 transition-colors">{member.name}</h3>
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-6">{member.role}</p>
                            <p className="text-xs text-slate-500 font-body leading-relaxed mb-8 italic opacity-80 group-hover:opacity-100 transition-opacity">"{member.bio}"</p>
                        </div>

                        {/* Skills */}
                        <div className="flex flex-wrap gap-2">
                            {member.skills.map(skill => (
                                <span key={skill} className="px-3 py-1 rounded-lg text-[9px] font-black bg-white/[0.02] border border-white/5 text-slate-500 uppercase tracking-widest group-hover:text-slate-300 transition-colors">
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Tech Stack Grid */}
            <div className="glass-card p-10 border border-white/5 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-30" />
                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em] mb-10 flex items-center gap-3">
                    <Code2 className="w-4 h-4 text-indigo-400" />
                    Deep Tech Stack
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
                    {STACK.map(cat => (
                        <div key={cat.cat} className="space-y-6">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 pb-2 border-b border-indigo-500/20 w-fit">{cat.cat}</p>
                            <ul className="space-y-4">
                                {cat.items.map(item => (
                                    <li key={item} className="flex items-start gap-3 group/item">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/40 mt-1 transition-all group-hover/item:scale-150 group-hover/item:bg-indigo-500" />
                                        <span className="text-[11px] font-bold text-slate-500 leading-tight group-hover/item:text-slate-300 transition-colors">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 opacity-40 hover:opacity-100 transition-opacity duration-700">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Quantum Forge v3.0 &middot; Neural Framework &middot; 2026-PRESENT</p>
                    <div className="flex items-center gap-6">
                        <span className="text-[10px] font-black text-rose-800 uppercase tracking-widest">Educational Purpose</span>
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Open Source Core</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
