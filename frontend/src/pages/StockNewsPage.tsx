/**
 * StockNewsPage.tsx — APEX AI Stock Intelligence Hub
 *
 * Features:
 *  - Full-screen news feed with search bar
 *  - Ticker-based filtering
 *  - Sentiment scores per article
 *  - Market data panel alongside news
 *  - Quick stock info cards with mini charts
 *  - RSS + yfinance news aggregation via /api/sentiment endpoints
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search, RefreshCw, TrendingUp, TrendingDown, ExternalLink,
  Newspaper, Activity, BarChart2, Clock, X, ChevronRight,
  BookOpen, AlertTriangle, CheckCircle2, Minus
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsArticle {
  title: string;
  url: string;
  source: string;
  published: string;
  score: number;
  ticker?: string;
  summary?: string;
}

interface StockSnapshot {
  ticker: string;
  price: number;
  change_pct: number;
  label: string;
}

interface SentimentMatrix {
  ticker: string;
  aggregate: { score: number; label: string; confidence: number };
  layers: {
    news: { score: number; article_count: number; items: NewsArticle[] };
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POPULAR_TICKERS = [
  { label: "RELIANCE", ticker: "RELIANCE.NS" },
  { label: "TCS", ticker: "TCS.NS" },
  { label: "HDFC Bank", ticker: "HDFCBANK.NS" },
  { label: "INFY", ticker: "INFY.NS" },
  { label: "ICICI Bank", ticker: "ICICIBANK.NS" },
  { label: "SBI", ticker: "SBIN.NS" },
  { label: "Wipro", ticker: "WIPRO.NS" },
  { label: "HCL Tech", ticker: "HCLTECH.NS" },
  { label: "Adani Ports", ticker: "ADANIPORTS.NS" },
  { label: "Bajaj Finance", ticker: "BAJFINANCE.NS" },
  { label: "Maruti", ticker: "MARUTI.NS" },
  { label: "Sun Pharma", ticker: "SUNPHARMA.NS" },
];

const CATEGORIES = ["Market", "IT", "Banking", "Pharma", "Energy", "Auto"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number, d = 2) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);

const timeAgo = (dateStr: string) => {
  try {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch { return ""; }
};

const sentimentMeta = (score: number) => {
  if (score > 0.2) return { label: "BULLISH", color: "#00e676", icon: <CheckCircle2 size={11} /> };
  if (score < -0.2) return { label: "BEARISH", color: "#ff4b4b", icon: <AlertTriangle size={11} /> };
  return { label: "NEUTRAL", color: "#ffc107", icon: <Minus size={11} /> };
};

// ─── Article Card ─────────────────────────────────────────────────────────────

const ArticleCard: React.FC<{ article: NewsArticle; index: number; featured?: boolean }> = ({
  article, index, featured = false,
}) => {
  const sm = sentimentMeta(article.score);

  return (
    <a
      href={article.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        flexDirection: featured ? "column" : "row",
        gap: featured ? 14 : 12,
        padding: featured ? "20px" : "16px",
        background: featured
          ? "linear-gradient(135deg, rgba(99,179,237,0.06), rgba(10,25,50,0.8))"
          : "rgba(255,255,255,0.02)",
        border: `1px solid ${featured ? "rgba(99,179,237,0.2)" : "rgba(255,255,255,0.05)"}`,
        borderRadius: featured ? 14 : 10,
        textDecoration: "none",
        cursor: article.url ? "pointer" : "default",
        transition: "all 0.2s",
        animation: `newsIn 0.4s ease ${index * 0.05}s both`,
        overflow: "hidden",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = featured
          ? "linear-gradient(135deg, rgba(99,179,237,0.1), rgba(10,25,50,0.9))"
          : "rgba(255,255,255,0.04)";
        e.currentTarget.style.borderColor = featured
          ? "rgba(99,179,237,0.4)"
          : "rgba(255,255,255,0.1)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = featured
          ? "linear-gradient(135deg, rgba(99,179,237,0.06), rgba(10,25,50,0.8))"
          : "rgba(255,255,255,0.02)";
        e.currentTarget.style.borderColor = featured
          ? "rgba(99,179,237,0.2)"
          : "rgba(255,255,255,0.05)";
      }}
    >
      {/* Left: sentiment bar */}
      {!featured && (
        <div style={{
          width: 3, flexShrink: 0,
          background: sm.color,
          borderRadius: 99, opacity: 0.8,
          minHeight: 50,
        }} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Meta row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          {featured && (
            <span style={{
              background: "rgba(99,179,237,0.15)", color: "#63b3ed",
              fontSize: 9, padding: "2px 8px", borderRadius: 4,
              fontFamily: "monospace", letterSpacing: 1, textTransform: "uppercase",
            }}>
              TOP STORY
            </span>
          )}
          {article.ticker && (
            <span style={{
              background: "rgba(167,139,250,0.12)", color: "#a78bfa",
              fontSize: 9, padding: "1px 6px", borderRadius: 4,
              fontFamily: "monospace", textTransform: "uppercase",
            }}>
              {article.ticker.replace(".NS", "").replace(".BO", "")}
            </span>
          )}
          <span style={{ fontSize: 10, color: "#4a6a8a", fontFamily: "monospace" }}>
            {article.source}
          </span>
          {article.published && (
            <>
              <span style={{ color: "#2a4a6a", fontSize: 10 }}>·</span>
              <span style={{ fontSize: 10, color: "#3a5a7a", display: "flex", alignItems: "center", gap: 3 }}>
                <Clock size={9} /> {timeAgo(article.published)}
              </span>
            </>
          )}
          <span style={{
            marginLeft: "auto",
            display: "flex", alignItems: "center", gap: 4,
            fontSize: 10, color: sm.color, fontFamily: "monospace",
          }}>
            {sm.icon} {sm.label}
          </span>
        </div>

        {/* Title */}
        <p style={{
          margin: 0,
          fontSize: featured ? 16 : 13,
          fontWeight: featured ? 700 : 500,
          color: "#d0e0f0",
          lineHeight: 1.5,
          display: "-webkit-box",
          WebkitLineClamp: featured ? 3 : 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {article.title}
        </p>

        {/* Summary */}
        {featured && article.summary && (
          <p style={{
            margin: "8px 0 0",
            fontSize: 12,
            color: "#4a7a9a",
            lineHeight: 1.6,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {article.summary}
          </p>
        )}

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 10, color: "#2a4a7a", fontFamily: "monospace" }}>
            Score: {article.score > 0 ? "+" : ""}{fmt(article.score)}
          </span>
          {article.url && (
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#2a4a6a" }}>
              Read more <ExternalLink size={9} />
            </span>
          )}
        </div>
      </div>
    </a>
  );
};

// ─── Ticker Quick Card ────────────────────────────────────────────────────────

const TickerQuickCard: React.FC<{
  ticker: string;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ ticker, label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: active ? "rgba(99,179,237,0.12)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${active ? "rgba(99,179,237,0.4)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 8,
      padding: "8px 14px",
      cursor: "pointer",
      color: active ? "#63b3ed" : "#5a7a9a",
      fontSize: 12,
      fontFamily: "monospace",
      transition: "all 0.15s",
      whiteSpace: "nowrap",
      flexShrink: 0,
    }}
  >
    {label}
  </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const StockNewsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTicker = searchParams.get("ticker") || "";

  const [searchQuery, setSearchQuery] = useState(initialTicker);
  const [activeTicker, setActiveTicker] = useState(
    initialTicker ? POPULAR_TICKERS.find(t => t.ticker.includes(initialTicker))?.ticker || "RELIANCE.NS"
      : "RELIANCE.NS"
  );
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [sentimentData, setSentimentData] = useState<SentimentMatrix | null>(null);
  const [stockData, setStockData] = useState<{ price: number; change_pct: number } | null>(null);
  const [customSearch, setCustomSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Fetch news for active ticker ────────────────────────────────────────────
  const fetchNews = useCallback(async (ticker: string) => {
    setLoading(true);
    setArticles([]);
    setSentimentData(null);
    setStockData(null);

    try {
      // Full sentiment matrix
      const [matrixRes, newsRes] = await Promise.allSettled([
        fetch(`/api/sentiment/${ticker}`),
        fetch(`/api/sentiment/${ticker}/news?page=1&limit=25`),
      ]);

      if (matrixRes.status === "fulfilled" && matrixRes.value.ok) {
        const d = await matrixRes.value.json();
        setSentimentData(d);
      }

      if (newsRes.status === "fulfilled" && newsRes.value.ok) {
        const d = await newsRes.value.json();
        setArticles((d.news || []).map((n: any) => ({ ...n, ticker })));
      }

      // Stock price
      try {
        const sigRes = await fetch(`/api/signal/${ticker}?mode=swing`);
        if (sigRes.ok) {
          const sd = await sigRes.json();
          setStockData({
            price: sd.current_price || sd.price,
            change_pct: sd.price_change_pct || sd.pct_change || 0,
          });
        }
      } catch {}
    } catch {}

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNews(activeTicker);
  }, [activeTicker]);

  // ── Handle search ────────────────────────────────────────────────────────────
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = customSearch.trim().toUpperCase();
    if (!q) return;
    const ticker = q.includes(".NS") || q.includes(".BO") ? q : `${q}.NS`;
    setActiveTicker(ticker);
    setSearchParams({ ticker: q });
    setCustomSearch("");
  };

  const activeLabel = POPULAR_TICKERS.find(t => t.ticker === activeTicker)?.label
    || activeTicker.replace(".NS", "").replace(".BO", "");

  const sentMeta = sentimentData
    ? sentimentMeta(sentimentData.aggregate.score)
    : null;

  const [featured, ...rest] = articles;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060b14",
      color: "#c8d8f0",
      fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes newsIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(99,179,237,0.2); border-radius: 99px; }
        .news-ticker-btn:hover { background: rgba(255,255,255,0.04) !important; }
      `}</style>

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: "24px 40px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        background: "linear-gradient(180deg, rgba(10,20,40,0.8) 0%, transparent 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Newspaper size={20} color="#63b3ed" />
          <h1 style={{
            margin: 0, fontSize: 22,
            fontFamily: "'Orbitron', monospace",
            fontWeight: 900, color: "#e2e8f0", letterSpacing: 1,
          }}>
            STOCK INTELLIGENCE
          </h1>
          <span style={{
            background: "rgba(0,230,118,0.12)", color: "#00e676",
            fontSize: 9, padding: "2px 8px", borderRadius: 4,
            fontFamily: "monospace", letterSpacing: 2,
          }}>
            LIVE NEWS
          </span>
        </div>

        {/* ── Search Bar ──────────────────────────────────────────────────────── */}
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 10,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(99,179,237,0.2)",
            borderRadius: 10,
            padding: "10px 16px",
          }}>
            <Search size={15} color="#4a7a9a" />
            <input
              ref={searchRef}
              type="text"
              value={customSearch}
              onChange={e => setCustomSearch(e.target.value)}
              placeholder="Search ticker or company... (e.g. RELIANCE, TCS, HDFC)"
              style={{
                flex: 1, background: "transparent", border: "none",
                outline: "none", color: "#c8d8f0",
                fontSize: 14, fontFamily: "'JetBrains Mono', monospace",
              }}
            />
            {customSearch && (
              <button
                type="button"
                onClick={() => setCustomSearch("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#4a6a8a" }}
              >
                <X size={13} />
              </button>
            )}
          </div>
          <button
            type="submit"
            style={{
              background: "linear-gradient(135deg, #1a4a8a, #0e2a5a)",
              border: "1px solid rgba(99,179,237,0.3)",
              borderRadius: 10, padding: "10px 20px",
              color: "#63b3ed", cursor: "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "monospace",
            }}
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => fetchNews(activeTicker)}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "10px 14px",
              color: "#5a7a9a", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, fontFamily: "monospace",
            }}
          >
            <RefreshCw size={13} />
          </button>
        </form>

        {/* ── Popular Tickers ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {POPULAR_TICKERS.map(t => (
            <TickerQuickCard
              key={t.ticker}
              ticker={t.ticker}
              label={t.label}
              active={activeTicker === t.ticker}
              onClick={() => setActiveTicker(t.ticker)}
            />
          ))}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 300px",
        gap: 0,
        maxHeight: "calc(100vh - 200px)",
      }}>

        {/* LEFT: News Feed */}
        <div style={{
          padding: "24px 32px 40px 40px",
          overflowY: "auto",
        }}>
          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <h2 style={{
              margin: 0, fontSize: 16,
              fontFamily: "'Orbitron', monospace",
              color: "#e2e8f0", fontWeight: 700,
            }}>
              {activeLabel}
            </h2>
            {sentMeta && (
              <span style={{
                background: `${sentMeta.color}18`,
                border: `1px solid ${sentMeta.color}40`,
                color: sentMeta.color,
                padding: "3px 10px", borderRadius: 6,
                fontSize: 10, fontFamily: "monospace",
                display: "flex", alignItems: "center", gap: 4,
              }}>
                {sentMeta.icon} {sentMeta.label}
              </span>
            )}
            <span style={{ fontSize: 11, color: "#3a5a7a", fontFamily: "monospace", marginLeft: "auto" }}>
              {articles.length} articles
            </span>
          </div>

          {loading ? (
            <div style={{ padding: "80px 0", textAlign: "center" }}>
              <div style={{
                display: "inline-block", width: 32, height: 32,
                border: "3px solid rgba(99,179,237,0.2)",
                borderTopColor: "#63b3ed",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                marginBottom: 16,
              }} />
              <p style={{ color: "#3a5a7a", fontFamily: "monospace", margin: 0 }}>
                Fetching {activeLabel} news...
              </p>
            </div>
          ) : articles.length === 0 ? (
            <div style={{ padding: "80px 0", textAlign: "center", color: "#3a5a7a" }}>
              <Newspaper size={40} style={{ marginBottom: 16, opacity: 0.4 }} />
              <p style={{ fontFamily: "monospace", fontSize: 14 }}>No news found for {activeLabel}</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Featured top story */}
              {featured && <ArticleCard article={featured} index={0} featured />}

              {/* Grid for rest */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                {rest.map((a, i) => (
                  <ArticleCard key={a.title + i} article={a} index={i + 1} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Stock Info Panel */}
        <div style={{
          borderLeft: "1px solid rgba(255,255,255,0.05)",
          padding: "24px 20px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}>
          {/* Stock Snapshot */}
          <div style={{
            background: "rgba(8,16,32,0.6)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: "18px",
          }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#4a6a8a", fontFamily: "monospace", marginBottom: 8, textTransform: "uppercase" }}>
              {activeLabel}
            </div>
            {stockData ? (
              <>
                <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Orbitron', monospace", color: "#e2e8f0" }}>
                  ₹{fmt(stockData.price)}
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, marginTop: 4,
                  color: stockData.change_pct >= 0 ? "#00e676" : "#ff4b4b",
                  fontSize: 13, fontWeight: 600,
                }}>
                  {stockData.change_pct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {stockData.change_pct >= 0 ? "+" : ""}{fmt(stockData.change_pct)}% today
                </div>
              </>
            ) : (
              <div style={{ color: "#3a5a7a", fontSize: 13, fontFamily: "monospace" }}>
                {loading ? "Loading..." : "Click 'Analyze' to fetch price"}
              </div>
            )}
          </div>

          {/* Sentiment Summary */}
          {sentimentData && (
            <div style={{
              background: "rgba(8,16,32,0.6)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 14,
              padding: "18px",
            }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#4a6a8a", fontFamily: "monospace", marginBottom: 12, textTransform: "uppercase" }}>
                AI Sentiment Analysis
              </div>

              {/* Score gauge */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#3a5a7a", fontFamily: "monospace" }}>Bearish</span>
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: sentMeta?.color,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {sentimentData.aggregate.score > 0 ? "+" : ""}
                    {fmt(sentimentData.aggregate.score)}
                  </span>
                  <span style={{ fontSize: 11, color: "#3a5a7a", fontFamily: "monospace" }}>Bullish</span>
                </div>
                <div style={{
                  height: 6, background: "rgba(255,255,255,0.06)",
                  borderRadius: 99, overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(Math.max((sentimentData.aggregate.score + 1) / 2 * 100, 2), 98)}%`,
                    background: `linear-gradient(90deg, #ff4b4b, ${sentMeta?.color ?? "#ffc107"})`,
                    borderRadius: 99,
                    transition: "width 0.6s ease",
                  }} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, color: "#3a5a7a", fontFamily: "monospace" }}>Signal</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: sentMeta?.color, fontFamily: "monospace" }}>
                    {sentimentData.aggregate.label}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "#3a5a7a", fontFamily: "monospace" }}>Confidence</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#63b3ed", fontFamily: "monospace" }}>
                    {fmt(sentimentData.aggregate.confidence * 100)}%
                  </div>
                </div>
              </div>

              {/* Article count */}
              <div style={{
                marginTop: 12, paddingTop: 12,
                borderTop: "1px solid rgba(255,255,255,0.05)",
                fontSize: 11, color: "#3a5a7a", fontFamily: "monospace",
              }}>
                Based on {sentimentData.layers.news.article_count} news articles
              </div>
            </div>
          )}

          {/* Explore other tickers */}
          <div style={{
            background: "rgba(8,16,32,0.6)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: "18px",
          }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#4a6a8a", fontFamily: "monospace", marginBottom: 12, textTransform: "uppercase" }}>
              Explore Other Stocks
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {POPULAR_TICKERS.filter(t => t.ticker !== activeTicker).slice(0, 8).map(t => (
                <button
                  key={t.ticker}
                  onClick={() => setActiveTicker(t.ticker)}
                  className="news-ticker-btn"
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 8, padding: "8px 12px",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    color: "#7a9ab0",
                    fontSize: 12, fontFamily: "monospace",
                    transition: "all 0.15s",
                  }}
                >
                  {t.label}
                  <ChevronRight size={12} color="#3a5a7a" />
                </button>
              ))}
            </div>
          </div>

          {/* Quick action */}
          <button
            onClick={() => window.open(`/swing?ticker=${activeTicker}`, "_self")}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, rgba(0,230,118,0.12), rgba(0,180,100,0.06))",
              border: "1px solid rgba(0,230,118,0.25)",
              borderRadius: 10, padding: "12px",
              cursor: "pointer", color: "#00e676",
              fontSize: 13, fontWeight: 600, fontFamily: "monospace",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s",
            }}
          >
            <Activity size={14} /> Analyze {activeLabel} Signal
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockNewsPage;
