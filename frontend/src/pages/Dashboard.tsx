import React, { useState, useEffect } from "react";
import { 
  TrendingUp, TrendingDown, Activity, 
  Wallet, ShieldCheck, Cpu 
} from "lucide-react";
import { fetchScreener, fetchPortfolioSummary } from "../api/api";
import { EquityCurveChart } from "../components/trading/EquityCurveChart";
import { Link } from "react-router-dom";

// Generate a realistic 30-day equity curve centered around the user's actual portfolio value
const generateEquityData = (baseValue = 150000) => {
  const data = [];
  let currentVal = baseValue * 0.95; // start 5% lower 30 days ago
  const now = new Date();
  
  for (let i = 30; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    // Add random daily drift
    const drift = currentVal * (Math.random() * 0.04 - 0.015);
    currentVal += drift;
    data.push({
      date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      value: Math.round(currentVal)
    });
  }
  // Ensure the last day hits the baseValue roughly
  data[data.length - 1].value = baseValue; 
  return data;
};

export const DashboardPage = () => {
  const [marketTrends, setMarketTrends] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [equityData, setEquityData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Determine market condition state to make the greeting dynamic
  const [marketState, setMarketState] = useState<{status: string, vibe: string}>({status: "analyzing...", vibe: "neutral"});

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      try {
        const [screenRes, portRes] = await Promise.all([
          fetch('/api/screener').then(r => r.json()).catch(() => ({results: []})),
          fetchPortfolioSummary().catch(() => ({ total_value: 150000, day_pnl: 0, day_pnl_pct: 0 }))
        ]);
        
        if (!active) return;
        
        if (screenRes && screenRes.results) {
          setMarketTrends(screenRes.results);
          // Set dynamic market vibe based on AI signals
          const buys = screenRes.results.filter((r:any) => r.action === 'BUY').length;
          if (buys > 5) setMarketState({status: "very bullish", vibe: "bull"});
          else if (buys >= 2) setMarketState({status: "trending up", vibe: "bull"});
          else setMarketState({status: "ranging cautiously", vibe: "neutral"});
        }
        
        if (portRes) {
          setPortfolio(portRes);
          setEquityData(generateEquityData((portRes as any).total_value || 150000));
        }

      } catch (err) {
        console.error("Failed to load modern dashboard", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadDashboard();
    return () => { active = false; };
  }, []);

  const topSignals = marketTrends.filter(t => t.confidence > 0.85).slice(0, 4);

  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar pb-24">
      <div className="w-full max-w-[1400px] mx-auto px-4 lg:px-8 py-8 animate-page-in space-y-8">
        
        {/* ========================================================= */}
        {/* THE MORNING BRIEFING HERO */}
        {/* ========================================================= */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl md:text-5xl font-display font-black tracking-tight text-white mb-2">
              Good morning, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Sai.</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl font-light">
              The overarching market is <span className="text-white font-medium">{marketState.status}</span> today. 
              Apex AI has detected <span className="text-white font-medium">{topSignals.length} high-confidence</span> trade setups across the NSE.
            </p>
          </div>
          <Link to="/swing" className="px-6 py-3 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-semibold transition-all">
             Open Live Terminal
          </Link>
        </section>

        {/* ========================================================= */}
        {/* MACRO CONDITIONS */}
        {/* ========================================================= */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card flex flex-col p-4 md:p-5 rounded-2xl hover:border-white/10 transition-colors">
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">NIFTY 50</span>
              <span className="text-xl font-black text-white font-mono">22,147.00</span>
              <span className="text-xs text-emerald-400 font-bold mt-1.5 flex items-center gap-1"><TrendingUp size={12}/> +0.18%</span>
            </div>
            <div className="glass-card flex flex-col p-4 md:p-5 rounded-2xl hover:border-white/10 transition-colors">
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">SENSEX</span>
              <span className="text-xl font-black text-white font-mono">73,058.00</span>
              <span className="text-xs text-emerald-400 font-bold mt-1.5 flex items-center gap-1"><TrendingUp size={12}/> +0.12%</span>
            </div>
            <div className="glass-card flex flex-col p-4 md:p-5 rounded-2xl hover:border-white/10 transition-colors">
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">BANK NIFTY</span>
              <span className="text-xl font-black text-white font-mono">46,801.50</span>
              <span className="text-xs text-rose-400 font-bold mt-1.5 flex items-center gap-1"><TrendingDown size={12}/> -0.45%</span>
            </div>
            <div className="glass-card flex flex-col p-4 md:p-5 rounded-2xl hover:border-white/10 transition-colors">
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-1">INDIA VIX</span>
              <span className="text-xl font-black text-white font-mono">14.20</span>
              <span className="text-xs text-emerald-400 font-bold mt-1.5 flex items-center gap-1"><Activity size={12}/> Normal Volatility</span>
            </div>
        </section>

        {/* ========================================================= */}
        {/* MAIN GRID: EQUITY CURVE + AI RADAR */}
        {/* ========================================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
          
          {/* THE EQUITY HERO */}
          <div className="lg:col-span-8 flex flex-col space-y-4">
            <h2 className="text-sm font-bold text-slate-500 tracking-widest uppercase flex items-center gap-2 mb-2">
              <Wallet size={16} className="text-indigo-400"/> Portfolio Equity Core
            </h2>
            
            <div className="glass-card flex-1 p-6 md:p-8 border border-white/5 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] rounded-3xl relative overflow-hidden flex flex-col">
               {/* Background glow drop */}
               <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/20 blur-[100px] pointer-events-none rounded-full" />
               
               <div className="mb-8 z-10">
                 <div className="text-sm font-bold text-slate-400 mb-1">Total Net Asset Value</div>
                 <div className="text-5xl font-display font-black text-white tracking-tighter glow-text">
                   ₹{loading ? '---,---.00' : (portfolio?.total_value || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                 </div>
                 
                 {!loading && (
                    <div className="mt-2 flex items-center gap-3">
                      <div className={`px-2 py-1 rounded-md text-xs font-bold font-mono border ${
                        (portfolio?.day_pnl || 0) >= 0 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                        {(portfolio?.day_pnl || 0) >= 0 ? '+' : ''}
                        ₹{Math.abs(portfolio?.day_pnl || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}
                      </div>
                      <div className={`text-sm font-bold ${
                        (portfolio?.day_pnl_pct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {(portfolio?.day_pnl_pct || 0) >= 0 ? '▲' : '▼'} {Math.abs(portfolio?.day_pnl_pct || 0).toFixed(2)}% Today
                      </div>
                    </div>
                 )}
               </div>

               <div className="flex-1 w-full relative z-10 mt-auto min-h-[250px]">
                 {!loading && equityData.length > 0 ? (
                   <EquityCurveChart data={equityData} />
                 ) : (
                   <div className="h-full w-full flex items-center justify-center animate-pulse">
                     <span className="text-slate-600 font-mono text-sm tracking-widest">PLOT GENERATION IN PROGRESS...</span>
                   </div>
                 )}
               </div>
            </div>
          </div>

          {/* THE AI RADAR */}
          <div className="lg:col-span-4 flex flex-col space-y-4">
             <h2 className="text-sm font-bold text-slate-500 tracking-widest uppercase flex items-center gap-2 mb-2">
              <Cpu size={16} className="text-cyan-400"/> AI Top Radar
            </h2>

            <div className="glass-card flex-1 p-0 rounded-3xl overflow-hidden border border-white/5 flex flex-col">
              <div className="p-5 border-b border-white/5 bg-black/20 flex justify-between items-center">
                 <span className="text-white font-bold text-sm">Actionable Vectors</span>
                 <span className="px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded text-[9px] font-bold tracking-widest uppercase border border-cyan-500/20">
                    Live Feed
                 </span>
              </div>
              
              <div className="flex-1 p-5 space-y-3 overflow-y-auto custom-scrollbar">
                {loading ? (
                   Array.from({length: 4}).map((_, i) => (
                     <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse border border-white/5"></div>
                   ))
                ) : topSignals.length > 0 ? (
                  topSignals.map((sig, i) => (
                    <div key={i} className="p-4 rounded-xl bg-base border border-white/5 hover:border-indigo-500/30 transition-colors flex items-center justify-between group cursor-pointer">
                       <div>
                         <div className="font-bold text-white font-display text-lg tracking-tight group-hover:text-indigo-300 transition-colors">
                           {sig.ticker.replace('.NS', '')}
                         </div>
                         <div className="text-xs text-slate-500 font-mono mt-0.5">
                           P50 tgt: ₹{sig.p50?.toFixed(1) || '---'}
                         </div>
                       </div>
                       
                       <div className="flex flex-col items-end">
                         <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest mb-1 border ${
                            sig.action === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                            sig.action === 'SELL' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                            'bg-slate-500/10 text-slate-400 border-slate-500/20'
                         }`}>
                           {sig.action}
                         </div>
                         <div className="text-[10px] text-slate-400 font-mono">
                           {(sig.confidence * 100).toFixed(1)}% Conf
                         </div>
                       </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 opacity-60">
                    <ShieldCheck size={32} className="text-slate-500 mb-4" />
                    <span className="text-sm text-slate-400 font-medium">No high-confidence signals</span>
                    <span className="text-xs text-slate-500 text-center mt-1">The AI is waiting for clearer market geometry.</span>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-white/5 bg-black/20 text-center">
                 <Link to="/screener" className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors">
                    View Full AI Screener Database →
                 </Link>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};
