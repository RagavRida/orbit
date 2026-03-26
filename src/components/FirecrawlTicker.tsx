import React from "react";
import { motion, AnimatePresence } from "motion/react";

export interface CrawlEntry {
  timestamp: string;
  action: string;
  url: string;
  status: "loading" | "done" | "error";
  result?: string;
}

interface FirecrawlTickerProps {
  entries: CrawlEntry[];
}

const FirecrawlTicker: React.FC<FirecrawlTickerProps> = ({ entries }) => {
  if (entries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="fixed bottom-8 left-8 z-40 w-[280px]"
    >
      <div className="bg-black/80 backdrop-blur-xl border border-orange-500/20 rounded-xl p-3 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
          <span className="text-[9px] font-mono font-bold text-orange-400 uppercase tracking-widest">
            Firecrawl Live
          </span>
        </div>

        {/* Entries */}
        <div className="space-y-1">
          <AnimatePresence>
            {entries.slice(0, 5).map((entry, i) => (
              <motion.div
                key={`${entry.timestamp}-${i}`}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-[9px] font-mono"
              >
                <span className="text-white/30 flex-shrink-0">
                  {entry.timestamp}
                </span>
                <span className="text-orange-400/80 flex-shrink-0">
                  {entry.action}
                </span>
                <span className="text-white/50 truncate">{entry.url}</span>
                {entry.status === "done" && entry.result && (
                  <span className="text-emerald-400/80 flex-shrink-0">
                    → {entry.result}
                  </span>
                )}
                {entry.status === "loading" && (
                  <span className="text-orange-400 animate-pulse flex-shrink-0">
                    …
                  </span>
                )}
                {entry.status === "error" && (
                  <span className="text-red-400 flex-shrink-0">✗</span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default FirecrawlTicker;
