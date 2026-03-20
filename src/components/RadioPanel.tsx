import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, SkipBack, SkipForward, Mic, Volume2, Info, Phone, PhoneOff } from "lucide-react";
import { Startup, INDUSTRY_COLORS } from "../types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface RadioPanelProps {
  selectedStartup: Startup | null;
  isPlaying: boolean;
  isCalling: boolean;
  onTogglePlay: () => void;
  onCall: () => void;
  onNext: () => void;
  onPrev: () => void;
  onShowInfo: () => void;
}

const RadioPanel: React.FC<RadioPanelProps> = ({
  selectedStartup,
  isPlaying,
  isCalling,
  onTogglePlay,
  onCall,
  onNext,
  onPrev,
  onShowInfo,
}) => {
  const [eqBars, setEqBars] = useState<number[]>(new Array(12).fill(20));

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

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl z-50"
    >
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl flex items-center gap-6">
        {/* Station Card */}
        <div className="flex-shrink-0 relative group">
          <div
            className="w-24 h-24 rounded-2xl bg-cover bg-center border-2 border-white/20 overflow-hidden"
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
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-xl font-bold text-white truncate">{selectedStartup.name}</h2>
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

          <p className="text-sm text-white/80 italic line-clamp-1 mb-4">
            "{selectedStartup.tagline}"
          </p>

          {/* EQ Bars */}
          <div className="flex items-end gap-1 h-8 mb-4">
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
            <div className="flex items-center gap-4">
              <button onClick={onPrev} className="text-white/50 hover:text-white transition-colors">
                <SkipBack size={20} />
              </button>
              <button
                onClick={onTogglePlay}
                className="w-12 h-12 rounded-full flex items-center justify-center text-black transition-transform hover:scale-105"
                style={{ backgroundColor: color }}
              >
                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
              </button>
              <button onClick={onNext} className="text-white/50 hover:text-white transition-colors">
                <SkipForward size={20} />
              </button>
              
              <div className="w-px h-8 bg-white/10 mx-2" />
              
              <button
                onClick={onCall}
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105",
                  isCalling ? "bg-red-500 text-white animate-pulse" : "bg-white/10 text-white hover:bg-white/20"
                )}
              >
                {isCalling ? <PhoneOff size={20} /> : <Phone size={20} />}
              </button>
            </div>

            <div className="flex items-center gap-2 text-white/30 text-[10px] font-mono uppercase tracking-widest">
              <Volume2 size={12} />
              <span>Now Playing</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default RadioPanel;
