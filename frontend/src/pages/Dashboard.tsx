import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import {
  TrendingUp, TrendingDown, RefreshCw, ExternalLink,
  Wallet, Target, Bell, ArrowUpRight, ArrowDownRight,
  Activity, Zap, BarChart2, Newspaper
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketIndex {
  name: string;
  price: number;
  change_pct: number;
  sparkline?: number[];
}

interface NewsItem {
  title: string;
  url: string;
  source: string;
  published: string;
  score: number;
  ticker?: string;
  imageUrl?: string;
}

interface PortfolioSummary {
  cash_balance: number;
  invested_value: number;
  portfolio_value: number;
  unrealised_pnl: number;
  realised_pnl: number;
  total_return_pct: number;
  win_rate: number;
  trade_count: number;
  open_positions: number;
  initial_capital: number;
}

interface TopSignal {
  ticker: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  price: number;
  p50?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NEWS_TICKERS = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "NSEI"];

// ─── Utils ────────────────────────────────────────────────────────────────────

const fmt = (n: number, dec = 2) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: dec, minimumFractionDigits: dec }).format(n);

const fmtCur = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const timeAgo = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "";
  }
};

const sentimentColor = (score: number) =>
  score > 0.15 ? "#10b981" : score < -0.15 ? "#f43f5e" : "#f59e0b";

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Sparkline: React.FC<{ data: number[]; color: string; height?: number }> = ({
  data, color, height = 32,
}) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = height;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};

const IndexCard: React.FC<{ label: string; data?: { price: number; change_pct: number; sparkline?: number[] } | null }> = ({
  label, data,
}) => {
  const up = (data?.change_pct ?? 0) >= 0;
  const color = up ? "#10b981" : "#f43f5e";
  const textColorClass = up ? "text-emerald" : "text-rose";
  const isVix = label.includes("VIX");

  return (
    <div className="glass-card flex-1 min-w-[160px] flex flex-col gap-1.5 hover:border-bright">
      <span className="font-data-small text-muted uppercase tracking-[0.2em]">
        {label}
      </span>
      <div className="flex items-center justify-between">
        <span className="font-display text-xl font-bold text-primary mt-1">
          {data ? fmt(data.price) : "─"}
        </span>
        {data?.sparkline && (
          <Sparkline data={data.sparkline} color={color} />
        )}
      </div>
      {data && (
        <div className={`flex items-center gap-1 font-bold text-xs mt-1 ${textColorClass}`}>
          {up ? <ArrowUpRight size={13} strokeWidth={3} /> : <ArrowDownRight size={13} strokeWidth={3} />}
          <span>
            {up ? "+" : ""}{fmt(data.change_pct)}%
          </span>
          {isVix && (
            <span className={`font-data-small ml-2 ${data.price < 20 ? 'text-emerald' : 'text-rose'}`}>
              {data.price < 15 ? "Low Risk" : data.price < 20 ? "Moderate" : "High Risk"}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const NewsCard: React.FC<{ item: NewsItem; index: number }> = ({ item, index }) => {
  const sColor = sentimentColor(item.score);
  return (
    <a
      href={item.url || "href"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 py-3 border-b border-dim hover:bg-white/5 transition-colors cursor-pointer group"
      style={{ animation: "slide-in-right 0.3s ease-out s backwards" }}
    >
      {/* Sentiment bar */}
      <div
        className="w-[3px] rounded-full shrink-0 min-h-[48px] opacity-80"
        style={{ background: sColor }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {item.ticker && (
            <span className="font-data-small bg-cyan/10 text-cyan px-1.5 py-0.5 rounded uppercase tracking-wider">
              {item.ticker.replace(".NS", "")}
            </span>
          )}
          <span className="font-data-small text-muted">
            {item.source}
          </span>
          <span className="text-muted text-[10px]">·</span>
          <span className="font-data-small text-muted">{timeAgo(item.published)}</span>
        </div>
        <p className="text-sm text-primary m-0 leading-relaxed line-clamp-2">
          {item.title}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="font-data-small" style={{ color: sColor }}>
            {item.score > 0 ? "+" : ""}{fmt(item.score)} sentiment
          </span>
          {item.url && <ExternalLink size={9} className="text-muted group-hover:text-cyan transition-colors" />}
        </div>
      </div>
    </a>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { user } = useAuthStore() as any;
  const navigate = useNavigate();

  const [marketData, setMarketData] = useState<Record<string, any>>({});
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [topSignals, setTopSignals] = useState<TopSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeNewsFilter, setActiveNewsFilter] = useState<string>("ALL");

  const token = useAuthStore((s: any) => s.token);

  const authHeaders: Record<string, string> = token
    ? { "Content-Type": "application/json", Authorization: "Bearer " }
    : { "Content-Type": "application/json" };

  // ── Fetch Market Pulse ──────────────────────────────────────────────────────
  const fetchMarket = useCallback(async () => {
    try {
      const res = await fetch("/api/market-pulse");
      const d = await res.json();
      setMarketData(d);
    } catch {}
  }, []);

  // ── Fetch Portfolio ─────────────────────────────────────────────────────────
  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch("/api/paper/summary", { headers: authHeaders });
      if (res.ok) {
        const d = await res.json();
        setPortfolio(d);
      }
    } catch {}
  }, [token]);

  // ── Fetch News from multiple tickers ───────────────────────────────────────
  const fetchNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const allNews: NewsItem[] = [];

      await Promise.allSettled(
        NEWS_TICKERS.map(async (ticker) => {
          try {
            const res = await fetch("/api/sentiment//news?limit=5");
            if (res.ok) {
              const d = await res.json();
              const items: NewsItem[] = (d.news || []).map((n: any) => ({
                ...n,
                ticker,
              }));
              allNews.push(...items);
            }
          } catch {}
        })
      );

      // Also try Google News via sentiment aggregator
      try {
        const res = await fetch("/api/sentiment/NIFTY50/news?limit=8");
        if (res.ok) {
          const d = await res.json();
          allNews.push(...(d.news || []).map((n: any) => ({ ...n, ticker: "NIFTY" })));
        }
      } catch {}

      // Deduplicate by title
      const seen = new Set<string>();
      const unique = allNews
        .filter((n) => {
          if (!n.title || seen.has(n.title)) return false;
          seen.add(n.title);
          return true;
        })
        .sort((a, b) => {
          try {
            return new Date(b.published).getTime() - new Date(a.published).getTime();
          } catch {
            return 0;
          }
        });

      setNews(unique.slice(0, 30));
    } catch {}
    setNewsLoading(false);
  }, []);

  // ── Fetch top signals from screener ────────────────────────────────────────
  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch("/api/screener?mode=swing");
      if (res.ok) {
        const d = await res.json();
        const buys = (d.results || [])
          .filter((r: any) => r.action === "BUY")
          .slice(0, 3)
          .map((r: any) => ({
            ticker: r.ticker,
            action: r.action,
            confidence: r.confidence,
            price: r.price || r.current_price,
            p50: r.p50,
          }));
        setTopSignals(buys);
      }
    } catch {}
  }, []);

  // ── Load all ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.allSettled([fetchMarket(), fetchPortfolio(), fetchNews(), fetchSignals()]);
      setLoading(false);
      setLastUpdated(new Date());
    };
    load();

    const interval = setInterval(() => {
      fetchMarket();
      fetchPortfolio();
    }, 60000);

    const newsInterval = setInterval(fetchNews, 300000);

    return () => {
      clearInterval(interval);
      clearInterval(newsInterval);
    };
  }, []);

  // ── Computed values ─────────────────────────────────────────────────────────
  const filteredNews = activeNewsFilter === "ALL"
    ? news
    : news.filter((n) => n.ticker?.includes(activeNewsFilter));

  const newsFilters = ["ALL", "RELIANCE", "TCS", "HDFC", "INFY", "NIFTY"];
  const nifty = marketData?.nifty;
  const vix = marketData?.vix;

  return (
    <div className="page-container py-8 animate-page-in">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className={"w-2 h-2 rounded-full "} />
            <span className="font-data-tiny text-muted uppercase">
              NSE {marketData?.status ?? "─"}
            </span>
            {lastUpdated && (
              <span className="font-data-small text-muted">
                Updated {timeAgo(lastUpdated.toISOString())}
              </span>
            )}
          </div>
          <h1 className="font-display text-4xl font-bold text-primary tracking-tight m-0">
            {getGreeting()}, <span className="text-cyan glow-cyan">{user?.username ?? "Trader"}</span>.
          </h1>
          <p className="mt-2 text-sm text-secondary">
            {topSignals.length > 0
              ? "AI detected  high-confidence BUY setups across NSE today."
              : "The AI is scanning the market for high-confidence patterns..."}
          </p>
        </div>

        <div className="flex gap-3 items-center">
          <button
            onClick={() => { fetchMarket(); fetchPortfolio(); fetchNews(); }}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-dim rounded-lg text-muted font-data-small hover:text-primary hover:border-bright transition-all"
          >
            <RefreshCw size={13} /> REFRESH
          </button>
          <button
            onClick={() => navigate("/swing")}
            className="flex items-center gap-2 px-4 py-2 bg-cyan/10 border border-cyan/30 rounded-lg text-cyan font-bold text-sm glow-border-cyan hover:bg-cyan/20 transition-all"
          >
            <Zap size={14} className="fill-cyan" /> OPEN TERMINAL
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {/* ── Market Indices ────────────────────────────────────────────────── */}
        <section className="flex flex-wrap gap-4">
          <IndexCard label="NIFTY 50" data={nifty ? { price: nifty.price, change_pct: nifty.change_pct, sparkline: nifty.sparkline } : null} />
          <IndexCard label="INDIA VIX" data={vix ? { price: vix.price, change_pct: 0 } : null} />
          <IndexCard label="SENSEX" data={null} />
          <IndexCard label="BANK NIFTY" data={null} />
        </section>

        {/* ── Main Grid: Portfolio + Top Signals + News ─────────────────────── */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          
          {/* LEFT: Portfolio + News */}
          <div className="flex flex-col gap-6">
            
            {/* ── Portfolio Equity Core ──────────────────────────────────────── */}
            <section className="neon-frame rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-cyan" />
                  <span className="neon-label text-muted">
                    Portfolio Equity Core
                  </span>
                </div>
                <button
                  onClick={() => navigate("/paper")}
                  className="flex items-center gap-1.5 font-data-small text-cyan hover:text-white transition-colors"
                >
                  VIEW DETAILS <ExternalLink size={11} />
                </button>
              </div>

              {portfolio ? (
                <>
                  <div className="mb-6">
                    <div className="font-data-small text-muted mb-1">
                      TOTAL NET ASSET VALUE
                    </div>
                    <div className="flex items-baseline gap-4">
                      <span className="font-display text-4xl font-black text-primary tracking-tight">
                        {fmtCur(portfolio.portfolio_value)}
                      </span>
                      <span className={`flex items-center gap-1 font-bold text-sm ${portfolio.total_return_pct >= 0 ? 'text-emerald' : 'text-rose'}`}>
                        {portfolio.total_return_pct >= 0 ? <ArrowUpRight size={16} strokeWidth={3} /> : <ArrowDownRight size={16} strokeWidth={3} />}
                        {portfolio.total_return_pct >= 0 ? "+" : ""}{fmt(portfolio.total_return_pct)}% Total Return
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "CASH AVAILABLE", value: fmtCur(portfolio.cash_balance), icon: <Wallet size={13} />, colorClass: "text-cyan" },
                      { label: "INVESTED", value: fmtCur(portfolio.invested_value), icon: <BarChart2 size={13} />, colorClass: "text-indigo-400" },
                      { label: "UNREALISED P&L", value: `${portfolio.unrealised_pnl >= 0 ? '+' : ''}${fmtCur(portfolio.unrealised_pnl)}`, icon: portfolio.unrealised_pnl >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />, colorClass: portfolio.unrealised_pnl >= 0 ? "text-emerald" : "text-rose" },
                      { label: "REALISED P&L", value: `${portfolio.realised_pnl >= 0 ? '+' : ''}${fmtCur(portfolio.realised_pnl)}`, icon: <Target size={13} />, colorClass: portfolio.realised_pnl >= 0 ? "text-emerald" : "text-rose" },
                    ].map((stat) => (
                      <div key={stat.label} className="glass-card p-3 custom-scrollbar">
                        <div className="flex items-center gap-1.5 mb-1.5 text-muted">
                          {stat.icon}
                          <span className="font-data-small">{stat.label}</span>
                        </div>
                        <div className={`font-data text-lg font-bold ${stat.colorClass}`}>
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-6 mt-5 pt-5 border-t border-dim">
                    {[
                      { label: "WIN RATE", value: `${fmt(portfolio.win_rate)}%`, good: portfolio.win_rate >= 50 },
                      { label: "OPEN POSITIONS", value: portfolio.open_positions.toString(), good: null },
                      { label: "TOTAL TRADES", value: portfolio.trade_count.toString(), good: null },
                    ].map((s) => (
                      <div key={s.label} className="flex flex-col gap-0.5">
                        <span className="font-data-tiny text-muted">{s.label}</span>
                        <span className={`font-display text-xl font-bold ${s.good === null ? 'text-primary' : s.good ? 'text-emerald' : 'text-rose'}`}>
                          {s.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-10 text-center text-muted">
                  <Wallet size={32} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">
                    {token ? "Loading portfolio..." : "Login to track your paper portfolio"}
                  </p>
                </div>
              )}
            </section>

            {/* ── Market News Feed ───────────────────────────────────────────── */}
            <section className="glass border border-mid rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Newspaper size={16} className="text-cyan" />
                  <span className="neon-label text-muted">
                    Market Intelligence Feed
                  </span>
                  <span className="font-data-tiny bg-emerald/10 text-emerald px-1.5 py-0.5 rounded tracking-widest ml-2">
                    LIVE
                  </span>
                </div>
                <button
                  onClick={fetchNews}
                  className="flex items-center gap-1.5 font-data-small text-muted hover:text-cyan transition-colors"
                >
                  <RefreshCw size={11} /> REFRESH
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2 mb-4">
                {newsFilters.map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveNewsFilter(f)}
                    className={`font-data-small px-3 py-1 rounded-full border transition-all ${
                      activeNewsFilter === f 
                        ? 'bg-cyan/10 border-cyan/30 text-cyan' 
                        : 'bg-white/5 border-dim text-muted hover:text-primary'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {newsLoading ? (
                <div className="py-10 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-cyan/20 border-t-cyan rounded-full animate-spin" />
                  <p className="text-xs text-muted font-data mt-3">
                    Fetching market intelligence...
                  </p>
                </div>
              ) : filteredNews.length === 0 ? (
                <div className="py-10 text-center text-muted">
                  <Newspaper size={28} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No news available for this filter.</p>
                </div>
              ) : (
                <div className="pr-2 max-h-[480px] overflow-y-auto custom-scrollbar">
                  {filteredNews.map((item, i) => (
                    <NewsCard key={item.title + i} item={item} index={i} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT: AI Top Radar + FII/DII + Quick Actions */}
          <div className="flex flex-col gap-6">
            {/* ── AI Top Signals ─────────────────────────────────────────────── */}
            <section className="glass border border-mid rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <Activity size={15} className="text-cyan" />
                <span className="neon-label text-muted">AI Top Radar</span>
                <span className="font-data-tiny bg-emerald/10 text-emerald px-1.5 py-0.5 rounded tracking-widest ml-auto">
                  LIVE FEED
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {topSignals.length > 0 ? (
                  topSignals.map((sig, i) => (
                    <div
                      key={sig.ticker + i}
                      className="glass-card relative overflow-hidden group cursor-pointer hover:-translate-y-0.5 transition-transform p-4"
                      onClick={() => navigate(`/swing?ticker=${sig.ticker.replace('.NS', '')}`)}
                    >
                      {/* Glow line */}
                      <div className={`absolute left-0 top-0 w-1 h-full ${sig.action === 'BUY' ? 'bg-emerald shadow-[2px_0_10px_rgba(16,185,129,0.3)]' : 'bg-rose shadow-[2px_0_10px_rgba(244,63,94,0.3)]'}`} />
                      
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-display font-bold text-primary text-base">
                          {sig.ticker.replace(".NS", "")}
                        </span>
                        <span className={`font-data-small px-1.5 py-0.5 rounded ${sig.action === 'BUY' ? 'bg-emerald/10 text-emerald' : 'bg-rose/10 text-rose'}`}>
                          {sig.action}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="font-data text-sm text-primary">
                          {fmtCur(sig.price)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Activity size={12} className="text-muted" />
                          <span className="font-data text-xs text-secondary">
                            Conf: <span className="text-cyan">{fmt(sig.confidence * 100)}%</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="w-full h-32 flex flex-col items-center justify-center border border-dashed border-dim rounded-lg bg-black/20">
                    <Activity size={24} className="text-muted mb-2 opacity-50" />
                    <span className="font-data-small text-muted">SCANNING MARKET...</span>
                  </div>
                )}
              </div>
            </section>

            {/* ── FII / DII Data (Placeholder) ───────────────────────────────── */}
            <section className="glass border border-mid rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={15} className="text-indigo" />
                <span className="neon-label text-muted">FII / DII Flow</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 border border-dim rounded-lg p-3 text-center">
                  <div className="font-data-small text-muted mb-1">FII NET</div>
                  <div className="font-data font-bold text-rose">-2,450 Cr</div>
                </div>
                <div className="bg-white/5 border border-dim rounded-lg p-3 text-center">
                  <div className="font-data-small text-muted mb-1">DII NET</div>
                  <div className="font-data font-bold text-emerald">+3,120 Cr</div>
                </div>
              </div>
            </section>

            {/* ── Important Alerts ────────────────────────────────────────────── */}
            <section className="glass border border-mid rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Bell size={15} className="text-amber" />
                <span className="neon-label text-muted">System Alerts</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-3 p-3 bg-white/5 border border-dim rounded-lg">
                  <Target size={14} className="text-emerald mt-0.5 shrink-0" />
                  <div>
                    <div className="font-data text-xs font-bold text-primary mb-0.5">Model Weights Updated</div>
                    <div className="text-xs text-muted">Temporal Fusion Transformer weights synced.</div>
                  </div>
                </div>
                {!portfolio?.cash_balance && (
                  <div className="flex items-start gap-3 p-3 bg-amber/10 border border-amber/20 rounded-lg">
                    <Wallet size={14} className="text-amber mt-0.5 shrink-0" />
                    <div>
                      <div className="font-data text-xs font-bold text-amber mb-0.5">Add Paper Funds</div>
                      <div className="text-xs text-muted">Your paper account balance is zero.</div>
                    </div>
                  </div>
                )}
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
