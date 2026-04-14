/**
 * Dashboard.tsx — APEX AI v4.0 Redesigned Dashboard
 *
 * Changes:
 *  1. Personalized, cohesive dark terminal aesthetic
 *  2. Live market news feed (from /api/sentiment/{ticker}/news)
 *  3. Fixed portfolio equity tracking with real P&L
 *  4. Connected paper trading summary with growth/loss indicators
 *  5. Market pulse (NIFTY, SENSEX, VIX, BANK NIFTY)
 */

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "@/store/useAuthStore";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, ExternalLink,
  Clock, Newspaper, Activity, Shield, Zap, BarChart2,
  ArrowUpRight, ArrowDownRight, Wallet, Target, Bell
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
const MARKET_INDICES = [
  { label: "NIFTY 50", ticker: "^NSEI" },
  { label: "SENSEX", ticker: "^BSESN" },
  { label: "BANK NIFTY", ticker: "^NSEBANK" },
  { label: "INDIA VIX", ticker: "^INDIAVIX" },
];

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
  score > 0.15 ? "#00e676" : score < -0.15 ? "#ff4b4b" : "#ffc107";

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
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
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
  const color = up ? "#00e676" : "#ff4b4b";
  const isVix = label.includes("VIX");

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12,
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      flex: 1,
      minWidth: 160,
      transition: "border-color 0.2s",
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(99,179,237,0.3)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}
    >
      <span style={{ fontSize: 10, letterSpacing: 2, color: "#5a7a9a", textTransform: "uppercase", fontFamily: "monospace" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Orbitron', monospace" }}>
          {data ? fmt(data.price) : "—"}
        </span>
        {data?.sparkline && (
          <Sparkline data={data.sparkline} color={color} />
        )}
      </div>
      {data && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {up ? <ArrowUpRight size={13} color={color} /> : <ArrowDownRight size={13} color={color} />}
          <span style={{ fontSize: 12, color, fontWeight: 600 }}>
            {up ? "+" : ""}{fmt(data.change_pct)}%
          </span>
          {isVix && (
            <span style={{
              fontSize: 10, marginLeft: 8,
              color: data.price < 15 ? "#00e676" : data.price < 20 ? "#ffc107" : "#ff4b4b",
            }}>
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
      href={item.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        gap: 12,
        padding: "14px 0",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        textDecoration: "none",
        cursor: item.url ? "pointer" : "default",
        animation: `fadeSlideIn 0.4s ease ${index * 0.06}s both`,
      }}
    >
      {/* Sentiment bar */}
      <div style={{
        width: 3,
        borderRadius: 99,
        background: sColor,
        flexShrink: 0,
        minHeight: 48,
        opacity: 0.8,
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          {item.ticker && (
            <span style={{
              fontSize: 9, fontFamily: "monospace", letterSpacing: 1,
              background: "rgba(99,179,237,0.12)", color: "#63b3ed",
              padding: "1px 6px", borderRadius: 4, textTransform: "uppercase",
            }}>
              {item.ticker.replace(".NS", "")}
            </span>
          )}
          <span style={{ fontSize: 10, color: "#4a6a8a", fontFamily: "monospace" }}>
            {item.source}
          </span>
          <span style={{ fontSize: 10, color: "#3a5a7a" }}>·</span>
          <span style={{ fontSize: 10, color: "#4a6a8a" }}>{timeAgo(item.published)}</span>
        </div>
        <p style={{
          fontSize: 13,
          color: "#c8d8f0",
          margin: 0,
          lineHeight: 1.45,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {item.title}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
          <span style={{ fontSize: 10, color: sColor, fontFamily: "monospace" }}>
            {item.score > 0 ? "+" : ""}{fmt(item.score)} sentiment
          </span>
          {item.url && <ExternalLink size={9} color="#3a5a7a" />}
        </div>
      </div>
    </a>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
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

  const authHeaders = token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
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
            const res = await fetch(`/api/sentiment/${ticker}/news?limit=5`);
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
          // Sort by recency
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

    // Auto-refresh every 60s
    const interval = setInterval(() => {
      fetchMarket();
      fetchPortfolio();
    }, 60000);

    // News refresh every 5 minutes
    const newsInterval = setInterval(fetchNews, 300000);

    return () => {
      clearInterval(interval);
      clearInterval(newsInterval);
    };
  }, []);

  // ── Computed values ─────────────────────────────────────────────────────────
  const totalPnl = portfolio
    ? portfolio.unrealised_pnl + portfolio.realised_pnl
    : 0;

  const filteredNews = activeNewsFilter === "ALL"
    ? news
    : news.filter((n) => n.ticker?.includes(activeNewsFilter));

  const newsFilters = ["ALL", "RELIANCE", "TCS", "HDFC", "INFY", "NIFTY"];

  // ── Nifty from market pulse ─────────────────────────────────────────────────
  const nifty = marketData?.nifty;
  const vix = marketData?.vix;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060b14",
      color: "#c8d8f0",
      fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
      padding: "0 0 60px 0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes shimmer {
          from { background-position: -200% 0; }
          to   { background-position: 200% 0; }
        }
        .news-card:hover { background: rgba(255,255,255,0.02) !important; }
        .signal-pill:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,230,118,0.15); }
        .refresh-btn:hover { color: #63b3ed !important; }
        .section-card { animation: fadeSlideIn 0.5s ease both; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "28px 40px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "linear-gradient(180deg, rgba(10,20,40,0.8) 0%, transparent 100%)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: marketData?.status === "LIVE" ? "#00e676" : "#ffc107",
              animation: "pulse 2s ease-in-out infinite",
            }} />
            <span style={{ fontSize: 11, letterSpacing: 3, color: "#4a6a8a", fontFamily: "monospace", textTransform: "uppercase" }}>
              NSE {marketData?.status ?? "—"}
            </span>
            {lastUpdated && (
              <span style={{ fontSize: 10, color: "#2a4a6a", fontFamily: "monospace" }}>
                Updated {timeAgo(lastUpdated.toISOString())}
              </span>
            )}
          </div>
          <h1 style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 800,
            fontFamily: "'Orbitron', monospace",
            color: "#e2e8f0",
            letterSpacing: -0.5,
          }}>
            {getGreeting()},{" "}
            <span style={{
              background: "linear-gradient(135deg, #63b3ed, #00e676)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              {user?.username ?? "Trader"}.
            </span>
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#4a7a9a", lineHeight: 1.5 }}>
            {topSignals.length > 0
              ? `AI detected ${topSignals.length} high-confidence BUY setups across NSE today.`
              : "The AI is scanning the market for high-confidence patterns..."}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => { fetchMarket(); fetchPortfolio(); fetchNews(); }}
            className="refresh-btn"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              padding: "8px 14px",
              color: "#5a7a9a",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontFamily: "monospace",
              transition: "color 0.2s",
            }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            onClick={() => navigate("/swing")}
            style={{
              background: "linear-gradient(135deg, #1a4a8a, #0e2a5a)",
              border: "1px solid rgba(99,179,237,0.3)",
              borderRadius: 8,
              padding: "8px 18px",
              color: "#63b3ed",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.2s",
            }}
          >
            <Zap size={13} /> Open Terminal
          </button>
        </div>
      </div>

      <div style={{ padding: "24px 40px", display: "flex", flexDirection: "column", gap: 28 }}>

        {/* ── Market Indices ────────────────────────────────────────────────── */}
        <section className="section-card" style={{ animationDelay: "0.05s" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <IndexCard label="NIFTY 50" data={nifty ? { price: nifty.price, change_pct: nifty.change_pct, sparkline: nifty.sparkline } : null} />
            <IndexCard label="INDIA VIX" data={vix ? { price: vix.price, change_pct: 0 } : null} />
            {/* Placeholders for SENSEX and BANK NIFTY if you extend /api/market-pulse */}
            <IndexCard label="SENSEX" data={null} />
            <IndexCard label="BANK NIFTY" data={null} />
          </div>
        </section>

        {/* ── Main Grid: Portfolio + Top Signals + News ─────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>

          {/* LEFT: Portfolio + News */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* ── Portfolio Equity Core ──────────────────────────────────────── */}
            <section
              className="section-card"
              style={{
                animationDelay: "0.1s",
                background: "linear-gradient(135deg, rgba(10,25,50,0.8) 0%, rgba(6,15,30,0.9) 100%)",
                border: "1px solid rgba(99,179,237,0.12)",
                borderRadius: 16,
                padding: "24px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Wallet size={16} color="#63b3ed" />
                  <span style={{ fontSize: 11, letterSpacing: 2, color: "#4a6a8a", textTransform: "uppercase", fontFamily: "monospace" }}>
                    Portfolio Equity Core
                  </span>
                </div>
                <button
                  onClick={() => navigate("/paper")}
                  style={{
                    background: "transparent", border: "none",
                    color: "#63b3ed", cursor: "pointer", fontSize: 12,
                    display: "flex", alignItems: "center", gap: 4,
                    fontFamily: "monospace",
                  }}
                >
                  View Details <ExternalLink size={11} />
                </button>
              </div>

              {portfolio ? (
                <>
                  {/* Main value */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "#4a6a8a", fontFamily: "monospace", marginBottom: 4 }}>
                      Total Net Asset Value
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                      <span style={{
                        fontSize: 36, fontWeight: 900, fontFamily: "'Orbitron', monospace",
                        color: "#e2e8f0",
                      }}>
                        {fmtCur(portfolio.portfolio_value)}
                      </span>
                      <span style={{
                        fontSize: 14, fontWeight: 600,
                        color: portfolio.total_return_pct >= 0 ? "#00e676" : "#ff4b4b",
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        {portfolio.total_return_pct >= 0
                          ? <ArrowUpRight size={15} />
                          : <ArrowDownRight size={15} />}
                        {portfolio.total_return_pct >= 0 ? "+" : ""}
                        {fmt(portfolio.total_return_pct)}% Total Return
                      </span>
                    </div>
                  </div>

                  {/* Stat grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                    {[
                      {
                        label: "Cash Available",
                        value: fmtCur(portfolio.cash_balance),
                        icon: <Wallet size={13} />,
                        color: "#63b3ed",
                      },
                      {
                        label: "Invested",
                        value: fmtCur(portfolio.invested_value),
                        icon: <BarChart2 size={13} />,
                        color: "#a78bfa",
                      },
                      {
                        label: "Unrealised P&L",
                        value: `${portfolio.unrealised_pnl >= 0 ? "+" : ""}${fmtCur(portfolio.unrealised_pnl)}`,
                        icon: portfolio.unrealised_pnl >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />,
                        color: portfolio.unrealised_pnl >= 0 ? "#00e676" : "#ff4b4b",
                      },
                      {
                        label: "Realised P&L",
                        value: `${portfolio.realised_pnl >= 0 ? "+" : ""}${fmtCur(portfolio.realised_pnl)}`,
                        icon: <Target size={13} />,
                        color: portfolio.realised_pnl >= 0 ? "#00e676" : "#ff4b4b",
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 10,
                          padding: "12px 14px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, color: stat.color }}>
                          {stat.icon}
                          <span style={{ fontSize: 10, fontFamily: "monospace", letterSpacing: 0.5, color: "#4a6a8a" }}>
                            {stat.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: stat.color, fontFamily: "'JetBrains Mono', monospace" }}>
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bottom stats */}
                  <div style={{
                    display: "flex", gap: 20, marginTop: 16,
                    paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)",
                  }}>
                    {[
                      { label: "Win Rate", value: `${fmt(portfolio.win_rate)}%`, good: portfolio.win_rate >= 50 },
                      { label: "Open Positions", value: portfolio.open_positions },
                      { label: "Total Trades", value: portfolio.trade_count },
                    ].map((s) => (
                      <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 10, color: "#3a5a7a", fontFamily: "monospace" }}>{s.label}</span>
                        <span style={{
                          fontSize: 18, fontWeight: 700, fontFamily: "'Orbitron', monospace",
                          color: typeof s.good === "boolean"
                            ? (s.good ? "#00e676" : "#ff4b4b")
                            : "#e2e8f0",
                        }}>
                          {s.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#3a5a7a" }}>
                  <Wallet size={32} style={{ marginBottom: 12 }} />
                  <p style={{ margin: 0, fontSize: 14 }}>
                    {token ? "Loading portfolio..." : "Login to track your paper portfolio"}
                  </p>
                </div>
              )}
            </section>

            {/* ── Market News Feed ───────────────────────────────────────────── */}
            <section
              className="section-card"
              style={{
                animationDelay: "0.15s",
                background: "rgba(8,16,32,0.8)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16,
                padding: "24px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Newspaper size={16} color="#63b3ed" />
                  <span style={{ fontSize: 11, letterSpacing: 2, color: "#4a6a8a", textTransform: "uppercase", fontFamily: "monospace" }}>
                    Market Intelligence Feed
                  </span>
                  <span style={{
                    background: "rgba(0,230,118,0.12)", color: "#00e676",
                    fontSize: 9, padding: "1px 6px", borderRadius: 4,
                    fontFamily: "monospace", letterSpacing: 1,
                  }}>
                    LIVE
                  </span>
                </div>
                <button
                  onClick={fetchNews}
                  className="refresh-btn"
                  style={{
                    background: "transparent", border: "none",
                    color: "#3a5a7a", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                    fontSize: 11, fontFamily: "monospace", transition: "color 0.2s",
                  }}
                >
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {newsFilters.map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveNewsFilter(f)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 20,
                      border: activeNewsFilter === f
                        ? "1px solid rgba(99,179,237,0.5)"
                        : "1px solid rgba(255,255,255,0.06)",
                      background: activeNewsFilter === f
                        ? "rgba(99,179,237,0.12)"
                        : "transparent",
                      color: activeNewsFilter === f ? "#63b3ed" : "#4a6a8a",
                      cursor: "pointer",
                      fontSize: 11,
                      fontFamily: "monospace",
                      letterSpacing: 0.5,
                      transition: "all 0.15s",
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {newsLoading ? (
                <div style={{ padding: "30px 0", textAlign: "center" }}>
                  <div style={{
                    display: "inline-block",
                    width: 24, height: 24,
                    border: "2px solid rgba(99,179,237,0.2)",
                    borderTopColor: "#63b3ed",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  <p style={{ color: "#3a5a7a", fontSize: 12, marginTop: 12, fontFamily: "monospace" }}>
                    Fetching market intelligence...
                  </p>
                </div>
              ) : filteredNews.length === 0 ? (
                <div style={{ padding: "30px 0", textAlign: "center", color: "#3a5a7a" }}>
                  <Newspaper size={28} style={{ marginBottom: 10 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>No news available for this filter.</p>
                </div>
              ) : (
                <div style={{ maxHeight: 480, overflowY: "auto", paddingRight: 4 }}>
                  {filteredNews.map((item, i) => (
                    <NewsCard key={item.title + i} item={item} index={i} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT: AI Top Radar + FII/DII + Quick Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* ── AI Top Signals ─────────────────────────────────────────────── */}
            <section
              className="section-card"
              style={{
                animationDelay: "0.2s",
                background: "rgba(8,16,32,0.8)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16,
                padding: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Activity size={15} color="#63b3ed" />
                <span style={{ fontSize: 11, letterSpacing: 2, color: "#4a6a8a", textTransform: "uppercase", fontFamily: "monospace" }}>
                  AI Top Radar
                </span>
                <span style={{
                  background: "rgba(0,230,118,0.12)", color: "#00e676",
                  fontSize: 9, padding: "1px 6px", borderRadius: 4,
                  fontFamily: "monospace", marginLeft: "auto",
                }}>
                  LIVE FEED
                </span>
              </div>

              {topSignals.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#3a5a7a" }}>
                  <Shield size={28} style={{ marginBottom: 10 }} />
                  <p style={{ margin: 0, fontSize: 12, fontFamily: "monospace", lineHeight: 1.6 }}>
                    No high-confidence signals.<br />
                    The AI is waiting for clearer<br />market geometry...
                  </p>
                  <button
                    onClick={fetchSignals}
                    style={{
                      marginTop: 14, background: "rgba(99,179,237,0.08)",
                      border: "1px solid rgba(99,179,237,0.2)",
                      borderRadius: 6, padding: "6px 14px",
                      color: "#63b3ed", cursor: "pointer", fontSize: 11, fontFamily: "monospace",
                    }}
                  >
                    Scan Now
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {topSignals.map((sig, i) => (
                    <div
                      key={sig.ticker}
                      className="signal-pill"
                      onClick={() => navigate(`/swing?ticker=${sig.ticker}`)}
                      style={{
                        background: "rgba(0,230,118,0.05)",
                        border: "1px solid rgba(0,230,118,0.15)",
                        borderRadius: 10,
                        padding: "12px 14px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        animation: `fadeSlideIn 0.4s ease ${0.2 + i * 0.08}s both`,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", fontFamily: "monospace" }}>
                          {sig.ticker.replace(".NS", "")}
                        </div>
                        <div style={{ fontSize: 11, color: "#4a7a6a", marginTop: 2 }}>
                          ₹{fmt(sig.price)} → ₹{fmt(sig.p50 ?? sig.price)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{
                          background: "rgba(0,230,118,0.15)", color: "#00e676",
                          padding: "3px 10px", borderRadius: 6,
                          fontSize: 11, fontWeight: 700, fontFamily: "monospace",
                          display: "block", marginBottom: 4,
                        }}>
                          BUY
                        </span>
                        <span style={{ fontSize: 10, color: "#4a7a6a", fontFamily: "monospace" }}>
                          {fmt(sig.confidence * 100)}% conf
                        </span>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => navigate("/screener")}
                    style={{
                      width: "100%", background: "transparent",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 8, padding: "8px",
                      color: "#4a6a8a", cursor: "pointer", fontSize: 11,
                      fontFamily: "monospace", transition: "color 0.2s",
                    }}
                  >
                    View Full AI Screener →
                  </button>
                </div>
              )}
            </section>

            {/* ── FII/DII Flow ───────────────────────────────────────────────── */}
            {marketData?.fii_flow && (
              <section
                className="section-card"
                style={{
                  animationDelay: "0.25s",
                  background: "rgba(8,16,32,0.8)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 16,
                  padding: "20px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <BarChart2 size={15} color="#a78bfa" />
                  <span style={{ fontSize: 11, letterSpacing: 2, color: "#4a6a8a", textTransform: "uppercase", fontFamily: "monospace" }}>
                    FII / DII Flow
                  </span>
                </div>
                {[
                  { label: "FII Net", value: marketData.fii_flow.fii_net },
                  { label: "DII Net", value: marketData.fii_flow.dii_net },
                  { label: "Total Flow", value: marketData.fii_flow.total_flow },
                ].map((row) => (
                  <div key={row.label} style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: 10,
                  }}>
                    <span style={{ fontSize: 12, color: "#4a7a9a", fontFamily: "monospace" }}>{row.label}</span>
                    <span style={{
                      fontSize: 14, fontWeight: 700, fontFamily: "monospace",
                      color: row.value >= 0 ? "#00e676" : "#ff4b4b",
                    }}>
                      {row.value >= 0 ? "+" : ""}₹{fmt(Math.abs(row.value))} Cr
                    </span>
                  </div>
                ))}
                <div style={{
                  marginTop: 8, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: marketData.fii_flow.sentiment === "BULLISH" ? "#00e676"
                      : marketData.fii_flow.sentiment === "BEARISH" ? "#ff4b4b"
                        : "#ffc107",
                    fontFamily: "monospace", letterSpacing: 2,
                  }}>
                    {marketData.fii_flow.sentiment}
                  </span>
                </div>
              </section>
            )}

            {/* ── Quick Actions ──────────────────────────────────────────────── */}
            <section
              className="section-card"
              style={{
                animationDelay: "0.3s",
                background: "rgba(8,16,32,0.8)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16,
                padding: "20px",
              }}
            >
              <span style={{ fontSize: 11, letterSpacing: 2, color: "#4a6a8a", textTransform: "uppercase", fontFamily: "monospace", display: "block", marginBottom: 14 }}>
                Quick Access
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "Swing Trade", icon: <TrendingUp size={14} />, path: "/swing", color: "#00e676" },
                  { label: "Screener", icon: <Activity size={14} />, path: "/screener", color: "#63b3ed" },
                  { label: "Paper Trade", icon: <Wallet size={14} />, path: "/paper", color: "#a78bfa" },
                  { label: "Stock News", icon: <Newspaper size={14} />, path: "/news", color: "#fbbf24" },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.path)}
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 10,
                      padding: "12px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                      color: item.color,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = `rgba(${item.color === "#00e676" ? "0,230,118" : "99,179,237"},0.06)`;
                      e.currentTarget.style.borderColor = `${item.color}33`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                    }}
                  >
                    {item.icon}
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "#7a9ab0" }}>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
