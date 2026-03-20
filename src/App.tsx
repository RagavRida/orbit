import React, { useState, useEffect, useCallback, useRef } from "react";
import Globe from "./components/Globe";
import RadioPanel from "./components/RadioPanel";
import VoiceCommand from "./components/VoiceCommand";
import { Startup, INDUSTRY_VOICES } from "./types";
import { FALLBACK_STARTUPS } from "./constants";
import { motion, AnimatePresence } from "motion/react";
import { Info, X, Radio, Play, Pause, SkipForward, SkipBack, Mic, Globe as GlobeIcon, Zap } from "lucide-react";
import { GoogleGenAI, Modality } from "@google/genai";
import Vapi from "@vapi-ai/web";

const vapi = new Vapi(process.env.VITE_VAPI_PUBLIC_KEY || "0bfc1201-6649-4cbe-8cb3-ec6d59636a9f");

const App: React.FC = () => {
  const [startups, setStartups] = useState<Startup[]>(FALLBACK_STARTUPS);
  const [selectedStartup, setSelectedStartup] = useState<Startup | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isCalling, setIsCalling] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const demoIntervalRef = useRef<number | null>(null);

  // Fetch startups on mount
  const fetchStartups = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/scrape");
      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        const text = await response.text();
        console.error(`Server returned error (${response.status}):`, text);
        return;
      }

      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.startups && data.startups.length > 0) {
          setStartups(data.startups);
          setIsLive(true);
        }
      } else {
        const text = await response.text();
        console.error("Expected JSON but received:", text.substring(0, 100) + "...");
      }
    } catch (error) {
      console.error("Failed to fetch startups:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStartups();
  }, [fetchStartups, retryCount]);

  // Handle TTS playback
  const playFounderVoice = useCallback(async (startup: Startup) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsPlaying(true);
    const voiceName = INDUSTRY_VOICES[startup.industry] || INDUSTRY_VOICES.Other;
    const text = startup.founder_quote || `Hi, I'm the founder of ${startup.name}. ${startup.tagline}. We are based in ${startup.city}, ${startup.country}.`;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("No audio data returned");

      const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.play();
    } catch (error) {
      console.error("Gemini TTS Error:", error);
      setIsPlaying(false);
      // Fallback: Use Web Speech API
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
      utterance.onend = () => setIsPlaying(false);
    }
  }, []);

  const handleSelectStartup = useCallback((startup: Startup) => {
    setSelectedStartup(startup);
    playFounderVoice(startup);
  }, [playFounderVoice]);

  const handleTogglePlay = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } else if (selectedStartup) {
      playFounderVoice(selectedStartup);
    }
  }, [isPlaying, selectedStartup, playFounderVoice]);

  const handleNext = useCallback(() => {
    const currentIndex = startups.findIndex((s) => s.name === selectedStartup?.name);
    const nextIndex = (currentIndex + 1) % startups.length;
    handleSelectStartup(startups[nextIndex]);
  }, [startups, selectedStartup, handleSelectStartup]);

  const handlePrev = useCallback(() => {
    const currentIndex = startups.findIndex((s) => s.name === selectedStartup?.name);
    const prevIndex = (currentIndex - 1 + startups.length) % startups.length;
    handleSelectStartup(startups[prevIndex]);
  }, [startups, selectedStartup, handleSelectStartup]);

  // Voice Command Handling
  const handleVoiceCommand = useCallback((command: string) => {
    console.log("Voice Command:", command);
    if (command.includes("show") || command.includes("filter")) {
      const industry = ["ai", "fintech", "health", "saas", "consumer", "climate"].find((i) => command.includes(i));
      if (industry) {
        const filtered = startups.filter((s) => s.industry.toLowerCase() === industry);
        if (filtered.length > 0) handleSelectStartup(filtered[0]);
      }
    } else if (command.includes("zoom to") || command.includes("go to")) {
      const country = ["india", "usa", "brazil", "france", "uk", "germany", "australia"].find((c) => command.includes(c));
      if (country) {
        const found = startups.find((s) => s.country.toLowerCase() === country);
        if (found) handleSelectStartup(found);
      }
    } else if (command.includes("play") || command.includes("resume")) {
      if (!isPlaying) handleTogglePlay();
    } else if (command.includes("pause") || command.includes("stop")) {
      if (isPlaying) handleTogglePlay();
    } else if (command.includes("next")) {
      handleNext();
    } else if (command.includes("who is this")) {
      setShowInfo(true);
    }
  }, [startups, isPlaying, handleSelectStartup, handleTogglePlay, handleNext]);

  // Vapi Call Handling
  const handleCallFounder = useCallback(async () => {
    if (!selectedStartup) return;
    
    if (isCalling) {
      vapi.stop();
      setIsCalling(false);
      return;
    }

    setIsCalling(true);
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);

    try {
      vapi.start({
        name: `Founder of ${selectedStartup.name}`,
        model: {
          provider: "openai",
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `You are the founder of ${selectedStartup.name}. 
              Your company tagline is: ${selectedStartup.tagline}. 
              You are based in ${selectedStartup.city}, ${selectedStartup.country}.
              Your industry is ${selectedStartup.industry}.
              Be enthusiastic, professional, and ready to answer questions about your startup.
              Keep responses concise and conversational.`
            }
          ]
        }
      });

      vapi.on("call-end", () => {
        setIsCalling(false);
      });
    } catch (error) {
      console.error("Vapi Call Error:", error);
      setIsCalling(false);
    }
  }, [selectedStartup, isCalling]);

  // Demo Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "d") {
        setIsDemoMode((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isDemoMode) {
      let index = 0;
      handleSelectStartup(startups[index]);
      demoIntervalRef.current = window.setInterval(() => {
        index = (index + 1) % 5;
        handleSelectStartup(startups[index]);
      }, 20000);
    } else {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    }
    return () => {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, [isDemoMode, startups, handleSelectStartup]);

  return (
    <div className="relative w-full h-screen bg-[#050510] overflow-hidden font-sans text-white">
      {/* Background Starfield & Atmosphere is handled by Globe component */}
      
      {/* Globe */}
      <Globe 
        startups={startups} 
        onSelectStartup={handleSelectStartup} 
        selectedStartup={selectedStartup} 
      />

      {/* UI Overlays */}
      <div className="absolute top-8 left-8 z-50">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
            <Radio className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic">Orbit</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Startup Radio Globe</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <div className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-white/50">
            {startups.length} STATIONS ONLINE
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${isLive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
              {isLive ? "Live YC Feed" : "Archive Mode"}
            </span>
          </div>
          {!isLive && !loading && (
            <button 
              onClick={() => setRetryCount(c => c + 1)}
              className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/10 text-[10px] font-bold text-white transition-colors flex items-center gap-1 ml-2"
            >
              <Zap size={10} className="text-amber-400" /> RETRY SCRAPE
            </button>
          )}
          {isDemoMode && (
            <motion.div 
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="px-2 py-1 rounded bg-red-500/20 border border-red-500/50 text-[10px] font-bold text-red-500 flex items-center gap-1"
            >
              <Zap size={10} /> DEMO MODE
            </motion.div>
          )}
        </div>
      </div>

      <VoiceCommand onCommand={handleVoiceCommand} />

      <AnimatePresence>
        {selectedStartup && (
          <RadioPanel
            selectedStartup={selectedStartup}
            isPlaying={isPlaying}
            isCalling={isCalling}
            onTogglePlay={handleTogglePlay}
            onCall={handleCallFounder}
            onNext={handleNext}
            onPrev={handlePrev}
            onShowInfo={() => setShowInfo(true)}
          />
        )}
      </AnimatePresence>

      {/* Info Modal */}
      <AnimatePresence>
        {showInfo && selectedStartup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#0a0a1a] border border-white/10 rounded-3xl p-8 max-w-lg w-full relative shadow-2xl"
            >
              <button
                onClick={() => setShowInfo(false)}
                className="absolute top-6 right-6 text-white/30 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              <div className="flex items-center gap-6 mb-8">
                <img src={selectedStartup.logo} alt={selectedStartup.name} className="w-20 h-20 rounded-2xl border border-white/10" />
                <div>
                  <h2 className="text-3xl font-bold">{selectedStartup.name}</h2>
                  <p className="text-white/50">{selectedStartup.city}, {selectedStartup.country}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2">About</h3>
                  <p className="text-lg leading-relaxed">{selectedStartup.tagline}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Industry</h3>
                    <p className="font-bold">{selectedStartup.industry}</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Founded</h3>
                    <p className="font-bold">{selectedStartup.founding_year || "Unknown"}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2">Founder Quote</h3>
                  <p className="text-sm italic text-white/70">"{selectedStartup.founder_quote || "Building the future of " + selectedStartup.industry.toLowerCase() + "."}"</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Screen */}
      <AnimatePresence>
        {loading && (
          <motion.div
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-[#050510] flex flex-col items-center justify-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="w-16 h-16 border-4 border-white/10 border-t-white rounded-full mb-8"
            />
            <h2 className="text-xl font-bold tracking-widest uppercase">Initializing Orbit</h2>
            <p className="text-white/30 text-xs mt-2 uppercase tracking-[0.3em]">Calibrating Satellite Uplink</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
