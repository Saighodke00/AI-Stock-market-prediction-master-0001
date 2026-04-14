import React, { useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SinglePattern {
  name: string;
  type: string;        // "bullish" | "bearish" | "neutral"
  strength: number;    // 0–1 confidence
  target?: number;
  breakout?: number;
  description?: string;
  emoji?: string;
}

interface TopPattern {
  name: string;
  emoji: string;
  type: string;        // "Bullish" | "Bearish" | "Neutral" (capitalised from API)
  count: number;
}

interface Props {
  /** The `pattern` field from /api/signal response (top pattern summary) */
  patterns?: TopPattern | null;
  /** The `patterns` array from /api/patterns response (full list) */
  patternList?: SinglePattern[];
  /** Optional: override ticker label */
  ticker?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Signal = "BUY" | "SELL" | "HOLD";

/**
 * Derives a single consensus signal from a list of patterns.
 * Weights each pattern by its confidence score.
 */
function deriveConsensus(patternList: SinglePattern[]): {
  signal: Signal;
  bullScore: number;
  bearScore: number;
  totalPatterns: number;
  dominantPattern: string;
  dominantEmoji: string;
  confidence: number;
} {
  if (!patternList || patternList.length === 0) {
    return {
      signal: "HOLD",
      bullScore: 0,
      bearScore: 0,
      totalPatterns: 0,
      dominantPattern: "No Patterns",
      dominantEmoji: "📐",
      confidence: 0,
    };
  }

  let bullScore = 0;
  let bearScore = 0;
  let neutralScore = 0;

  patternList.forEach((p) => {
    const w = p.strength ?? 0.5;
    const t = (p.type ?? "").toLowerCase();
    if (t.includes("bull") || t === "reversal_bullish" || t === "continuation_bullish") {
      bullScore += w;
    } else if (t.includes("bear") || t === "reversal_bearish" || t === "continuation_bearish") {
      bearScore += w;
    } else {
      neutralScore += w;
    }
  });

  const total = bullScore + bearScore + neutralScore || 1;
  const bullPct = bullScore / total;
  const bearPct = bearScore / total;

  let signal: Signal = "HOLD";
  let confidence = 0;

  if (bullPct > 0.55) {
    signal = "BUY";
    confidence = bullPct;
  } else if (bearPct > 0.55) {
    signal = "SELL";
    confidence = bearPct;
  } else {
    signal = "HOLD";
    confidence = Math.max(bullPct, bearPct, 0.33);
  }

  // Best pattern by strength
  const best = [...patternList].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))[0];

  return {
    signal,
    bullScore: Math.round(bullPct * 100),
    bearScore: Math.round(bearPct * 100),
    totalPatterns: patternList.length,
    dominantPattern: best?.name ?? "None",
    dominantEmoji: best?.emoji ?? "📐",
    confidence: Math.round(confidence * 100),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Pulsing ring around the signal badge */
const PulseRing: React.FC<{ color: string }> = ({ color }) => (
  <span
    style={{
      position: "absolute",
      inset: -6,
      borderRadius: "50%",
      border: `2px solid ${color}`,
      opacity: 0.4,
      animation: "apexPulse 2s ease-in-out infinite",
      pointerEvents: "none",
    }}
  />
);

/** Thin progress bar showing bull/bear split */
const SplitBar: React.FC<{ bull: number; bear: number }> = ({ bull, bear }) => {
  const neutral = Math.max(0, 100 - bull - bear);
  return (
    <div
      style={{
        display: "flex",
        height: 5,
        borderRadius: 99,
        overflow: "hidden",
        gap: 2,
        width: "100%",
      }}
    >
      <div
        style={{
          flex: bull,
          background: "linear-gradient(90deg,#00e676,#00b248)",
          borderRadius: "99px 0 0 99px",
          transition: "flex 0.8s ease",
        }}
      />
      <div
        style={{
          flex: neutral,
          background: "rgba(255,255,255,0.12)",
          transition: "flex 0.8s ease",
        }}
      />
      <div
        style={{
          flex: bear,
          background: "linear-gradient(90deg,#ff4b4b,#d50000)",
          borderRadius: "0 99px 99px 0",
          transition: "flex 0.8s ease",
        }}
      />
    </div>
  );
};

// ─── Signal config ────────────────────────────────────────────────────────────

const SIGNAL_CONFIG = {
  BUY: {
    label: "BUY",
    icon: "▲",
    color: "#00e676",
    glow: "rgba(0,230,118,0.35)",
    dimGlow: "rgba(0,230,118,0.08)",
    border: "rgba(0,230,118,0.30)",
    badge: "rgba(0,230,118,0.14)",
    tagline: "Patterns confirm bullish breakout momentum",
  },
  SELL: {
    label: "SELL",
    icon: "▼",
    color: "#ff4b4b",
    glow: "rgba(255,75,75,0.35)",
    dimGlow: "rgba(255,75,75,0.08)",
    border: "rgba(255,75,75,0.30)",
    badge: "rgba(255,75,75,0.14)",
    tagline: "Pattern confluence signals distribution phase",
  },
  HOLD: {
    label: "HOLD",
    icon: "●",
    color: "#ffc107",
    glow: "rgba(255,193,7,0.30)",
    dimGlow: "rgba(255,193,7,0.06)",
    border: "rgba(255,193,7,0.25)",
    badge: "rgba(255,193,7,0.12)",
    tagline: "Conflicting patterns — wait for clearer setup",
  },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const PatternSignalSummary: React.FC<Props> = ({
  patterns,
  patternList,
  ticker = "",
}) => {
  const consensus = useMemo(
    () => deriveConsensus(patternList ?? []),
    [patternList]
  );

  // If no pattern data at all, derive from the `patterns` prop top-level object
  const resolvedSignal: Signal = useMemo(() => {
    if (patternList && patternList.length > 0) return consensus.signal;
    if (!patterns) return "HOLD";
    const t = (patterns.type ?? "").toLowerCase();
    if (t.includes("bull")) return "BUY";
    if (t.includes("bear")) return "SELL";
    return "HOLD";
  }, [patternList, patterns, consensus]);

  const cfg = SIGNAL_CONFIG[resolvedSignal];

  return (
    <>
      {/* ── Keyframe injection ─────────────────────────────────────────────── */}
      <style>{`
        @keyframes apexPulse {
          0%,100% { transform:scale(1); opacity:0.4; }
          50%      { transform:scale(1.18); opacity:0.12; }
        }
        .apex-stat:hover {
          background: rgba(255,255,255,0.05);
        }
      `}</style>
      
      <div 
        style={{
          boxShadow: `0 8px 32px 0 ${cfg.dimGlow}`,
          borderColor: cfg.border
        }}
        className="w-full bg-base border rounded-xl p-6 relative overflow-hidden text-white flex flex-col gap-6"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10 relative">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-muted">
              Pattern Consensus Signal
            </span>
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-full" style={{ background: cfg.badge }}>
                <PulseRing color={cfg.color} />
                <span style={{ color: cfg.color }} className="text-sm font-bold z-10">{cfg.icon}</span>
              </div>
              <h2 style={{ color: cfg.color }} className="text-3xl font-display font-black tracking-tight m-0">
                {cfg.label}
              </h2>
            </div>
            <span className="text-xs text-secondary mt-1">{cfg.tagline}</span>
          </div>
          
          <div className="flex flex-col gap-2 min-w-[200px]">
            <div className="flex justify-between items-center text-xs font-bold font-display">
              <span className="text-emerald-400">Bull {consensus.bullScore}%</span>
              <span className="text-muted">Hold</span>
              <span className="text-rose-500">Bear {consensus.bearScore}%</span>
            </div>
            <SplitBar bull={consensus.bullScore} bear={consensus.bearScore} />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] p-4 rounded-lg border border-dim z-10 relative">
          <div className="flex items-center gap-2">
            <span className="text-xl">{consensus.dominantEmoji}</span>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted uppercase tracking-wider font-bold">Dominant Pattern</span>
              <span className="text-sm font-medium">{consensus.dominantPattern}</span>
            </div>
          </div>
          <div className="h-8 w-px bg-border-mid hidden sm:block"></div>
          <div className="flex flex-col sm:items-end">
            <span className="text-[10px] text-muted uppercase tracking-wider font-bold">Total Signatures</span>
            <span className="text-sm font-medium text-emerald-400">{consensus.totalPatterns} detected</span>
          </div>
        </div>
      </div>
    </>
  );
};
