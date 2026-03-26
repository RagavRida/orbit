import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { useConversation } from "@elevenlabs/react";

interface IncomingCallProps {
  company: string;
  domain: string;
  summary: string;
  agentId?: string;
  onAccept: () => void;
  onDecline: () => void;
  isActive: boolean;
}

const IncomingCall: React.FC<IncomingCallProps> = ({
  company, domain, summary, agentId, onAccept, onDecline, isActive,
}) => {
  const [accepted, setAccepted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<{ role: string; text: string }[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const timerRef = useRef<number | null>(null);
  const audioFallbackRef = useRef<HTMLAudioElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // ElevenLabs Conversational AI hook
  const conversation = useConversation({
    onConnect: () => {
      setConnectionStatus("connected");
      console.log("[IncomingCall] Connected to ElevenLabs agent");
    },
    onDisconnect: () => {
      setConnectionStatus("disconnected");
      console.log("[IncomingCall] Disconnected from ElevenLabs agent");
    },
    onMessage: (message: any) => {
      console.log("[IncomingCall] Message:", message);
      // Handle agent audio/text responses
      if (message?.type === "agent" && message?.message) {
        setTranscript(prev => [...prev, { role: "agent", text: message.message }]);
        setIsSpeaking(true);
      }
      // Handle user transcription
      if (message?.type === "user_transcript" || message?.user_transcription_event?.user_transcript) {
        const userText = message?.user_transcription_event?.user_transcript || message?.message || "";
        if (userText) setTranscript(prev => [...prev, { role: "user", text: userText }]);
      }
    },
    onError: (error: any) => {
      console.error("[IncomingCall] Error:", error);
      setConnectionStatus("error");
    },
  });

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Call duration timer
  useEffect(() => {
    if (accepted && connectionStatus === "connected") {
      timerRef.current = window.setInterval(() => setCallDuration(d => d + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [accepted, connectionStatus]);

  // When agent is speaking, detect silence after audio ends
  useEffect(() => {
    if (isSpeaking) {
      const timeout = setTimeout(() => setIsSpeaking(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [isSpeaking, transcript]);

  const handleAccept = useCallback(async () => {
    setAccepted(true);
    onAccept();

    // Request microphone permission
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      console.error("[IncomingCall] Microphone permission denied:", e);
    }

    // If we have an agentId, connect to ElevenLabs Conversational AI
    if (agentId) {
      setConnectionStatus("connecting");
      try {
        // Get signed URL from server
        const signedRes = await fetch("/api/watch/signed-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId }),
        });

        if (signedRes.ok) {
          const { signedUrl } = await signedRes.json();
          // Connect using signed URL for secure connection
          await conversation.startSession({ signedUrl } as any);
        } else {
          // Fallback: connect with agentId
          await conversation.startSession({ agentId } as any);
        }
      } catch (e) {
        console.error("[IncomingCall] Failed to start ElevenLabs session:", e);
        setConnectionStatus("error");
        // Fallback to TTS briefing
        await fallbackTTSBriefing();
      }
    } else {
      // No agentId — use TTS fallback
      await fallbackTTSBriefing();
    }
  }, [agentId, conversation, onAccept, domain, summary]);

  const fallbackTTSBriefing = useCallback(async () => {
    setConnectionStatus("fallback");
    const briefMessage = `Hi, this is Orbit. I detected a change on ${domain}. ${summary}`;
    setTranscript([{ role: "agent", text: briefMessage }]);
    setIsSpeaking(true);
    try {
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: briefMessage, voiceId: "nPczCjzI2devNBz1zQrb" }),
      });
      if (ttsRes.ok) {
        const blob = await ttsRes.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioFallbackRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); setIsSpeaking(false); };
        audio.play();
      } else {
        setIsSpeaking(false);
      }
    } catch { setIsSpeaking(false); }
  }, [domain, summary]);

  const handleDecline = useCallback(() => {
    if (audioFallbackRef.current) { audioFallbackRef.current.pause(); audioFallbackRef.current = null; }
    if (timerRef.current) clearInterval(timerRef.current);
    if (connectionStatus === "connected") {
      conversation.endSession();
    }
    onDecline();
  }, [onDecline, conversation, connectionStatus]);

  const handleEndCall = useCallback(() => {
    if (audioFallbackRef.current) { audioFallbackRef.current.pause(); audioFallbackRef.current = null; }
    if (timerRef.current) clearInterval(timerRef.current);
    if (connectionStatus === "connected") {
      conversation.endSession();
    }
    onDecline();
  }, [onDecline, conversation, connectionStatus]);

  const handleToggleMute = useCallback(() => {
    if (connectionStatus === "connected") {
      conversation.setVolume({ volume: isMuted ? 1 : 0 });
    }
    setIsMuted(!isMuted);
  }, [conversation, connectionStatus, isMuted]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (!isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: "-100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "-100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
        style={{ background: "rgba(0, 0, 20, 0.97)" }}
      >
        {!accepted ? (
          /* ── Incoming Call Screen ── */
          <>
            <p className="text-sm text-white/40 tracking-[0.3em] uppercase mb-3 font-light">
              Incoming Call
            </p>
            <h1 className="text-5xl font-extralight text-white mb-2 tracking-wide">
              ORBIT
            </h1>
            <p className="text-sm text-white/50 mb-10">
              Competitor alert: {domain}
            </p>

            {/* Pulsing rings */}
            <div className="relative w-32 h-32 mb-4">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full border border-white/10"
                  animate={{
                    scale: [1, 1.5 + i * 0.3],
                    opacity: [0.4, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.5,
                    ease: "easeOut",
                  }}
                />
              ))}
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-orange-500/30 to-purple-500/30 backdrop-blur-sm flex items-center justify-center border border-white/10">
                <span className="text-4xl">🌐</span>
              </div>
            </div>

            {/* Summary preview */}
            <p className="text-xs text-white/30 max-w-[280px] text-center mt-6 mb-12 leading-relaxed">
              {summary.slice(0, 120)}{summary.length > 120 ? "..." : ""}
            </p>

            {/* Accept / Decline buttons */}
            <div className="flex items-center gap-20">
              <button onClick={handleDecline} className="flex flex-col items-center gap-2 group">
                <div className="w-[72px] h-[72px] rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 group-hover:bg-red-400 transition-colors">
                  <PhoneOff size={28} className="text-white" />
                </div>
                <span className="text-xs text-white/40">Decline</span>
              </button>

              <button onClick={handleAccept} className="flex flex-col items-center gap-2 group">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-[72px] h-[72px] rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:bg-green-400 transition-colors"
                >
                  <Phone size={28} className="text-white" />
                </motion.div>
                <span className="text-xs text-white/40">Accept</span>
              </button>
            </div>
          </>
        ) : (
          /* ── Active Call Screen ── */
          <>
            <p className={`text-sm tracking-widest uppercase mb-1 font-bold ${
              connectionStatus === "connected" ? "text-green-400" :
              connectionStatus === "connecting" ? "text-yellow-400 animate-pulse" :
              connectionStatus === "error" ? "text-red-400" :
              "text-green-400"
            }`}>
              {connectionStatus === "connecting" ? "Connecting..." :
               connectionStatus === "connected" ? "Connected — Live Call" :
               connectionStatus === "error" ? "Fallback Mode" :
               "Briefing"}
            </p>
            <h2 className="text-3xl font-light text-white mb-1">ORBIT</h2>
            <p className="text-sm text-white/40 font-mono">{formatTime(callDuration)}</p>

            {/* Waveform bars */}
            <div className="flex items-end gap-1 h-16 mt-8 mb-6">
              {Array.from({ length: 24 }).map((_, i) => (
                <motion.div
                  key={i}
                  className={`w-1 rounded-full ${
                    connectionStatus === "connected"
                      ? "bg-gradient-to-t from-green-500 to-emerald-300"
                      : "bg-gradient-to-t from-blue-500 to-cyan-300"
                  }`}
                  animate={{
                    height: isSpeaking ? [8, 16 + Math.random() * 32, 8] : [3, 5, 3],
                  }}
                  transition={{
                    duration: 0.25 + Math.random() * 0.25,
                    repeat: Infinity,
                    delay: i * 0.04,
                  }}
                />
              ))}
            </div>

            {/* Transcript */}
            <div className="w-[360px] max-h-[220px] overflow-y-auto mb-6 px-4 scrollbar-thin">
              {transcript.map((line, i) => (
                <div key={i} className={`flex mb-3 ${line.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[280px] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    line.role === "user"
                      ? "bg-blue-500/20 text-blue-200 rounded-tr-sm"
                      : "bg-white/5 text-white/70 rounded-tl-sm"
                  }`}>
                    <span className={`text-[9px] font-bold block mb-0.5 ${
                      line.role === "user" ? "text-blue-400" : "text-green-400"
                    }`}>
                      {line.role === "user" ? "You" : "Orbit"}
                    </span>
                    {line.text}
                  </div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>

            {/* Alert info */}
            <div className="bg-white/5 rounded-xl px-4 py-3 mb-8 max-w-[320px] border border-white/5">
              <p className="text-[10px] text-orange-400 uppercase tracking-widest font-bold mb-1">Change Detected on {domain}</p>
              <p className="text-xs text-white/50 leading-relaxed">{summary}</p>
            </div>

            {/* Call controls */}
            <div className="flex items-center gap-12">
              <button onClick={handleToggleMute} className="flex flex-col items-center gap-2">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                  isMuted ? "bg-red-500/30 border border-red-500/40" : "bg-white/10 border border-white/10"
                }`}>
                  {isMuted ? <MicOff size={22} className="text-red-300" /> : <Mic size={22} className="text-white" />}
                </div>
                <span className="text-[10px] text-white/30">{isMuted ? "Unmute" : "Mute"}</span>
              </button>

              <button onClick={handleEndCall} className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/20">
                  <PhoneOff size={22} className="text-white" />
                </div>
                <span className="text-[10px] text-white/30">End</span>
              </button>
            </div>

            {/* Connection indicator */}
            {connectionStatus === "connected" && (
              <p className="text-[9px] text-green-400/40 mt-4 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                ElevenLabs Conversational AI · Speak naturally
              </p>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default IncomingCall;
