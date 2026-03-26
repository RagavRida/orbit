import { useState, useCallback, useEffect } from "react";
import { GlobeMode, MODES } from "../lib/modes";
import { Startup } from "../types";

export function useGlobeMode() {
  const [mode, setMode] = useState<GlobeMode>("call");
  const [sentimentData, setSentimentData] = useState<
    Record<string, { sentiment: string; score: number; sources: number; topHeadline: string }>
  >({});
  const [pricingComparison, setPricingComparison] = useState<Startup | null>(null);

  // Keyboard shortcuts 1-6
  useEffect(() => {
    const modes: GlobeMode[] = ["story", "call", "sentiment", "pricing", "changes", "research"];
    const handleKey = (e: KeyboardEvent) => {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 6 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        setMode(modes[num - 1]);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const fetchSentiment = useCallback(async (name: string) => {
    if (sentimentData[name]) return sentimentData[name];
    try {
      const res = await fetch("/api/sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      setSentimentData((prev) => ({ ...prev, [name]: data }));
      return data;
    } catch {
      return { sentiment: "neutral", score: 0, sources: 0, topHeadline: "Failed to fetch" };
    }
  }, [sentimentData]);

  const setPricingTarget = useCallback((startup: Startup | null) => {
    setPricingComparison(startup);
  }, []);

  return {
    mode,
    setMode,
    modeConfig: MODES[mode],
    sentimentData,
    fetchSentiment,
    pricingComparison,
    setPricingTarget,
  };
}
