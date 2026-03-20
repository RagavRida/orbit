export interface Startup {
  name: string;
  tagline: string;
  city: string;
  country: string;
  industry: string;
  logo: string;
  lat: number;
  lng: number;
  founder_voice_id?: string;
  founder_quote?: string;
  founding_year?: number;
}

export type Industry = "AI" | "Fintech" | "Health" | "SaaS" | "Consumer" | "Climate" | "Other";

export const INDUSTRY_COLORS: Record<string, string> = {
  AI: "#a855f7", // purple
  Fintech: "#22c55e", // green
  Health: "#ef4444", // red
  SaaS: "#3b82f6", // blue
  Consumer: "#f97316", // orange
  Climate: "#14b8a6", // teal
  Other: "#94a3b8", // slate
};

export const INDUSTRY_VOICES: Record<string, string> = {
  AI: "Zephyr",
  Fintech: "Fenrir",
  Health: "Kore",
  SaaS: "Puck",
  Consumer: "Charon",
  Climate: "Zephyr",
  Other: "Kore",
};
