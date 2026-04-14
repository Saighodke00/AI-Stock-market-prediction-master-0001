import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
  if (score > 0.2) return { label: "BULLISH", colorClass: "text-emerald", bgClass: "bg-emerald/10 border border-emerald/20", icon: <CheckCircle2 size={11} /> };
  if (score < -0.2) return { label: "BEARISH", colorClass: "text-rose", bgClass: "bg-rose/10 border border-rose/20", icon: <AlertTriangle size={11} /> };
  return { label: "NEUTRAL", colorClass: "text-amber", bgClass: "bg-amber/10 border border-amber/20", icon: <Minus size={11} /> };
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
      className={"flex  hover:border-border-bright hover:bg-white/10 transition-all cursor-[] group"}
      style={{ animation: "slide-in-right 0.3s ease-out s backwards" }}
    >
      {/* Left: sentiment bar */}
      {!featured && (
        <div className={"w-[3px] rounded-full shrink-0 min-h-[48px] opacity-80 `} />
      )}

      <div className="flex-1 min-w-0">
        {/* Meta row */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {featured && (
            <span className="font-data-small bg-cyan/10 text-cyan border border-cyan/20 px-1.5 py-0.5 rounded tracking-widest uppercase">
              TOP STORY
            </span>
          )}
          {article.ticker && (
            <span className="font-data-small bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded uppercase">
              {article.ticker.replace(".NS", "").replace(".BO", "")}
            </span>
          )}
          <span className="font-data-small text-text-muted">
            {article.source}
          </span>
          {article.published && (
            <>
              <span className="text-[10px] text-text-muted opacity-50">·</span>
              <span className="font-data-small text-text-muted flex items-center gap-1">
                <Clock size={9} /> {timeAgo(article.published)}
              </span>
            </>
          )}
          <span className={"ml-auto flex items-center gap-1 font-data-small "}>
            {sm.icon} {sm.label}
          </span>
        </div>

        {/* Title */}
        <p className={"m-0 text-text-primary leading-relaxed "}>
          {article.title}
        </p>

        {/* Summary */}
        {featured && article.summary && (
          <p className="mt-2 text-xs text-text-secondary leading-relaxed line-clamp-2">
            {article.summary}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 mt-2">
          <span className="font-data-small text-text-muted">
            Score: {article.score > 0 ? "+" : ""}{fmt(article.score)}
          </span>
          {article.url && (
            <span className="ml-auto flex items-center gap-1 font-data text-[10px] text-text-muted group-hover:text-cyan transition-colors">
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
    className={"font-data-small px-3 py-1.5 rounded-lg border transition-all shrink-0 "}
  >
    {label}
  </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const StockNewsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialTicker = searchParams.get("ticker") || "";

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
      const [matrixRes, newsRes] = await Promise.allSettled([
        fetch("/api/sentiment/"),
        fetch("/api/sentiment//news?page=1&limit=25"),
      ]);

      if (matrixRes.status === "fulfilled" && matrixRes.value.ok) {
        const d = await matrixRes.value.json();
        setSentimentData(d);
      }

      if (newsRes.status === "fulfilled" && newsRes.value.ok) {
        const d = await newsRes.value.json();
        setArticles((d.news || []).map((n: any) => ({ ...n, ticker })));
      }

      try {
        const sigRes = await fetch("/api/signal/?mode=swing");
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
    const ticker = q.includes(".NS") || q.includes(".BO") ? q : ${q}.NS;
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
    <div className="page-container py-8 animate-page-in">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="pb-6 mb-6 border-b border-border-dim">
        <div className="flex items-center gap-3 mb-5">
          <Newspaper size={24} className="text-cyan" />
          <h1 className="m-0 text-2xl font-display font-bold text-text-primary tracking-wide">
            STOCK INTELLIGENCE
          </h1>
          <span className="font-data-tiny bg-emerald/10 text-emerald px-1.5 py-0.5 rounded tracking-widest ml-2">
            LIVE NEWS
          </span>
        </div>

        {/* ── Search Bar ──────────────────────────────────────────────────────── */}
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 mb-5">
          <div className="flex-1 flex items-center gap-2 bg-white/5 border border-cyan/20 rounded-lg px-3 py-2 min-w-[200px] focus-within:border-cyan/50 transition-colors">
            <Search size={15} className="text-text-muted" />
            <input
              ref={searchRef}
              type="text"
              value={customSearch}
              onChange={e => setCustomSearch(e.target.value)}
              placeholder="Search ticker... (e.g. RELIANCE, TCS)"
              className="w-full bg-transparent border-none outline-none text-text-primary text-sm font-data"
            />
            {customSearch && (
              <button
                type="button"
                onClick={() => setCustomSearch("")}
                className="bg-transparent border-none text-text-muted hover:text-white cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-5 py-2 bg-cyan/10 border border-cyan/30 rounded-lg text-cyan font-data text-sm font-bold glow-border-cyan hover:bg-cyan/20 transition-all"
          >
            SEARCH
          </button>
          <button
            type="button"
            onClick={() => fetchNews(activeTicker)}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-border-dim rounded-lg text-text-muted font-data text-xs hover:text-text-primary hover:border-border-bright transition-all"
          >
            <RefreshCw size={13} />
          </button>
        </form>

        {/* ── Popular Tickers ─────────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
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
      <div className="grid lg:grid-cols-[1fr_320px] gap-8">

        {/* LEFT: News Feed */}
        <div className="flex flex-col">
          {/* Section header */}
          <div className="flex items-center flex-wrap gap-3 mb-5">
            <h2 className="m-0 text-xl font-display font-bold text-text-primary tracking-wide">
              {activeLabel} News
            </h2>
            {sentMeta && (
              <span className={"font-data-small px-2 py-1 rounded-md flex items-center gap-1  `}>
                {sentMeta.icon} {sentMeta.label}
              </span>
            )}
            <span className="ml-auto text-xs text-text-muted font-data">
              {articles.length} articles
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-block w-8 h-8 border-2 border-cyan/20 border-t-cyan rounded-full animate-spin mb-4" />
              <p className="text-text-muted font-data text-sm">
                Fetching {activeLabel} news...
              </p>
            </div>
          ) : articles.length === 0 ? (
            <div className="py-16 text-center text-text-muted">
              <Newspaper size={40} className="mx-auto mb-4 opacity-40" />
              <p className="font-data text-sm">No news found for {activeLabel}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 custom-scrollbar">
              {/* Featured top story */}
              {featured && <ArticleCard article={featured} index={0} featured />}

              {/* Grid for rest */}
              <div className="flex flex-col gap-2 mt-1">
                {rest.map((a, i) => (
                  <ArticleCard key={a.title + i} article={a} index={i + 1} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Stock Info Panel */}
        <div className="flex flex-col gap-5">
          {/* Stock Snapshot */}
          <div className="glass border border-border-mid rounded-xl p-5">
            <div className="neon-label text-text-muted mb-2">
              {activeLabel} Overview
            </div>
            {stockData ? (
              <>
                <div className="font-display text-3xl font-black text-text-primary tracking-tight">
                  ₹{fmt(stockData.price)}
                </div>
                <div className={"flex items-center gap-1.5 mt-1 font-bold text-sm "}>
                  {stockData.change_pct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {stockData.change_pct >= 0 ? "+" : ""}{fmt(stockData.change_pct)}% today
                </div>
              </>
            ) : (
              <div className="text-text-muted text-xs font-data flex items-center gap-2 mt-2 h-8">
                {loading ? (
                  <><RefreshCw size={12} className="animate-spin" /> Loading price...</>
                ) : "Price unavailable"}
              </div>
            )}
          </div>

          {/* Sentiment Summary */}
          {sentimentData && (
            <div className="glass border border-border-mid rounded-xl p-5">
              <div className="neon-label text-text-muted mb-3">
                AI Sentiment Matrix
              </div>

              {/* Score gauge */}
              <div className="mb-4">
                <div className="flex items-center justify-between font-data-small text-text-muted mb-1.5">
                  <span>BEARISH</span>
                  <span className={"font-data font-bold text-sm `}>
                    {sentimentData.aggregate.score > 0 ? "+" : ""}{fmt(sentimentData.aggregate.score)}
                  </span>
                  <span>BULLISH</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: ${Math.min(Math.max((sentimentData.aggregate.score + 1) / 2 * 100, 2), 98)}%,
                      background: linear-gradient(90deg, #f43f5e, )
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div>
                  <div className="font-data-tiny text-text-muted">SIGNAL</div>
                  <div className={"font-data font-bold text-base `}>
                    {sentimentData.aggregate.label}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-data-tiny text-text-muted">CONFIDENCE</div>
                  <div className="font-data font-bold text-base text-cyan">
                    {fmt(sentimentData.aggregate.confidence * 100)}%
                  </div>
                </div>
              </div>

              {/* Article count */}
              <div className="mt-4 pt-3 border-t border-border-dim font-data text-[10px] text-text-muted">
                Analyzed {sentimentData.layers.news.article_count} real-time news sources
              </div>
            </div>
          )}

          {/* Explore other tickers */}
          <div className="glass border border-border-mid rounded-xl p-5">
            <div className="neon-label text-text-muted mb-3">
              Hot Sectors
            </div>
            <div className="flex flex-col gap-1.5">
              {POPULAR_TICKERS.filter(t => t.ticker !== activeTicker).slice(0, 5).map(t => (
                <button
                  key={t.ticker}
                  onClick={() => setActiveTicker(t.ticker)}
                  className="flex items-center justify-between w-full bg-white/5 border border-border-dim rounded-lg px-3 py-2 text-text-muted font-data text-xs hover:border-border-bright hover:text-text-primary hover:bg-white/10 cursor-pointer transition-all"
                >
                  {t.label}
                  <ChevronRight size={12} className="opacity-50" />
                </button>
              ))}
            </div>
          </div>

          {/* Quick action */}
          <button
            onClick={() => navigate(/swing?ticker=)}
            className="w-full flex items-center justify-center gap-2 p-3 bg-cyan/10 border border-cyan/30 rounded-xl text-cyan font-data text-sm font-bold glow-border-cyan hover:bg-cyan/20 transition-all shadow-[0_0_15px_rgba(0,210,255,0.15)]"
          >
            <Activity size={14} /> Analyze {activeLabel} 
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockNewsPage;
