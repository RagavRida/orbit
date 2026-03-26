import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Phone,
  PhoneOff,
  Volume2,
  Info,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Startup, INDUSTRY_COLORS } from "../types";
import { GlobeMode, MODES } from "../lib/modes";
import DubbingBar from "./DubbingBar";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Exchange {
  host: string;
  text: string;
}

interface RadioPanelProps {
  selectedStartup: Startup | null;
  isPlaying: boolean;
  isCalling: boolean;
  globeMode: GlobeMode;
  exchanges: Exchange[];
  onTogglePlay: () => void;
  onCall: () => void;
  onNext: () => void;
  onPrev: () => void;
  onShowInfo: () => void;
  onShowNewspaper: () => void;
  onDub: (langCode: string) => void;
  dubbingLanguage: string | null;
  isDubbing: boolean;
  techInfo: { firecrawl: string; elevenlabs: string } | null;
}

const RadioPanel: React.FC<RadioPanelProps> = ({
  selectedStartup,
  isPlaying,
  isCalling,
  globeMode,
  exchanges,
  onTogglePlay,
  onCall,
  onNext,
  onPrev,
  onShowInfo,
  onShowNewspaper,
  onDub,
  dubbingLanguage,
  isDubbing,
  techInfo,
}) => {
  const [eqBars, setEqBars] = useState<number[]>(new Array(12).fill(20));
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setEqBars(new Array(12).fill(0).map(() => Math.random() * 60 + 10));
      }, 100);
      return () => clearInterval(interval);
    } else {
      setEqBars(new Array(12).fill(10));
    }
  }, [isPlaying]);

  if (!selectedStartup) return null;

  const color = INDUSTRY_COLORS[selectedStartup.industry] || INDUSTRY_COLORS.Other;
  const modeConfig = MODES[globeMode];

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 w-[95%] sm:w-[90%] max-w-2xl z-50"
    >
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl">
        {/* 1. Mode Indicator Bar */}
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-sm">{modeConfig.icon}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
              {modeConfig.label} Mode
            </span>
            <span className="text-[9px] text-white/25">·</span>
            <span className="text-[9px] text-white/25">{modeConfig.elevenlabsFeature}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-[8px] font-mono text-orange-400/80">
              🔥 Firecrawl
            </span>
            <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-[8px] font-mono text-purple-400/80">
              🎧 ElevenLabs
            </span>
          </div>
        </div>

        {/* 2. Now Playing */}
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Station Card */}
          <div className="flex-shrink-0 relative group">
            <div
              className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl bg-cover bg-center border-2 border-white/20 overflow-hidden"
              style={{ backgroundImage: `url(${selectedStartup.logo})` }}
            />
            <div
              className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: color }}
            >
              {selectedStartup.industry}
            </div>
          </div>

          {/* Info & Controls */}
          <div className="flex-grow min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white truncate">
                  {selectedStartup.name}
                </h2>
                <p className="text-xs text-white/50 truncate">
                  {selectedStartup.city}, {selectedStartup.country}
                </p>
              </div>
              <button
                onClick={onShowInfo}
                className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              >
                <Info size={18} />
              </button>
            </div>

            <p className="text-sm text-white/80 italic line-clamp-1 mb-3">
              "{selectedStartup.tagline}"
            </p>

            {/* EQ Bars */}
            <div className="flex items-end gap-1 h-6 sm:h-8 mb-3">
              {eqBars.map((height, i) => (
                <motion.div
                  key={i}
                  animate={{ height: `${height}%` }}
                  className="w-1 rounded-full"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <button onClick={onPrev} className="text-white/50 hover:text-white transition-colors">
                  <SkipBack size={20} />
                </button>
                <button
                  onClick={onTogglePlay}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-black transition-transform hover:scale-105"
                  style={{ backgroundColor: color }}
                >
                  {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
                </button>
                <button onClick={onNext} className="text-white/50 hover:text-white transition-colors">
                  <SkipForward size={20} />
                </button>

                <div className="w-px h-8 bg-white/10 mx-1" />

                <button
                  onClick={onCall}
                  className={cn(
                    "w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all hover:scale-105",
                    isCalling ? "bg-red-500 text-white animate-pulse" : "bg-white/10 text-white hover:bg-white/20"
                  )}
                >
                  {isCalling ? <PhoneOff size={20} /> : <Phone size={20} />}
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-white/30 text-[10px] font-mono uppercase tracking-widest">
                <Volume2 size={12} />
                <span>Now Playing</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Transcript (collapsible) */}
        {exchanges.length > 0 && (
          <div className="mt-3 border-t border-white/5 pt-3">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="flex items-center gap-1 text-[10px] text-white/30 uppercase tracking-widest font-bold hover:text-white/50 transition-colors"
            >
              {showTranscript ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Transcript ({exchanges.length} exchanges)
            </button>
            <AnimatePresence>
              {showTranscript && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-2 max-h-32 overflow-y-auto space-y-1.5"
                >
                  {exchanges.map((ex, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={`font-bold flex-shrink-0 ${ex.host === "Alex" ? "text-blue-400" : "text-emerald-400"}`}>
                        {ex.host}:
                      </span>
                      <span className="text-white/60">{ex.text}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* 4. Dubbing Bar + Newspaper Button */}
        {exchanges.length > 0 && !isPlaying && (
          <div className="flex items-center justify-between mt-2">
            <DubbingBar
              visible={true}
              activeLanguage={dubbingLanguage}
              isLoading={isDubbing}
              onSelectLanguage={onDub}
            />
            <button
              onClick={onShowNewspaper}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[10px] text-white/40 hover:text-white/70 transition-colors font-bold"
            >
              <BookOpen size={12} /> Read
            </button>
          </div>
        )}

        {/* 5. Tech Strip */}
        {techInfo && (
          <div className="mt-3 pt-2 border-t border-white/5 flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-[9px] font-mono text-orange-400/50">
              Firecrawl: {techInfo.firecrawl}
            </span>
            <span className="text-[9px] font-mono text-purple-400/50">
              ElevenLabs: {techInfo.elevenlabs}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default RadioPanel;
