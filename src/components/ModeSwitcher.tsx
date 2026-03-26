import React from "react";
import { motion } from "motion/react";
import { GlobeMode, MODE_LIST, MODES } from "../lib/modes";

interface ModeSwitcherProps {
  activeMode: GlobeMode;
  onModeChange: (mode: GlobeMode) => void;
}

const ModeSwitcher: React.FC<ModeSwitcherProps> = ({
  activeMode,
  onModeChange,
}) => {
  return (
    <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-[40px] p-1 flex items-center gap-1 shadow-2xl">
        {MODE_LIST.map(([key, mode], index) => {
          const isActive = activeMode === key;
          return (
            <div key={key} className="relative group">
              <motion.button
                onClick={() => onModeChange(key)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-[30px] text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? "bg-white text-black shadow-lg"
                    : "bg-transparent text-white/50 hover:text-white/80 hover:bg-white/10"
                }`}
              >
                <span className="text-sm">{mode.icon}</span>
                <span className="hidden sm:inline">{mode.label}</span>
                {/* Keyboard shortcut badge */}
                <span
                  className={`hidden lg:inline text-[9px] font-mono ml-0.5 ${
                    isActive ? "text-black/40" : "text-white/25"
                  }`}
                >
                  {index + 1}
                </span>
              </motion.button>

              {/* Tooltip */}
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[60]">
                <div className="bg-black/90 backdrop-blur-md border border-white/10 rounded-xl p-3 text-[11px] whitespace-nowrap shadow-xl">
                  <p className="text-white font-semibold mb-1.5">
                    {mode.description}
                  </p>
                  <div className="flex flex-col gap-1">
                    <span className="text-orange-400/80 font-mono">
                      🔥 Firecrawl: {mode.firecrawlEndpoint}
                    </span>
                    <span className="text-purple-400/80 font-mono">
                      🎧 ElevenLabs: {mode.elevenlabsFeature}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ModeSwitcher;
