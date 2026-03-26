import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, X } from "lucide-react";
import { Startup, INDUSTRY_COLORS } from "../types";

interface CallOverlayProps {
  startup: Startup;
  isActive: boolean;
  duration: number;
  messages: { role: "user" | "assistant"; text: string }[];
  isMuted: boolean;
  onEndCall: () => void;
  onToggleMute: () => void;
}

const CallOverlay: React.FC<CallOverlayProps> = ({
  startup,
  isActive,
  duration,
  messages,
  isMuted,
  onEndCall,
  onToggleMute,
}) => {
  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const color = INDUSTRY_COLORS[startup.industry] || INDUSTRY_COLORS.Other;

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-between py-16 px-8"
          style={{ background: "rgba(0,0,0,0.92)" }}
        >
          {/* Top: Startup Info */}
          <div className="text-center">
            <div className="text-5xl mb-4">
              {startup.industry === "AI"
                ? "🤖"
                : startup.industry === "Fintech"
                ? "💳"
                : startup.industry === "Health"
                ? "🏥"
                : startup.industry === "Climate"
                ? "🌿"
                : startup.industry === "Consumer"
                ? "🛒"
                : "💼"}
            </div>
            <h2 className="text-[28px] font-light text-white mb-1">
              {startup.name}
            </h2>
            <p className="text-[15px] text-white/40">{startup.industry}</p>

            {/* Pulsing rings */}
            <div className="relative w-24 h-24 mx-auto mt-8">
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 rounded-full border-2"
                style={{ borderColor: color }}
              />
              <motion.div
                animate={{ scale: [1, 1.8, 1], opacity: [0.2, 0, 0.2] }}
                transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
                className="absolute inset-0 rounded-full border"
                style={{ borderColor: color }}
              />
              <div
                className="absolute inset-2 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${color}30` }}
              >
                <Volume2 size={28} style={{ color }} />
              </div>
            </div>

            {/* Duration */}
            <p className="text-emerald-400 font-mono text-lg mt-6">
              {formatDuration(duration)}
            </p>
          </div>

          {/* Middle: Transcript */}
          <div className="flex-1 w-full max-w-md overflow-y-auto my-8 space-y-3 px-4">
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                      msg.role === "user"
                        ? "bg-white/10 text-white rounded-br-md"
                        : "text-white/90 rounded-bl-md"
                    }`}
                    style={
                      msg.role === "assistant"
                        ? { backgroundColor: `${color}25` }
                        : undefined
                    }
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Bottom: Controls */}
          <div className="flex items-center gap-8">
            <button
              onClick={onToggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                isMuted
                  ? "bg-white/20 text-white"
                  : "bg-white/10 text-white/60"
              }`}
            >
              {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            <button
              onClick={onEndCall}
              className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-xl hover:bg-red-600 transition-colors"
            >
              <PhoneOff size={26} />
            </button>

            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white/40">
              <Volume2 size={22} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CallOverlay;
