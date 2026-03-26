import React, { useState, useEffect, useCallback, useRef } from "react";
import Globe from "./components/Globe";
import RadioPanel from "./components/RadioPanel";
import VoiceCommand from "./components/VoiceCommand";
import ModeSwitcher from "./components/ModeSwitcher";
import FirecrawlTicker from "./components/FirecrawlTicker";
import CallOverlay from "./components/CallOverlay";
import NewspaperView from "./components/NewspaperView";
import { SentimentPanel, PricingPanel, ResearchPanel, ChangesPanel } from "./components/ModePanel";
import IncomingCall from "./components/IncomingCall";
import WatchList from "./components/WatchList";
import Toast, { useToast } from "./components/Toast";
import { Startup, INDUSTRY_VOICES } from "./types";
import { FALLBACK_STARTUPS } from "./constants";
import { useGlobeMode } from "./hooks/useGlobeMode";
import { useAmbientSound } from "./hooks/useAmbientSound";
import { useCrawlLog } from "./hooks/useCrawlLog";
import { GlobeMode, MODES } from "./lib/modes";
import { motion, AnimatePresence } from "motion/react";
import { Radio, Zap, X, Info } from "lucide-react";

const DEFAULT_MODE: GlobeMode = "call";

const App: React.FC = () => {
  const { toasts, showToast, dismissToast } = useToast();
  const { mode: globeMode, setMode: setGlobeMode, modeConfig } = useGlobeMode();
  const { playAmbient, stopAmbient } = useAmbientSound();
  const { log: crawlLog, addEntry, updateLast } = useCrawlLog();

  const [startups, setStartups] = useState<Startup[]>(FALLBACK_STARTUPS);
  const [selectedStartup, setSelectedStartup] = useState<Startup | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isCalling, setIsCalling] = useState(false);
  const [callMessages, setCallMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [storyExchanges, setStoryExchanges] = useState<{ host: string; text: string }[]>([]);
  const [storyTension, setStoryTension] = useState("");
  const [showNewspaper, setShowNewspaper] = useState(false);
  const [dubbingLanguage, setDubbingLanguage] = useState<string | null>(null);
  const [isDubbing, setIsDubbing] = useState(false);
  const [techInfo, setTechInfo] = useState<{ firecrawl: string; elevenlabs: string } | null>(null);
  const [sentimentResult, setSentimentResult] = useState<any>(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [pricingResult, setPricingResult] = useState<any>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [researchResult, setResearchResult] = useState<any>(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [changesResult, setChangesResult] = useState<any[]>([]);
  const [changesLoading, setChangesLoading] = useState(false);
  const [watchEntries, setWatchEntries] = useState<any[]>([]);
  const [watchAlertHistory, setWatchAlertHistory] = useState<any[]>([]);
  const [isWatchMode, setIsWatchMode] = useState(false);
  const [incomingAlert, setIncomingAlert] = useState<{ company: string; domain: string; summary: string; agentId?: string } | null>(null);
  const [productEntries, setProductEntries] = useState<any[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const demoIntervalRef = useRef<number | null>(null);
  const callRecorderRef = useRef<MediaRecorder | null>(null);
  const callActiveRef = useRef(false);
  const callTimerRef = useRef<number | null>(null);

  // ── Fetch Startups on mount ──
  const fetchStartups = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/scrape");
      const contentType = response.headers.get("content-type");
      if (!response.ok) { showToast(`Failed to load live data (${response.status})`, "error"); return; }
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (data.startups && data.startups.length > 0) {
          setStartups((prev) => {
            const existingNames = new Set(data.startups.map((s: Startup) => s.name.toLowerCase()));
            const uniqueFallbacks = prev.filter((s) => !existingNames.has(s.name.toLowerCase()));
            return [...data.startups, ...uniqueFallbacks];
          });
          setIsLive(true);
        }
      }
    } catch { showToast("Failed to fetch startups", "error"); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { fetchStartups(); }, [fetchStartups, retryCount]);

  // ── TTS via server proxy ──
  const speakWithTTS = useCallback(async (text: string, industry: string): Promise<HTMLAudioElement | null> => {
    const voiceId = INDUSTRY_VOICES[industry] || INDUSTRY_VOICES.Other || "nPczCjzI2devNBz1zQrb";
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId }),
      });
      if (!response.ok) throw new Error(`TTS error: ${response.status}`);
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      return audio;
    } catch {
      showToast("Voice synthesis failed", "error");
      return null;
    }
  }, [showToast]);

  // ── Play founder voice (default mode) ──
  const playFounderVoice = useCallback(async (startup: Startup) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setIsPlaying(true);
    const text = startup.founder_quote || `Hi, I'm the founder of ${startup.name}. ${startup.tagline}. We are based in ${startup.city}, ${startup.country}.`;
    const audio = await speakWithTTS(text, startup.industry);
    if (audio) {
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.play();
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
      utterance.onend = () => setIsPlaying(false);
    }
  }, [speakWithTTS]);

  // ── Story Mode handler ──
  const playStory = useCallback(async (startup: Startup) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setIsPlaying(true);
    setStoryExchanges([]);
    setStoryTension("");
    setTechInfo(null);

    const domain = startup.logo?.match(/clearbit\.com\/(.+)/)?.[1] ||
      startup.name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";

    addEntry("/story", domain, "loading");

    try {
      const response = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: startup.name, domain, slug: startup.name.toLowerCase() }),
      });

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("audio")) {
        // Server returned pre-generated audio
        const metaHeader = response.headers.get("X-Story-Meta");
        let meta: any = {};
        try { meta = JSON.parse(metaHeader ? atob(metaHeader) : "{}"); } catch {}

        setStoryExchanges(meta.exchanges || []);
        setStoryTension(meta.tension || "");
        setTechInfo({
          firecrawl: meta.firecrawlInfo ? `${meta.firecrawlInfo.endpoint} · ${meta.firecrawlInfo.wordCount} chars` : "/crawl + /search",
          elevenlabs: meta.elevenlabsInfo ? `${meta.elevenlabsInfo.feature} · ${meta.elevenlabsInfo.calls} calls` : "Text to Speech (2 voices)",
        });
        updateLast("done", `${meta.exchanges?.length || 0} exchanges`);

        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => { setIsPlaying(false); URL.revokeObjectURL(audioUrl); };
        audio.play();
      } else {
        // JSON response — either cached script or error
        const data = await response.json();

        if (data.fallback || data.error) {
          updateLast("error", data.error || "fallback");
          playFounderVoice(startup);
          return;
        }

        const exchanges = data.exchanges || [];
        setStoryExchanges(exchanges);
        setStoryTension(data.tension || "");
        setTechInfo({
          firecrawl: data.firecrawlInfo ? `${data.firecrawlInfo.endpoint} · ${data.firecrawlInfo.wordCount} chars` : "/crawl + /search",
          elevenlabs: `Text to Speech (2 voices) · ${exchanges.length} calls`,
        });
        updateLast("done", `${exchanges.length} exchanges`);

        // Client-side TTS: speak each exchange sequentially
        if (exchanges.length > 0) {
          const alexVoice = "nPczCjzI2devNBz1zQrb";
          const samVoice = "EXAVITQu4vr4xnSDxMaL";

          for (const exchange of exchanges) {
            const voiceId = exchange.host === "Alex" ? alexVoice : samVoice;
            try {
              const ttsRes = await fetch("/api/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: exchange.text, voiceId }),
              });
              if (!ttsRes.ok) continue;
              const blob = await ttsRes.blob();
              const url = URL.createObjectURL(blob);
              const audio = new Audio(url);
              audioRef.current = audio;
              await new Promise<void>((resolve) => {
                audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
                audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
                audio.play().catch(() => resolve());
              });
            } catch { continue; }
          }
          setIsPlaying(false);
        } else {
          // No exchanges — fall back to founder voice
          playFounderVoice(startup);
        }
      }
    } catch (err) {
      updateLast("error");
      showToast("Story generation failed, falling back to quote", "error");
      playFounderVoice(startup);
    }
  }, [addEntry, updateLast, playFounderVoice, showToast, speakWithTTS]);

  // ── Sentiment Mode handler ──
  const fetchSentimentData = useCallback(async (startup: Startup) => {
    setSentimentLoading(true);
    setSentimentResult(null);
    addEntry("/search", startup.name, "loading");
    try {
      const res = await fetch("/api/sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: startup.name }),
      });
      const data = await res.json();
      setSentimentResult(data);
      updateLast("done", `${data.sentiment} (${data.score})`);
      setTechInfo({ firecrawl: "/search · news headlines", elevenlabs: "—" });

      // Also speak a summary
      const summary = `${startup.name}: sentiment is ${data.sentiment} with a score of ${data.score}. Top headline: ${data.topHeadline}`;
      const audio = await speakWithTTS(summary, startup.industry);
      if (audio) { audioRef.current = audio; audio.onended = () => setIsPlaying(false); audio.play(); setIsPlaying(true); }
    } catch { updateLast("error"); showToast("Sentiment analysis failed", "error"); }
    finally { setSentimentLoading(false); }
  }, [addEntry, updateLast, showToast, speakWithTTS]);

  // ── Pricing Mode handler ──
  const fetchPricingData = useCallback(async (startup: Startup) => {
    setPricingLoading(true);
    setPricingResult(null);
    const domain = startup.logo?.match(/clearbit\.com\/(.+)/)?.[1] || startup.name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
    addEntry("/scrape", `${domain}/pricing`, "loading");
    try {
      const res = await fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: startup.name, domain }),
      });
      const data = await res.json();
      setPricingResult(data);
      updateLast("done", `${data.tiers?.length || 0} tiers`);
      setTechInfo({ firecrawl: "/scrape · /pricing page", elevenlabs: "—" });

      // Speak pricing summary
      const summary = data.hasPricing
        ? `${startup.name} has ${data.tiers?.length || 0} pricing tiers. ${data.summary}`
        : `${startup.name}: ${data.summary}`;
      const audio = await speakWithTTS(summary, startup.industry);
      if (audio) { audioRef.current = audio; audio.onended = () => setIsPlaying(false); audio.play(); setIsPlaying(true); }
    } catch { updateLast("error"); showToast("Pricing fetch failed", "error"); }
    finally { setPricingLoading(false); }
  }, [addEntry, updateLast, showToast, speakWithTTS]);

  // ── Research Mode handler ──
  const fetchResearchData = useCallback(async (startup: Startup) => {
    setResearchLoading(true);
    setResearchResult(null);
    const domain = startup.logo?.match(/clearbit\.com\/(.+)/)?.[1] || startup.name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
    addEntry("/research", startup.name, "loading");
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: startup.name, domain }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("audio")) {
        const metaHeader = res.headers.get("X-Research-Meta");
        let meta: any = {};
        try { meta = JSON.parse(metaHeader ? atob(metaHeader) : "{}"); } catch {}
        setResearchResult(meta);
        updateLast("done", `verdict: ${meta.verdict}`);
        setTechInfo({ firecrawl: "/scrape + /search ×2", elevenlabs: "Text to Speech · briefing" });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setIsPlaying(false); URL.revokeObjectURL(url); };
        audio.play();
        setIsPlaying(true);
      } else {
        const data = await res.json();
        setResearchResult(data);
        updateLast("done", `verdict: ${data.verdict}`);
        setTechInfo({ firecrawl: "/scrape + /search ×2", elevenlabs: "Text to Speech · briefing" });
        // Client-side TTS for research exchanges
        if (data.exchanges?.length) {
          setIsPlaying(true);
          for (const ex of data.exchanges) {
            const voiceId = ex.host === "Alex" ? "nPczCjzI2devNBz1zQrb" : "EXAVITQu4vr4xnSDxMaL";
            try {
              const ttsRes = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: ex.text, voiceId }) });
              if (!ttsRes.ok) continue;
              const blob = await ttsRes.blob();
              const url = URL.createObjectURL(blob);
              const audio = new Audio(url);
              audioRef.current = audio;
              await new Promise<void>((resolve) => { audio.onended = () => { URL.revokeObjectURL(url); resolve(); }; audio.onerror = () => resolve(); audio.play().catch(() => resolve()); });
            } catch { continue; }
          }
          setIsPlaying(false);
        } else {
          const summary = `Research on ${startup.name}: funding stage ${data.fundingStage}. Verdict: ${data.verdict}. ${(data.keyFacts || []).slice(0, 2).join(". ")}`;
          const audio = await speakWithTTS(summary, startup.industry);
          if (audio) { audioRef.current = audio; audio.onended = () => setIsPlaying(false); audio.play(); setIsPlaying(true); }
        }
      }
    } catch { updateLast("error"); showToast("Research briefing failed", "error"); }
    finally { setResearchLoading(false); }
  }, [addEntry, updateLast, showToast, speakWithTTS]);

  // ── Changes Mode handler ──
  const fetchChangesData = useCallback(async (startup: Startup) => {
    setChangesLoading(true);
    setChangesResult([]);
    addEntry("/search", `${startup.name} changes`, "loading");
    try {
      const res = await fetch("/api/sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: startup.name }),
      });
      const sentData = await res.json();

      // Build change entries from sentiment + search data
      const entries = [];
      if (sentData.topHeadline && sentData.topHeadline !== "No news data available") {
        entries.push({ date: "Recent", type: "news" as const, title: sentData.topHeadline, detail: `Sentiment: ${sentData.sentiment} (${sentData.score})` });
      }
      entries.push({ date: "Founded", type: "team" as const, title: `${startup.name} was founded`, detail: `Based in ${startup.city}, ${startup.country}. Industry: ${startup.industry}` });
      entries.push({ date: "Current", type: "product" as const, title: startup.tagline, detail: `Active in the ${startup.industry} space` });

      setChangesResult(entries);
      updateLast("done", `${entries.length} changes`);
      setTechInfo({ firecrawl: "/search · news", elevenlabs: "—" });

      // Speak a summary
      const summary = `Recent changes for ${startup.name}: ${entries[0]?.title || startup.tagline}`;
      const audio = await speakWithTTS(summary, startup.industry);
      if (audio) { audioRef.current = audio; audio.onended = () => setIsPlaying(false); audio.play(); setIsPlaying(true); }
    } catch { updateLast("error"); showToast("Failed to fetch changes", "error"); }
    finally { setChangesLoading(false); }
  }, [addEntry, updateLast, showToast, speakWithTTS]);

  // ── Handle Startup Selection (mode-aware) ──
  const handleSelectStartup = useCallback((startup: Startup) => {
    // If in watch mode, add to watch list instead of normal selection
    if (isWatchMode) {
      const domain = startup.logo?.match(/clearbit\.com\/(.+)/)?.[1] || startup.name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
      const slug = startup.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
      fetch("/api/watch/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, domain, companyName: startup.name }),
      }).then(r => r.json()).then(data => {
        if (data.status === "already_watching") { showToast(`Already watching ${startup.name}`, "info"); }
        else { showToast(`Now watching ${startup.name}`, "success"); }
        refreshWatchList();
      }).catch(() => showToast("Failed to add watch", "error"));
      setIsWatchMode(false);
      return;
    }

    setSelectedStartup(startup);
    setSentimentResult(null);
    setPricingResult(null);
    setResearchResult(null);
    setChangesResult([]);

    switch (globeMode) {
      case "story":
        playStory(startup);
        break;
      case "sentiment":
        fetchSentimentData(startup);
        break;
      case "pricing":
        fetchPricingData(startup);
        break;
      case "research":
        fetchResearchData(startup);
        break;
      case "changes":
        fetchChangesData(startup);
        break;
      case "call":
      default:
        playFounderVoice(startup);
        break;
    }
  }, [globeMode, playStory, playFounderVoice, fetchSentimentData, fetchPricingData, fetchResearchData, fetchChangesData, isWatchMode, showToast]);

  // ── Watch list helpers ──
  const refreshWatchList = useCallback(() => {
    fetch("/api/watch/list").then(r => r.json()).then(d => setWatchEntries(d.entries || [])).catch(() => {});
    fetch("/api/watch/history").then(r => r.json()).then(d => setWatchAlertHistory(d.alerts || [])).catch(() => {});
    fetch("/api/product-watch/list").then(r => r.json()).then(d => setProductEntries(d.products || [])).catch(() => {});
  }, []);

  const handleWatchRemove = useCallback((slug: string) => {
    fetch("/api/watch/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) })
      .then(() => { showToast("Removed from watch list", "info"); refreshWatchList(); }).catch(() => {});
  }, [showToast, refreshWatchList]);

  const handleWatchCheck = useCallback((slug: string) => {
    addEntry("/watch", slug, "loading");
    showToast(`Checking ${slug}...`, "info");
    fetch(`/api/watch/check/${slug}`).then(r => r.json()).then(d => {
      if (d.status === "change_detected") {
        updateLast("done", "change detected!");
        showToast(`Change detected on ${slug}!`, "success");
      } else if (d.status === "no_change") {
        updateLast("done", "no changes");
        showToast(`No changes on ${slug}`, "info");
      } else {
        updateLast("done", d.status);
      }
      refreshWatchList();
    }).catch(() => { updateLast("error"); showToast("Check failed", "error"); });
  }, [addEntry, updateLast, showToast, refreshWatchList]);

  const handlePlayAlert = useCallback(async (summary: string) => {
    const audio = await speakWithTTS(summary, "AI");
    if (audio) { audioRef.current = audio; audio.onended = () => setIsPlaying(false); audio.play(); setIsPlaying(true); }
  }, [speakWithTTS]);

  // ── SSE connection for real-time alerts ──
  useEffect(() => {
    refreshWatchList();
    const eventSource = new EventSource("/api/watch/alerts/stream");
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "competitor_alert") {
          setIncomingAlert({ company: data.company, domain: data.domain, summary: data.summary, agentId: data.agentId });
          refreshWatchList();
        } else if (data.type === "product-alert") {
          showToast(`🚨 ${data.name}: ${data.message}`, "success");
          refreshWatchList();
        }
      } catch {}
    };
    return () => eventSource.close();
  }, [refreshWatchList]);

  // ── Product tracking handlers ──
  const handleAddProduct = useCallback((url: string, name: string, priceBelow?: number) => {
    fetch("/api/product-watch/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, name, priceBelow, anyChange: true }),
    }).then(r => r.json()).then(d => {
      if (d.status === "already_watching") showToast(`Already tracking ${name}`, "info");
      else showToast(`Now tracking ${name}`, "success");
      refreshWatchList();
    }).catch(() => showToast("Failed to add product", "error"));
  }, [showToast, refreshWatchList]);

  const handleRemoveProduct = useCallback((id: string) => {
    fetch(`/api/product-watch/remove/${id}`, { method: "DELETE" })
      .then(() => { showToast("Product removed", "info"); refreshWatchList(); })
      .catch(() => {});
  }, [showToast, refreshWatchList]);

  const handleCheckProduct = useCallback((id: string) => {
    showToast(`Checking product...`, "info");
    fetch(`/api/product-watch/check/${id}`).then(r => r.json()).then(d => {
      if (d.status === "alert_triggered") showToast(`Alert: ${d.alert}`, "success");
      else if (d.status === "no_changes") showToast(`No changes detected`, "info");
      else showToast(d.status, "info");
      refreshWatchList();
    }).catch(() => showToast("Check failed", "error"));
  }, [showToast, refreshWatchList]);

  // ── Playback controls ──
  const handleTogglePlay = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) { audioRef.current.pause(); } else { audioRef.current.play(); }
      setIsPlaying(!isPlaying);
    } else if (selectedStartup) { playFounderVoice(selectedStartup); }
  }, [isPlaying, selectedStartup, playFounderVoice]);

  const handleNext = useCallback(() => {
    const i = startups.findIndex((s) => s.name === selectedStartup?.name);
    handleSelectStartup(startups[(i + 1) % startups.length]);
  }, [startups, selectedStartup, handleSelectStartup]);

  const handlePrev = useCallback(() => {
    const i = startups.findIndex((s) => s.name === selectedStartup?.name);
    handleSelectStartup(startups[(i - 1 + startups.length) % startups.length]);
  }, [startups, selectedStartup, handleSelectStartup]);

  // ── Voice Commands ──
  const handleVoiceCommand = useCallback((command: string) => {
    const cmd = command.toLowerCase().trim();

    if (/\b(play|resume)\b/.test(cmd) && cmd.split(" ").length <= 3) { if (!isPlaying) handleTogglePlay(); return; }
    if (/\b(pause|stop|mute)\b/.test(cmd) && cmd.split(" ").length <= 3) { if (isPlaying) handleTogglePlay(); return; }
    if (/\b(next|skip|forward)\b/.test(cmd) && cmd.split(" ").length <= 3) { handleNext(); return; }
    if (/\b(previous|prev|back)\b/.test(cmd) && cmd.split(" ").length <= 2) { handlePrev(); return; }
    if (/\b(close|hide|dismiss)\b/.test(cmd) && cmd.split(" ").length <= 2) { setShowInfo(false); return; }
    if (/\b(info|details)\b/.test(cmd) && cmd.split(" ").length <= 3) { setShowInfo(true); return; }
    if (/\b(demo|tour|showcase)\b/.test(cmd) && cmd.split(" ").length <= 3) { setIsDemoMode((p) => !p); return; }
    if (/\b(random|surprise|lucky)\b/.test(cmd) && cmd.split(" ").length <= 3) {
      handleSelectStartup(startups[Math.floor(Math.random() * startups.length)]); return;
    }

    // Mode switching
    if (/\b(story|debate)\b/.test(cmd)) { setGlobeMode("story"); return; }
    if (/\b(call|phone)\b/.test(cmd) && cmd.split(" ").length <= 2) { setGlobeMode("call"); return; }
    if (/\b(sentiment|news)\b/.test(cmd)) { setGlobeMode("sentiment"); return; }
    if (/\b(pricing|price)\b/.test(cmd)) { setGlobeMode("pricing"); return; }
    if (/\b(research|brief)\b/.test(cmd)) { setGlobeMode("research"); return; }

    // Navigate by name/city/country
    const byName = startups.find((s) => cmd.includes(s.name.toLowerCase()));
    if (byName) { handleSelectStartup(byName); return; }
    const byCity = startups.find((s) => cmd.includes(s.city.toLowerCase()));
    if (byCity) { handleSelectStartup(byCity); return; }
    const byCountry = startups.find((s) => cmd.includes(s.country.toLowerCase()));
    if (byCountry) { handleSelectStartup(byCountry); return; }

    // Word fallback
    const words = cmd.split(/\s+/).filter((w) => w.length > 2);
    for (const word of words) {
      const match = startups.find(
        (s) => s.name.toLowerCase().includes(word) || s.city.toLowerCase().includes(word) || s.country.toLowerCase().includes(word)
      );
      if (match) { handleSelectStartup(match); return; }
    }
  }, [startups, isPlaying, handleSelectStartup, handleTogglePlay, handleNext, handlePrev, setGlobeMode]);

  // ── Founder Call (existing loop preserved) ──
  const recordCallQuestion = useCallback(async (): Promise<string> => {
    return new Promise(async (resolve) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        callRecorderRef.current = recorder;
        const chunks: Blob[] = [];

        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.85;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        let silenceStart: number | null = null;
        let hasSpoken = false;
        const SILENCE_THRESHOLD = 15;
        const SILENCE_DURATION = 1500;
        const MAX_DURATION = 15000;

        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

        recorder.onstop = async () => {
          audioCtx.close();
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: "audio/webm" });
          if (blob.size < 500) { resolve(""); return; }
          try {
            const arrayBuffer = await blob.arrayBuffer();
            const resp = await fetch("/api/stt", {
              method: "POST",
              headers: { "Content-Type": "application/octet-stream" },
              body: arrayBuffer,
            });
            const result = await resp.json();
            resolve((result.transcript || "").trim());
          } catch { resolve(""); }
        };

        recorder.start();
        const startTime = Date.now();

        const checkSilence = () => {
          if (recorder.state !== "recording") return;
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
          if (avg > SILENCE_THRESHOLD) { hasSpoken = true; silenceStart = null; }
          else if (hasSpoken) {
            if (!silenceStart) silenceStart = Date.now();
            if (Date.now() - silenceStart > SILENCE_DURATION) { recorder.stop(); return; }
          }
          if (Date.now() - startTime > MAX_DURATION) { recorder.stop(); return; }
          requestAnimationFrame(checkSilence);
        };
        requestAnimationFrame(checkSilence);
      } catch { resolve(""); }
    });
  }, []);

  const runCallLoop = useCallback(async (startup: Startup) => {
    callActiveRef.current = true;
    setCallDuration(0);
    setCallMessages([]);
    callTimerRef.current = window.setInterval(() => setCallDuration((d) => d + 1), 1000);

    const greeting = `Hey! I'm the founder of ${startup.name}. ${startup.tagline}. What would you like to know?`;
    setCallMessages((m) => [...m, { role: "assistant", text: greeting }]);

    const greetAudio = await speakWithTTS(greeting, startup.industry);
    if (greetAudio && callActiveRef.current) {
      audioRef.current = greetAudio;
      await new Promise<void>((res) => { greetAudio.onended = () => res(); greetAudio.play(); });
    }

    while (callActiveRef.current) {
      const question = await recordCallQuestion();
      if (!callActiveRef.current) break;
      if (!question) continue;

      setCallMessages((m) => [...m, { role: "user", text: question }]);

      if (/\b(bye|goodbye|hang up|end call|thanks|thank you|that's all|done)\b/i.test(question)) {
        const farewell = `Thanks for calling! Glad I could share about ${startup.name}. Take care!`;
        setCallMessages((m) => [...m, { role: "assistant", text: farewell }]);
        const byeAudio = await speakWithTTS(farewell, startup.industry);
        if (byeAudio && callActiveRef.current) {
          audioRef.current = byeAudio;
          await new Promise<void>((res) => { byeAudio.onended = () => res(); byeAudio.play(); });
        }
        break;
      }

      try {
        addEntry("/search", startup.name, "loading");
        const aiRes = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, startup }),
        });
        const { answer } = await aiRes.json();
        updateLast("done", `${answer.length} chars`);
        if (!callActiveRef.current) break;

        setCallMessages((m) => [...m, { role: "assistant", text: answer }]);
        const ansAudio = await speakWithTTS(answer, startup.industry);
        if (ansAudio && callActiveRef.current) {
          audioRef.current = ansAudio;
          await new Promise<void>((res) => { ansAudio.onended = () => res(); ansAudio.play(); });
        }
      } catch {
        showToast("AI response failed", "error");
      }
    }

    callActiveRef.current = false;
    setIsCalling(false);
    if (callTimerRef.current) clearInterval(callTimerRef.current);
  }, [speakWithTTS, recordCallQuestion, addEntry, updateLast, showToast]);

  const handleCallFounder = useCallback(async () => {
    if (!selectedStartup) return;
    if (isCalling) {
      callActiveRef.current = false;
      if (callRecorderRef.current?.state === "recording") callRecorderRef.current.stop();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setIsCalling(false);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      return;
    }
    setIsCalling(true);
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);
    runCallLoop(selectedStartup);
  }, [selectedStartup, isCalling, runCallLoop]);

  // ── Dubbing handler ──
  const handleDub = useCallback(async (langCode: string) => {
    if (storyExchanges.length === 0) {
      showToast("Generate a story first, then dub it", "error");
      return;
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    setDubbingLanguage(langCode);
    setIsDubbing(true);
    setIsPlaying(true);
    showToast(`Dubbing to ${langCode}...`, "info");

    try {
      const response = await fetch("/api/dub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchanges: storyExchanges,
          targetLanguage: langCode,
          startupName: selectedStartup?.name || "",
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Dubbing failed" }));
        throw new Error(err.error || "Dubbing failed");
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => { setIsPlaying(false); URL.revokeObjectURL(audioUrl); };
      audio.play();
      showToast(`Now playing in ${langCode}`, "success");
    } catch (err: any) {
      showToast(err.message || "Dubbing failed", "error");
      setIsPlaying(false);
    } finally {
      setIsDubbing(false);
    }
  }, [showToast, storyExchanges, selectedStartup]);

  // ── Demo Mode ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
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
        index = (index + 1) % startups.length;
        handleSelectStartup(startups[index]);
      }, 20000);
    } else {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    }
    return () => { if (demoIntervalRef.current) clearInterval(demoIntervalRef.current); };
  }, [isDemoMode, startups, handleSelectStartup]);

  return (
    <div className="relative w-full h-screen bg-[#050510] overflow-hidden font-sans text-white">
      {/* Globe */}
      <Globe startups={startups} onSelectStartup={handleSelectStartup} selectedStartup={selectedStartup} />

      {/* Mode Switcher */}
      <ModeSwitcher activeMode={globeMode} onModeChange={setGlobeMode} />

      {/* UI Overlays - Top Left */}
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
            <div className={`w-2 h-2 rounded-full animate-pulse ${isLive ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
              {isLive ? "Live YC Feed" : "Archive Mode"}
            </span>
          </div>
          {!isLive && !loading && (
            <button onClick={() => setRetryCount((c) => c + 1)} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/10 text-[10px] font-bold text-white transition-colors flex items-center gap-1 ml-2">
              <Zap size={10} className="text-amber-400" /> RETRY SCRAPE
            </button>
          )}
          {isDemoMode && (
            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }} className="px-2 py-1 rounded bg-red-500/20 border border-red-500/50 text-[10px] font-bold text-red-500 flex items-center gap-1">
              <Zap size={10} /> DEMO MODE
            </motion.div>
          )}
        </div>
      </div>

      <VoiceCommand onCommand={handleVoiceCommand} />

      {/* Radio Panel */}
      <AnimatePresence>
        {selectedStartup && (
          <RadioPanel
            selectedStartup={selectedStartup}
            isPlaying={isPlaying}
            isCalling={isCalling}
            globeMode={globeMode}
            exchanges={storyExchanges}
            onTogglePlay={handleTogglePlay}
            onCall={handleCallFounder}
            onNext={handleNext}
            onPrev={handlePrev}
            onShowInfo={() => setShowInfo(true)}
            onShowNewspaper={() => setShowNewspaper(true)}
            onDub={handleDub}
            dubbingLanguage={dubbingLanguage}
            isDubbing={isDubbing}
            techInfo={techInfo}
          />
        )}
      </AnimatePresence>

      {/* Firecrawl Ticker */}
      <FirecrawlTicker entries={crawlLog} />

      {/* Mode Panels */}
      <AnimatePresence>
        {selectedStartup && globeMode === "sentiment" && (
          <SentimentPanel data={sentimentResult} loading={sentimentLoading} startupName={selectedStartup.name} />
        )}
        {selectedStartup && globeMode === "pricing" && (
          <PricingPanel data={pricingResult} loading={pricingLoading} startupName={selectedStartup.name} />
        )}
        {selectedStartup && globeMode === "research" && (
          <ResearchPanel data={researchResult} loading={researchLoading} startupName={selectedStartup.name} />
        )}
        {selectedStartup && globeMode === "changes" && (
          <ChangesPanel entries={changesResult} loading={changesLoading} startupName={selectedStartup.name} />
        )}
      </AnimatePresence>

      {/* Call Overlay */}
      {selectedStartup && (
        <CallOverlay
          startup={selectedStartup}
          isActive={isCalling}
          duration={callDuration}
          messages={callMessages}
          isMuted={isMuted}
          onEndCall={handleCallFounder}
          onToggleMute={() => setIsMuted(!isMuted)}
        />
      )}

      {/* Newspaper View */}
      <NewspaperView
        visible={showNewspaper}
        startupName={selectedStartup?.name || ""}
        tension={storyTension}
        exchanges={storyExchanges}
        onClose={() => setShowNewspaper(false)}
      />

      {/* Info Modal */}
      <AnimatePresence>
        {showInfo && selectedStartup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-[#0a0a1a] border border-white/10 rounded-3xl p-8 max-w-lg w-full relative shadow-2xl">
              <button onClick={() => setShowInfo(false)} className="absolute top-6 right-6 text-white/30 hover:text-white transition-colors">
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
                  <p className="text-sm italic text-white/70">&quot;{selectedStartup.founder_quote || "Building the future of " + selectedStartup.industry.toLowerCase() + "."}&quot;</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Watch List */}
      <WatchList
        entries={watchEntries}
        alerts={watchAlertHistory}
        isWatchMode={isWatchMode}
        onToggleWatchMode={() => setIsWatchMode(!isWatchMode)}
        onRemove={handleWatchRemove}
        onCheckNow={handleWatchCheck}
        onPlayAlert={handlePlayAlert}
        products={productEntries}
        onAddProduct={handleAddProduct}
        onRemoveProduct={handleRemoveProduct}
        onCheckProduct={handleCheckProduct}
      />

      {/* Incoming Call */}
      {incomingAlert && (
        <IncomingCall
          company={incomingAlert.company}
          domain={incomingAlert.domain}
          summary={incomingAlert.summary}
          agentId={incomingAlert.agentId}
          isActive={!!incomingAlert}
          onAccept={() => {}}
          onDecline={() => setIncomingAlert(null)}
        />
      )}

      {/* Loading Screen */}
      <AnimatePresence>
        {loading && (
          <motion.div exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-[#050510] flex flex-col items-center justify-center">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="w-16 h-16 border-4 border-white/10 border-t-white rounded-full mb-8" />
            <h2 className="text-xl font-bold tracking-widest uppercase">Initializing Orbit</h2>
            <p className="text-white/30 text-xs mt-2 uppercase tracking-[0.3em]">Calibrating Satellite Uplink</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default App;
