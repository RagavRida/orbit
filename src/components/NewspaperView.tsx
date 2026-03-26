import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Share2 } from "lucide-react";

interface Exchange {
  host: string;
  text: string;
}

interface NewspaperViewProps {
  visible: boolean;
  startupName: string;
  tension: string;
  exchanges: Exchange[];
  onClose: () => void;
}

const NewspaperView: React.FC<NewspaperViewProps> = ({
  visible,
  startupName,
  tension,
  exchanges,
  onClose,
}) => {
  const alexLines = exchanges.filter((e) => e.host === "Alex");
  const samLines = exchanges.filter((e) => e.host === "Sam");
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleShare = () => {
    const text = `🎙 Just listened to a debate about ${startupName} on Orbit — "${tension}" — powered by Firecrawl + ElevenLabs`;
    navigator.clipboard.writeText(text);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-[150] overflow-y-auto"
        >
          <div
            className="min-h-screen px-6 py-8 sm:px-12 sm:py-12"
            style={{ backgroundColor: "#f5f0e8", color: "#1a1a2e" }}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="fixed top-6 right-6 z-10 w-10 h-10 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20 transition-colors"
            >
              <X size={20} color="#1a1a2e" />
            </button>

            <div className="max-w-3xl mx-auto">
              {/* Masthead */}
              <div className="text-center border-b-4 border-double border-[#1a1a2e] pb-4 mb-6">
                <h1
                  className="text-4xl sm:text-5xl font-bold tracking-tight"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  THE ORBIT TIMES
                </h1>
                <p className="text-xs text-[#1a1a2e]/50 mt-1 uppercase tracking-[0.2em]">
                  Generated · {date} · {startupName}
                </p>
              </div>

              {/* Headline */}
              <h2
                className="text-2xl sm:text-3xl font-bold text-center mb-8 leading-tight"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {tension}
              </h2>

              {/* Two Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                {/* Alex's Column */}
                <div>
                  <p className="text-xs uppercase tracking-widest text-[#1a1a2e]/40 mb-2 font-bold">
                    By Alex · Skeptic
                  </p>
                  <div className="space-y-3">
                    {alexLines.map((line, i) => (
                      <p
                        key={i}
                        className="text-sm leading-relaxed"
                        style={{ fontFamily: "Georgia, serif" }}
                      >
                        {line.text}
                      </p>
                    ))}
                  </div>
                  {alexLines.length > 0 && (
                    <blockquote className="mt-4 pl-4 border-l-2 border-[#1a1a2e]/20 italic text-[#1a1a2e]/60 text-sm">
                      "{alexLines[0].text}"
                    </blockquote>
                  )}
                </div>

                {/* Divider on mobile */}
                <div className="sm:hidden border-t border-[#1a1a2e]/10" />

                {/* Sam's Column */}
                <div className="sm:border-l sm:border-[#1a1a2e]/10 sm:pl-8">
                  <p className="text-xs uppercase tracking-widest text-[#1a1a2e]/40 mb-2 font-bold">
                    By Sam · Optimist
                  </p>
                  <div className="space-y-3">
                    {samLines.map((line, i) => (
                      <p
                        key={i}
                        className="text-sm leading-relaxed"
                        style={{ fontFamily: "Georgia, serif" }}
                      >
                        {line.text}
                      </p>
                    ))}
                  </div>
                  {samLines.length > 0 && (
                    <blockquote className="mt-4 pl-4 border-l-2 border-[#1a1a2e]/20 italic text-[#1a1a2e]/60 text-sm">
                      "{samLines[samLines.length - 1].text}"
                    </blockquote>
                  )}
                </div>
              </div>

              {/* Bottom bar */}
              <div className="mt-10 pt-6 border-t border-[#1a1a2e]/10 flex items-center justify-between">
                <p className="text-[10px] text-[#1a1a2e]/30 uppercase tracking-widest">
                  Powered by Firecrawl + ElevenLabs
                </p>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/10 text-[11px] font-bold hover:bg-black/20 transition-colors"
                >
                  <Share2 size={12} /> Share
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NewspaperView;
