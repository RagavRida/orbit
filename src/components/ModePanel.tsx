import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { TrendingUp, TrendingDown, Minus, DollarSign, Search, Newspaper, X } from "lucide-react";
import { INDUSTRY_COLORS } from "../types";

// ── Sentiment Panel ──
interface SentimentData {
  sentiment: "positive" | "negative" | "neutral";
  score: number;
  sources: number;
  topHeadline: string;
}

export const SentimentPanel: React.FC<{
  data: SentimentData | null;
  loading: boolean;
  startupName: string;
}> = ({ data, loading, startupName }) => {
  if (!data && !loading) return null;

  const sentimentColor =
    data?.sentiment === "positive" ? "#22c55e" :
    data?.sentiment === "negative" ? "#ef4444" : "#94a3b8";

  const SentimentIcon =
    data?.sentiment === "positive" ? TrendingUp :
    data?.sentiment === "negative" ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="fixed top-32 right-8 z-40 w-[300px]"
    >
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${sentimentColor}20` }}>
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <SentimentIcon size={18} style={{ color: sentimentColor }} />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Sentiment Analysis</h3>
            <p className="text-[10px] text-white/40">{startupName}</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-3 bg-white/5 rounded animate-pulse" />
            <div className="h-3 bg-white/5 rounded animate-pulse w-3/4" />
          </div>
        ) : data ? (
          <>
            {/* Score Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-[10px] text-white/30 mb-1">
                <span>Negative</span>
                <span>Positive</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: "50%" }}
                  animate={{ width: `${Math.max(5, (data.score + 100) / 2)}%` }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: sentimentColor }}
                />
              </div>
              <div className="text-center mt-1">
                <span className="text-2xl font-black" style={{ color: sentimentColor }}>
                  {data.score > 0 ? "+" : ""}{data.score}
                </span>
              </div>
            </div>

            {/* Top Headline */}
            <div className="bg-white/5 rounded-xl p-3 mb-3">
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-1">Top Headline</p>
              <p className="text-xs text-white/80 leading-relaxed">{data.topHeadline}</p>
            </div>

            <div className="flex items-center justify-between text-[10px] text-white/30">
              <span>{data.sources} sources analyzed</span>
              <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-mono">Firecrawl /search</span>
            </div>
          </>
        ) : null}
      </div>
    </motion.div>
  );
};

// ── Pricing Panel ──
interface PricingTier {
  name: string;
  price: string;
  period: string;
  features: string[];
}

interface PricingData {
  hasPricing: boolean;
  tiers: PricingTier[];
  freeTrialAvailable: boolean;
  summary: string;
}

export const PricingPanel: React.FC<{
  data: PricingData | null;
  loading: boolean;
  startupName: string;
}> = ({ data, loading, startupName }) => {
  if (!data && !loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="fixed top-32 right-8 z-40 w-[340px] max-h-[70vh] overflow-y-auto"
    >
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <DollarSign size={18} className="text-emerald-400" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Pricing Intel</h3>
            <p className="text-[10px] text-white/40">{startupName}</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-16 bg-white/5 rounded-xl animate-pulse" />
            <div className="h-16 bg-white/5 rounded-xl animate-pulse" />
          </div>
        ) : data ? (
          <>
            {data.summary && (
              <p className="text-xs text-white/60 mb-3 italic">{data.summary}</p>
            )}

            {data.freeTrialAvailable && (
              <div className="px-2 py-1 rounded bg-emerald-500/15 text-[10px] text-emerald-400 font-bold mb-3 inline-block">
                ✓ Free Trial Available
              </div>
            )}

            {data.tiers.length > 0 ? (
              <div className="space-y-2">
                {data.tiers.map((tier, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-white">{tier.name}</h4>
                      <div className="text-right">
                        <span className="text-lg font-black text-emerald-400">{tier.price}</span>
                        {tier.period && <span className="text-[10px] text-white/30 ml-1">/{tier.period}</span>}
                      </div>
                    </div>
                    {tier.features?.length > 0 && (
                      <ul className="space-y-1">
                        {tier.features.slice(0, 4).map((f, j) => (
                          <li key={j} className="text-[11px] text-white/50 flex items-start gap-1.5">
                            <span className="text-emerald-400/60 mt-0.5">•</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/40">No pricing tiers found</p>
            )}

            <div className="mt-3 flex items-center gap-2 text-[10px] text-white/30">
              <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-mono">Firecrawl /scrape</span>
              <span>scraped /pricing page</span>
            </div>
          </>
        ) : null}
      </div>
    </motion.div>
  );
};

// ── Research Panel ──
interface ResearchData {
  keyFacts: string[];
  fundingStage: string;
  competitors: string[];
  verdict: "invest" | "watch" | "pass";
  exchanges?: { host: string; text: string }[];
}

export const ResearchPanel: React.FC<{
  data: ResearchData | null;
  loading: boolean;
  startupName: string;
}> = ({ data, loading, startupName }) => {
  if (!data && !loading) return null;

  const verdictColor =
    data?.verdict === "invest" ? "#22c55e" :
    data?.verdict === "pass" ? "#ef4444" : "#f59e0b";

  const verdictEmoji =
    data?.verdict === "invest" ? "🟢" :
    data?.verdict === "pass" ? "🔴" : "🟡";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="fixed top-32 right-8 z-40 w-[320px] max-h-[70vh] overflow-y-auto"
    >
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Search size={18} className="text-blue-400" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Research Briefing</h3>
            <p className="text-[10px] text-white/40">{startupName}</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-3 bg-white/5 rounded animate-pulse" />
            <div className="h-3 bg-white/5 rounded animate-pulse w-2/3" />
            <div className="h-16 bg-white/5 rounded-xl mt-3 animate-pulse" />
          </div>
        ) : data ? (
          <>
            {/* Verdict */}
            <div className="flex items-center justify-between bg-white/5 rounded-xl p-3 mb-3 border border-white/5">
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Verdict</p>
                <p className="text-lg font-black uppercase" style={{ color: verdictColor }}>
                  {verdictEmoji} {data.verdict}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Funding</p>
                <p className="text-sm font-bold text-white">{data.fundingStage}</p>
              </div>
            </div>

            {/* Key Facts */}
            {data.keyFacts?.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2">Key Facts</p>
                <ul className="space-y-1.5">
                  {data.keyFacts.map((fact, i) => (
                    <li key={i} className="text-[11px] text-white/60 flex items-start gap-1.5">
                      <span className="text-blue-400/60 font-bold mt-px">{i + 1}.</span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Competitors */}
            {data.competitors?.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-2">Competitors</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.competitors.map((c, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-white/60 border border-white/5">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-[10px] text-white/30 mt-3">
              <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-mono">Firecrawl ×3</span>
              <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 font-mono">ElevenLabs TTS</span>
            </div>
          </>
        ) : null}
      </div>
    </motion.div>
  );
};

// ── Changes Panel ──
interface ChangeEntry {
  date: string;
  type: "funding" | "product" | "team" | "news";
  title: string;
  detail: string;
}

export const ChangesPanel: React.FC<{
  entries: ChangeEntry[];
  loading: boolean;
  startupName: string;
}> = ({ entries, loading, startupName }) => {
  if (entries.length === 0 && !loading) return null;

  const typeIcons: Record<string, string> = {
    funding: "💰", product: "🚀", team: "👥", news: "📰",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="fixed top-32 right-8 z-40 w-[300px] max-h-[60vh] overflow-y-auto"
    >
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Newspaper size={18} className="text-amber-400" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Recent Changes</h3>
            <p className="text-[10px] text-white/40">{startupName}</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
            <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{typeIcons[entry.type] || "📋"}</span>
                  <span className="text-[10px] text-white/30 font-mono">{entry.date}</span>
                  <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-white/40 uppercase font-bold">
                    {entry.type}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white mb-0.5">{entry.title}</h4>
                <p className="text-[11px] text-white/50">{entry.detail}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 text-[10px] text-white/30">
          <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-mono">Firecrawl /search</span>
        </div>
      </div>
    </motion.div>
  );
};
