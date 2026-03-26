import { Startup, INDUSTRY_COLORS } from "../types";

export type GlobeMode =
  | "story"
  | "call"
  | "sentiment"
  | "pricing"
  | "changes"
  | "research";

export interface ModeConfig {
  label: string;
  icon: string;
  description: string;
  firecrawlEndpoint: string;
  elevenlabsFeature: string;
  markerColor: (startup: Startup, data?: any) => string;
}

export const MODES: Record<GlobeMode, ModeConfig> = {
  story: {
    label: "Story",
    icon: "🎙",
    description: "Hear a 2-host debate about any startup",
    firecrawlEndpoint: "/crawl",
    elevenlabsFeature: "Text to Dialogue",
    markerColor: (s) => INDUSTRY_COLORS[s.industry] || INDUSTRY_COLORS.Other,
  },
  call: {
    label: "Call",
    icon: "📞",
    description: "Call the founder and ask anything",
    firecrawlEndpoint: "/crawl + /search",
    elevenlabsFeature: "Conversational AI",
    markerColor: (s) => INDUSTRY_COLORS[s.industry] || INDUSTRY_COLORS.Other,
  },
  sentiment: {
    label: "Sentiment",
    icon: "📈",
    description: "Live news sentiment as globe colors",
    firecrawlEndpoint: "/search",
    elevenlabsFeature: "Text to Speech",
    markerColor: (_s, data) =>
      data?.sentiment === "positive"
        ? "#22c55e"
        : data?.sentiment === "negative"
        ? "#ef4444"
        : "#ffffff",
  },
  pricing: {
    label: "Pricing",
    icon: "💰",
    description: "Compare live pricing between startups",
    firecrawlEndpoint: "/scrape",
    elevenlabsFeature: "Text to Speech",
    markerColor: (s) => INDUSTRY_COLORS[s.industry] || INDUSTRY_COLORS.Other,
  },
  changes: {
    label: "Changes",
    icon: "🔴",
    description: "Startups that changed their site today",
    firecrawlEndpoint: "/scrape + change detection",
    elevenlabsFeature: "Sound Effects",
    markerColor: (_s, data) => (data?.hasChanged ? "#f97316" : "#333333"),
  },
  research: {
    label: "Research",
    icon: "🔍",
    description: "60-second audio briefing on any startup",
    firecrawlEndpoint: "/agent",
    elevenlabsFeature: "Text to Dialogue + Music",
    markerColor: (s) => INDUSTRY_COLORS[s.industry] || INDUSTRY_COLORS.Other,
  },
};

export const MODE_LIST = Object.entries(MODES) as [GlobeMode, ModeConfig][];
