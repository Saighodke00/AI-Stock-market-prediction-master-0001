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
        <div className="p-4 md:p-5 lg:p-6 h-full overflow-y-auto">
            {/* Hero */}
            <div className="glass rounded-3xl p-8 border border-slate-800/60 mb-6 relative overflow-hidden">
                {/* Background accent */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Award className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white">Neural Architects</h2>
                            <p className="text-xs text-slate-500">The team behind Apex AI</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
                        Apex AI is a research-grade, institutional-quality stock prediction platform built by a passionate team of AI engineers and quant analysts. Our mission is to democratize professional-grade trading intelligence that previously existed only inside hedge funds and investment banks.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-5">
                        {['TFT Architecture', 'Probabilistic Forecasting', 'FinBERT Sentiment', '3-Gate Signal Validation', 'Walk-Forward Backtesting'].map(tag => (
                            <span key={tag} className="px-3 py-1 rounded-full text-[10px] font-bold border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 uppercase tracking-wider">{tag}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Team Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {TEAM.map((member) => (
                    <div
                        key={member.name}
                        className="glass rounded-3xl p-6 border border-slate-800/60 hover:border-slate-700/80 hover:scale-[1.02] transition-all duration-300 cursor-pointer group relative overflow-hidden"
                    >
                        {/* Card glow */}
                        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${member.gradient} opacity-5 rounded-full blur-2xl pointer-events-none group-hover:opacity-10 transition-opacity`} />

                        {/* Avatar */}
                        <div className="flex items-start justify-between mb-5">
                            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${member.gradient} flex items-center justify-center shadow-xl ${member.shadow} ring-2 ${member.ring}`}>
                                <span className="text-xl font-black text-white">{member.initials}</span>
                            </div>
                            <div className="flex gap-2">
                                {Object.entries(member.links).map(([platform, url]) => {
                                    const Icon = platform === 'github' ? Github : platform === 'linkedin' ? Linkedin : Twitter;
                                    return (
                                        <a
                                            key={platform}
                                            href={url}
                                            className="w-7 h-7 rounded-lg bg-slate-800/60 border border-slate-700/40 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:border-slate-600 transition-all"
                                        >
                                            <Icon className="w-3.5 h-3.5" />
                                        </a>
                                    );
                                })}
                            </div>
                        </div>

                        <h3 className="text-sm font-bold text-white mb-0.5">{member.name}</h3>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">{member.role}</p>
                        <p className="text-[11px] text-slate-400 leading-relaxed mb-4">{member.bio}</p>

                        {/* Skills */}
                        <div className="flex flex-wrap gap-1.5">
                            {member.skills.map(skill => (
                                <span key={skill} className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-800/70 border border-slate-700/40 text-slate-400 uppercase tracking-wide">
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Tech Stack Grid */}
            <div className="glass rounded-3xl p-6 border border-slate-800/60">
                <h3 className="text-base font-bold text-white mb-5">Technology Stack</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {STACK.map(cat => (
                        <div key={cat.cat}>
                            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-3">{cat.cat}</p>
                            <ul className="space-y-2">
                                {cat.items.map(item => (
                                    <li key={item} className="flex items-center gap-2 text-[11px] text-slate-400">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/60 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-600">Apex AI v2.0 · Multi-Modal TFT Architecture · March 2026</p>
                    <p className="text-[11px] text-slate-700">Educational Purpose Only · Not Financial Advice</p>
                </div>
            </div>
        </div>
    );
}
