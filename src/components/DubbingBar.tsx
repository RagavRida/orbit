import React from "react";
import { motion, AnimatePresence } from "motion/react";

const LANGUAGES = [
  { code: "hi", flag: "🇮🇳", name: "Hindi" },
  { code: "es", flag: "🇪🇸", name: "Spanish" },
  { code: "ja", flag: "🇯🇵", name: "Japanese" },
  { code: "fr", flag: "🇫🇷", name: "French" },
  { code: "de", flag: "🇩🇪", name: "German" },
  { code: "pt", flag: "🇧🇷", name: "Portuguese" },
  { code: "ar", flag: "🇸🇦", name: "Arabic" },
  { code: "ko", flag: "🇰🇷", name: "Korean" },
  { code: "zh", flag: "🇨🇳", name: "Chinese" },
  { code: "tr", flag: "🇹🇷", name: "Turkish" },
];

interface DubbingBarProps {
  visible: boolean;
  activeLanguage: string | null;
  isLoading: boolean;
  onSelectLanguage: (code: string) => void;
}

const DubbingBar: React.FC<DubbingBarProps> = ({
  visible,
  activeLanguage,
  isLoading,
  onSelectLanguage,
}) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="flex items-center gap-1 mt-3"
        >
          <span className="text-[9px] text-white/30 uppercase tracking-widest mr-2 font-bold">
            Dub
          </span>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => onSelectLanguage(lang.code)}
              disabled={isLoading}
              className={`text-lg transition-all hover:scale-125 relative ${
                activeLanguage === lang.code
                  ? "scale-110 opacity-100"
                  : "opacity-50 hover:opacity-80"
              } ${isLoading ? "cursor-wait" : "cursor-pointer"}`}
              title={lang.name}
            >
              {lang.flag}
              {activeLanguage === lang.code && (
                <motion.div
                  layoutId="dubbing-active"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"
                />
              )}
            </button>
          ))}
          {isLoading && (
            <span className="text-[9px] text-orange-400 ml-2 animate-pulse font-mono">
              Dubbing...
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DubbingBar;
