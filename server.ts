import express from "express";
import { createServer as createViteServer } from "vite";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import dotenv from "dotenv";
import { Readable } from "stream";
import twilio from "twilio";
import { WebSocketServer, WebSocket } from "ws";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── In-memory Cache ──
const cache = new Map<string, { data: any; expires: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { cache.delete(key); return null; }
  return entry.data as T;
}

function setCached(key: string, data: any, ttlMs: number) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

const CACHE_TTL = {
  story: 30 * 60 * 1000,       // 30 min
  sentiment: 15 * 60 * 1000,   // 15 min
  pricing: 60 * 60 * 1000,     // 1 hour
  research: 60 * 60 * 1000,    // 1 hour
  ambient: Infinity,            // permanent
  nearby: 10 * 60 * 1000,      // 10 min
};

const INDUSTRY_AMBIENT_PROMPTS: Record<string, string> = {
  AI: 'server room humming, data center ambient, tech sounds',
  Fintech: 'trading floor ambience, subtle keyboard sounds',
  Health: 'hospital ambience, soft medical equipment sounds',
  SaaS: 'startup office, coffee shop productivity sounds',
  Consumer: 'busy marketplace, customer activity sounds',
  Climate: 'nature sounds, wind turbines, environmental',
  Other: 'professional office ambient, subtle background',
};

// Strip emotion tags like [laughs], [sighs], etc. from text before TTS
function stripEmotionTags(text: string): string {
  return text.replace(/\[\w+(?:\s+\w+)*\]/g, '').replace(/\s{2,}/g, ' ').trim();
}

const TTS_MODEL = "eleven_flash_v2_5";
const TTS_SETTINGS = { stability: 0.5, similarity_boost: 0.75 };

// ══════════════ COMPETITOR WATCH ══════════════

interface ChangeEvent {
  timestamp: number;
  summary: string;
  url: string;
  diff: string;
  changedSection?: string; // which section changed (homepage, pricing, etc.)
}

interface KnowledgeBase {
  homepage: string;
  aboutPage: string;
  pricingPage: string;
  productsPage: string;
  newsResults: string;
  competitiveIntel: string;
  structuredData?: Record<string, any>; // JSON-extracted competitor metrics
  lastUpdated: number;
}

interface WatchEntry {
  slug: string;
  domain: string;
  addedAt: number;
  lastChange?: ChangeEvent;
  lastContent?: string;
  lastChecked?: number;
  crawlJobId?: string;
  notifyCount: number;
  companyName: string;
  knowledge?: KnowledgeBase;
  monitoredPages: string[];
}

interface AlertHistoryEntry {
  slug: string;
  company: string;
  timestamp: number;
  summary: string;
  changedUrl: string;
  acknowledged: boolean;
}

const watchList = new Map<string, WatchEntry>();
const alertHistory: AlertHistoryEntry[] = [];
const sseClients = new Set<import("express").Response>();

// ══════════════ PRODUCT & E-COMMERCE TRACKER ══════════════

interface ProductData {
  title: string;
  price: number | null;
  currency: string;
  originalPrice: number | null; // before discount
  availability: string; // "in-stock" | "out-of-stock" | "limited" | "unknown"
  rating: number | null;
  reviewCount: number | null;
  features: string[];
  lastUpdated: number;
}

interface ProductWatch {
  id: string;
  url: string;
  name: string; // user-given name like "MacBook Pro M4"
  alertConditions: {
    priceBelow?: number;        // alert when price drops below this
    priceDropPercent?: number;   // alert on X% price drop
    backInStock?: boolean;       // alert when back in stock
    anyChange?: boolean;         // alert on any change
  };
  currentData: ProductData | null;
  previousData: ProductData | null;
  addedAt: number;
  lastChecked: number;
  alertCount: number;
  userPhone?: string;
}

const productWatchList = new Map<string, ProductWatch>();

// ── Scrape product page with JSON extraction ──
const productJsonSchema = {
  type: "json" as const,
  prompt: "Extract product details: title, current price (numeric), currency, original price before discount, availability status, rating out of 5, review count, key features/specs",
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      price: { type: "number" },
      currency: { type: "string" },
      originalPrice: { type: "number" },
      availability: { type: "string" },
      rating: { type: "number" },
      reviewCount: { type: "number" },
      features: { type: "array", items: { type: "string" } },
    },
  },
};

async function scrapeProduct(url: string, firecrawlKey: string): Promise<ProductData | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${firecrawlKey}` },
      body: JSON.stringify({
        url,
        formats: ["markdown", productJsonSchema, { type: "changeTracking", modes: ["git-diff"] }],
        waitFor: 3000,
        timeout: 25000,
        actions: [
          { type: "scroll", direction: "down" },
          { type: "wait", milliseconds: 1000 },
          { type: "scroll", direction: "down" },
          { type: "wait", milliseconds: 500 },
        ],
      }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    const json = d.data?.json;
    if (!json) return null;

    return {
      title: json.title || "Unknown Product",
      price: typeof json.price === "number" ? json.price : null,
      currency: json.currency || "USD",
      originalPrice: typeof json.originalPrice === "number" ? json.originalPrice : null,
      availability: json.availability || "unknown",
      rating: typeof json.rating === "number" ? json.rating : null,
      reviewCount: typeof json.reviewCount === "number" ? json.reviewCount : null,
      features: Array.isArray(json.features) ? json.features : [],
      lastUpdated: Date.now(),
    };
  } catch (e) {
    console.warn("[ProductWatch] Scrape error:", e);
    return null;
  }
}

// ── Handle product alert — creates ElevenLabs agent + Twilio call ──
async function handleProductAlert(watch: ProductWatch, alertMessage: string) {
  console.log(`[ProductWatch] 🚨 Alert for "${watch.name}": ${alertMessage}`);
  watch.alertCount++;

  // Broadcast via SSE
  broadcastSSE({
    type: "product-alert",
    productId: watch.id,
    name: watch.name,
    url: watch.url,
    message: alertMessage,
    currentData: watch.currentData,
    timestamp: Date.now(),
  });

  // Place phone call via ElevenLabs + Twilio
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
  const userPhone = watch.userPhone || process.env.USER_PHONE_NUMBER;
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  let agentId: string | undefined;
  if (elevenLabsKey) {
    try {
      const pd = watch.currentData!;
      const persona = `You are Orbit, a product tracking AI assistant. You are calling the user about a product alert.\n\nProduct: ${watch.name}\nURL: ${watch.url}\nAlert: ${alertMessage}\nCurrent price: ${pd.price ? `${pd.currency} ${pd.price}` : "unknown"}\nAvailability: ${pd.availability}\nRating: ${pd.rating || "N/A"}\n\nOpen with: "Hi, this is Orbit with a product update for you."\nTell them the alert clearly. Answer follow-up questions about the product. End when they say thanks or goodbye.`;

      const agentRes = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
        method: "POST",
        headers: { "xi-api-key": elevenLabsKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Orbit Product: ${watch.name}`,
          conversation_config: {
            agent: { prompt: { prompt: persona }, first_message: `Hi, this is Orbit with a product update! ${alertMessage}`, language: "en" },
            tts: { voice_id: "nPczCjzI2devNBz1zQrb", model_id: "eleven_flash_v2_5" },
          },
        }),
      });
      if (agentRes.ok) {
        const data = await agentRes.json();
        agentId = data.agent_id;
      }
    } catch (e) { console.warn("[ProductWatch] Agent error:", e); }
  }

  const callKey = `product-${watch.id}-${userPhone}`;
  if (twilioSid && twilioToken && twilioPhone && userPhone && !appUrl.includes("localhost") && canPlaceCall(callKey)) {
    try {
      const client = twilio(twilioSid, twilioToken);
      pendingVoiceMessages.set(`product-${watch.id}`, {
        company: watch.name,
        domain: watch.url,
        summary: alertMessage,
        agentId,
      });
      await client.calls.create({
        to: userPhone,
        from: twilioPhone,
        url: `${appUrl}/api/watch/voice/product-${watch.id}`,
        statusCallback: `${appUrl}/api/watch/call-status/product-${watch.id}`,
        statusCallbackEvent: ["completed"],
      });
      recordCallPlaced(callKey);
      console.log(`[ProductWatch] 📞 Calling ${userPhone} about: ${alertMessage}`);
    } catch (e) { console.warn("[ProductWatch] Call error:", e); }
  } else if (!canPlaceCall(callKey)) {
    console.log(`[ProductWatch] Skipping call for ${watch.id} — cooldown active`);
  }
}

// ── Check a product for alert conditions ──
function checkProductAlerts(watch: ProductWatch): string | null {
  const curr = watch.currentData;
  const prev = watch.previousData;
  if (!curr) return null;

  const conditions = watch.alertConditions;

  // Price drop below threshold
  if (conditions.priceBelow && curr.price && curr.price <= conditions.priceBelow) {
    return `🔥 Price drop! "${watch.name}" is now ${curr.currency} ${curr.price} — below your target of ${curr.currency} ${conditions.priceBelow}!`;
  }

  // Percentage price drop
  if (conditions.priceDropPercent && curr.price && prev?.price && prev.price > 0) {
    const dropPct = ((prev.price - curr.price) / prev.price) * 100;
    if (dropPct >= conditions.priceDropPercent) {
      return `📉 "${watch.name}" dropped ${dropPct.toFixed(0)}% — from ${curr.currency} ${prev.price} to ${curr.currency} ${curr.price}!`;
    }
  }

  // Back in stock
  if (conditions.backInStock && prev?.availability !== "in-stock" && curr.availability === "in-stock") {
    return `✅ "${watch.name}" is back in stock! Current price: ${curr.price ? `${curr.currency} ${curr.price}` : "check listing"}`;
  }

  // Any change detection
  if (conditions.anyChange && prev) {
    const changes: string[] = [];
    if (curr.price !== prev.price) changes.push(`price: ${prev.price} → ${curr.price}`);
    if (curr.availability !== prev.availability) changes.push(`availability: ${prev.availability} → ${curr.availability}`);
    if (curr.rating !== prev.rating) changes.push(`rating: ${prev.rating} → ${curr.rating}`);
    const newFeatures = curr.features.filter(f => !prev.features.includes(f));
    if (newFeatures.length > 0) changes.push(`new features: ${newFeatures.join(", ")}`);
    if (changes.length > 0) {
      return `🔄 "${watch.name}" updated: ${changes.join("; ")}`;
    }
  }

  return null;
}

function computeDiff(before: string, after: string): string {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const added = afterLines.filter(l => !beforeLines.includes(l));
  const removed = beforeLines.filter(l => !afterLines.includes(l));
  return [
    ...removed.slice(0, 20).map(l => `- ${l}`),
    ...added.slice(0, 20).map(l => `+ ${l}`)
  ].join('\n').slice(0, 2000);
}

function broadcastSSE(data: any) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(msg); } catch { sseClients.delete(client); }
  }
}

// ── Scrape a single page via Firecrawl with native Change Tracking ──
// Uses Firecrawl's changeTracking format with git-diff mode:
// - Firecrawl stores snapshots server-side (persistent, per-team)
// - Returns changeStatus: "new" | "same" | "changed" | "removed"
// - Returns diff.text with proper git-diff output when status is "changed"
interface ScrapeResult {
  markdown: string;
  status: string;
  changeStatus: "new" | "same" | "changed" | "removed" | "unknown";
  diffText: string;
  previousScrapeAt: string | null;
}

async function scrapePage(url: string, firecrawlKey: string): Promise<ScrapeResult> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${firecrawlKey}` },
      body: JSON.stringify({
        url,
        formats: ["markdown", { type: "changeTracking", modes: ["git-diff"] }],
        onlyMainContent: true,
        timeout: 15000,
      }),
    });
    if (!res.ok) return { markdown: "", status: "failed", changeStatus: "unknown", diffText: "", previousScrapeAt: null };
    const d = await res.json();
    const ct = d.data?.changeTracking;
    console.log(`[Watch] scrapePage ${url} → changeStatus: ${ct?.changeStatus || "none"}, previousScrapeAt: ${ct?.previousScrapeAt || "null"}, markdown: ${(d.data?.markdown || "").length} chars`);
    return {
      markdown: d.data?.markdown || "",
      status: "ok",
      changeStatus: ct?.changeStatus || "unknown",
      diffText: ct?.diff?.text || "",
      previousScrapeAt: ct?.previousScrapeAt || null,
    };
  } catch { return { markdown: "", status: "error", changeStatus: "unknown", diffText: "", previousScrapeAt: null }; }
}

// ── Map a website to discover all URLs ──
async function mapSite(domain: string, firecrawlKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/map", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${firecrawlKey}` },
      body: JSON.stringify({
        url: `https://${domain}`,
        limit: 50,
        search: "pricing about products features blog careers team",
      }),
    });
    if (!res.ok) {
      console.log(`[Watch] Map failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const links: string[] = data.links || [];
    console.log(`[Watch] Map discovered ${links.length} URLs on ${domain}`);
    return links;
  } catch (e) {
    console.warn(`[Watch] Map error:`, e);
    return [];
  }
}

// ── Competitor intelligence JSON schema for structured extraction ──
const competitorJsonSchema = {
  type: "json" as const,
  prompt: "Extract structured competitor intelligence from this page",
  schema: {
    type: "object",
    properties: {
      companyDescription: { type: "string" },
      pricing: { type: "array", items: { type: "object", properties: {
        plan: { type: "string" }, price: { type: "string" },
        features: { type: "array", items: { type: "string" } },
      }}},
      keyFeatures: { type: "array", items: { type: "string" } },
      teamSize: { type: "string" },
      recentUpdates: { type: "array", items: { type: "string" } },
      partnerships: { type: "array", items: { type: "string" } },
    },
  },
};

// ── Build comprehensive knowledge base for a competitor ──
// Pipeline: Map site → Crawl relevant pages (with waitFor + actions + JSON extraction) → Search news/competitive
interface KnowledgeBuildResult {
  knowledge: KnowledgeBase;
  monitoredPages: string[];
  changeResults: { section: string; changeStatus: string; diffText: string }[];
}

async function buildKnowledgeBase(domain: string, companyName: string, firecrawlKey: string): Promise<KnowledgeBuildResult> {
  const monitoredPages: string[] = [];
  const changeResults: { section: string; changeStatus: string; diffText: string }[] = [];
  const baseUrl = `https://${domain}`;
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "numeric", hour12: true });

  // ── Step 1: Map the site to discover all URLs ──
  const discoveredUrls = await mapSite(domain, firecrawlKey);

  // Filter for relevant pages by URL patterns
  const relevantPatterns = [
    { pattern: /\/(pricing|plans|packages)/i, category: "pricing" },
    { pattern: /\/(about|team|company|who-we-are|our-story)/i, category: "about" },
    { pattern: /\/(product|features|solutions|services|platform)/i, category: "products" },
    { pattern: /\/(blog|news|updates|changelog)/i, category: "blog" },
    { pattern: /\/(careers|jobs|hiring)/i, category: "careers" },
  ];

  // Pick target URLs: up to 2 per category + homepage
  const targetUrls: Set<string> = new Set([baseUrl]);
  const categoryHits: Record<string, number> = {};
  for (const url of discoveredUrls) {
    for (const { pattern, category } of relevantPatterns) {
      if (pattern.test(url)) {
        if ((categoryHits[category] || 0) < 2) {
          targetUrls.add(url);
          categoryHits[category] = (categoryHits[category] || 0) + 1;
        }
      }
    }
    if (targetUrls.size >= 12) break; // Cap at 12 URLs
  }
  console.log(`[Watch] Map filtered: ${targetUrls.size} target URLs from ${discoveredUrls.length} discovered (categories: ${JSON.stringify(categoryHits)})`);

  // ── Step 2: Crawl with waitFor + actions + JSON extraction + changeTracking ──
  // 3 things in parallel: (1) Crawl targeted pages, (2) News search, (3) Competitive intel search
  const [crawlResult, newsResults, competitorSearch] = await Promise.allSettled([
    // 1. Crawl with enhanced scrapeOptions
    (async () => {
      console.log(`[Watch] Crawling ${baseUrl} (${targetUrls.size} targeted pages)...`);
      const crawlRes = await fetch("https://api.firecrawl.dev/v1/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${firecrawlKey}` },
        body: JSON.stringify({
          url: baseUrl,
          limit: Math.max(targetUrls.size, 10),
          includePaths: discoveredUrls.length > 0
            ? [".*/(pricing|plans|about|team|company|product|features|solutions|blog|careers).*"]
            : undefined,
          scrapeOptions: {
            formats: [
              "markdown",
              { type: "changeTracking", modes: ["git-diff"] },
              competitorJsonSchema,
            ],
            onlyMainContent: true,
            waitFor: 3000, // Wait 3s for JS rendering
            timeout: 30000,
            actions: [
              { type: "scroll", direction: "down" },
              { type: "wait", milliseconds: 1000 },
              { type: "scroll", direction: "down" },
              { type: "wait", milliseconds: 500 },
            ],
          },
        }),
      });
      if (!crawlRes.ok) {
        console.log(`[Watch] Crawl request failed: ${crawlRes.status}`);
        return { pages: [] as any[], crawlId: null };
      }
      const crawlData = await crawlRes.json();
      const crawlId = crawlData.id || crawlData.jobId;
      console.log(`[Watch] Crawl started: ${crawlId}, polling for results...`);

      // Poll for crawl completion (max 90 seconds)
      let pages: any[] = [];
      for (let i = 0; i < 18; i++) {
        await new Promise(r => setTimeout(r, 5000));
        try {
          const statusRes = await fetch(`https://api.firecrawl.dev/v1/crawl/${crawlId}`, {
            headers: { Authorization: `Bearer ${firecrawlKey}` },
          });
          if (!statusRes.ok) continue;
          const statusData = await statusRes.json();
          if (statusData.status === "completed") {
            pages = statusData.data || [];
            console.log(`[Watch] Crawl completed: ${pages.length} pages scraped`);
            break;
          } else if (statusData.status === "failed") {
            console.log(`[Watch] Crawl failed`);
            break;
          }
          if (statusData.data?.length > 0) pages = statusData.data;
        } catch { /* continue polling */ }
      }
      return { pages, crawlId };
    })(),
    // 2. News search via MCP (date-aware)
    (async () => {
      const client = await getFirecrawlMcpClient();
      if (!client) return [] as { markdown: string }[];
      const result = await client.callTool({ name: "firecrawl_search", arguments: { query: `${companyName} latest news updates ${dateStr}`, limit: 3 } });
      const texts = ((result.content as any[]) || []).filter((p: any) => p.type === "text" && p.text).map((p: any) => ({ markdown: p.text! }));
      return texts;
    })(),
    // 3. Competitive intel search via MCP (date-aware)
    (async () => {
      const client = await getFirecrawlMcpClient();
      if (!client) return [] as { markdown: string }[];
      const result = await client.callTool({ name: "firecrawl_search", arguments: { query: `${companyName} competitors analysis market share ${dateStr}`, limit: 3 } });
      const texts = ((result.content as any[]) || []).filter((p: any) => p.type === "text" && p.text).map((p: any) => ({ markdown: p.text! }));
      return texts;
    })(),
  ]);

  // ── Step 3: Classify crawled pages into knowledge categories ──
  let hp = "", ab = "", pr = "", pd = "";
  let structuredData: Record<string, any> = {};

  if (crawlResult.status === "fulfilled" && crawlResult.value.pages.length > 0) {
    for (const page of crawlResult.value.pages) {
      const url = (page.metadata?.url || page.url || "").toLowerCase();
      const md = page.markdown || "";
      const ct = page.changeTracking;
      const jsonData = page.json;
      if (!md) continue;

      monitoredPages.push(url);

      // Merge JSON-extracted structured data
      if (jsonData && typeof jsonData === "object") {
        structuredData = { ...structuredData, ...jsonData };
      }

      // Track change status
      if (ct?.changeStatus) {
        const section = url.includes("/about") || url.includes("/team") ? "aboutPage"
          : url.includes("/pricing") || url.includes("/plans") ? "pricingPage"
          : url.includes("/product") || url.includes("/features") ? "productsPage"
          : "homepage";
        changeResults.push({ section, changeStatus: ct.changeStatus, diffText: ct.diff?.text || "" });
      }

      // Classify by URL pattern
      if (url.includes("/about") || url.includes("/team") || url.includes("/company")) {
        if (!ab) ab = md;
      } else if (url.includes("/pricing") || url.includes("/plans")) {
        if (!pr) pr = md;
      } else if (url.includes("/product") || url.includes("/features") || url.includes("/solutions")) {
        if (!pd) pd = md;
      } else if (!hp) {
        hp = md;
      }
    }
    console.log(`[Watch] Crawl classified: homepage:${hp.length}, about:${ab.length}, pricing:${pr.length}, products:${pd.length} chars | JSON keys: ${Object.keys(structuredData).join(", ") || "none"}`);
  }

  // ── Step 4: Search fallback for empty categories ──
  const emptyPages: { key: string; query: string; setter: (v: string) => void }[] = [];
  if (!hp) emptyPages.push({ key: "homepage", query: `${companyName} official website overview what they do`, setter: v => hp = v });
  if (!ab) emptyPages.push({ key: "aboutPage", query: `${companyName} about company team mission founders`, setter: v => ab = v });
  if (!pr) emptyPages.push({ key: "pricingPage", query: `${companyName} pricing plans cost subscription`, setter: v => pr = v });
  if (!pd) emptyPages.push({ key: "productsPage", query: `${companyName} products services features offerings`, setter: v => pd = v });

  if (emptyPages.length > 0) {
    console.log(`[Watch] ${emptyPages.length} categories empty after crawl, using search fallback...`);
    const client = await getFirecrawlMcpClient();
    if (client) {
      const fallbackResults = await Promise.allSettled(
        emptyPages.map(ep =>
          client.callTool({ name: "firecrawl_search", arguments: { query: ep.query, limit: 2 } })
            .then(r => {
              const texts = ((r.content as any[]) || []).filter((p: any) => p.type === "text" && p.text).map((p: any) => p.text!);
              return { key: ep.key, text: texts.join("\n").substring(0, 3000) };
            })
        )
      );
      for (const fr of fallbackResults) {
        if (fr.status === "fulfilled" && fr.value.text) {
          const ep = emptyPages.find(e => e.key === fr.value.key);
          if (ep) ep.setter(fr.value.text);
          console.log(`[Watch] Fallback search for ${fr.value.key}: ${fr.value.text.length} chars`);
        }
      }
    }
  }

  const news = newsResults.status === "fulfilled" ? (newsResults.value as { markdown: string }[]).map(r => r.markdown).join("\n") : "";
  const comp = competitorSearch.status === "fulfilled" ? (competitorSearch.value as { markdown: string }[]).map(r => r.markdown).join("\n") : "";

  if (hp && !monitoredPages.some(p => p === baseUrl)) monitoredPages.push(baseUrl);
  if (news) monitoredPages.push("news-search");
  if (comp) monitoredPages.push("competitive-intel");

  const changeStatusLog = changeResults.map(cr => `${cr.section}:${cr.changeStatus}`).join(", ");
  console.log(`[Watch] Knowledge base built for ${domain}: ${monitoredPages.length} sources | Change tracking: ${changeStatusLog || "none"}`);

  return {
    knowledge: {
      homepage: hp.substring(0, 5000),
      aboutPage: ab.substring(0, 3000),
      pricingPage: pr.substring(0, 3000),
      productsPage: pd.substring(0, 3000),
      newsResults: news.substring(0, 3000),
      competitiveIntel: comp.substring(0, 3000),
      structuredData: Object.keys(structuredData).length > 0 ? structuredData : undefined,
      lastUpdated: Date.now(),
    },
    monitoredPages,
    changeResults,
  };
}

// ── Detect changes using Firecrawl's native changeTracking + fallback comparison ──
// For scraped pages: uses changeStatus from Firecrawl (server-side persistent snapshots)
// For search results (news/competitive): uses our local computeDiff fallback
function detectChanges(
  oldKb: KnowledgeBase | undefined,
  freshResult: KnowledgeBuildResult,
): { changedSections: string[]; combinedDiff: string } {
  const changedSections: string[] = [];
  const diffs: Record<string, string> = {};

  // 1. Check scraped pages via Firecrawl changeStatus (authoritative)
  for (const cr of freshResult.changeResults) {
    if (cr.changeStatus === "changed") {
      changedSections.push(cr.section);
      diffs[cr.section] = cr.diffText || `[Firecrawl detected changes on ${cr.section}]`;
    } else if (cr.changeStatus === "removed") {
      changedSections.push(cr.section);
      diffs[cr.section] = `[PAGE REMOVED] ${cr.section} is no longer accessible`;
    }
  }

  // 2. Check search results (news/competitive) via local comparison fallback
  if (oldKb) {
    const searchSections: { key: keyof KnowledgeBase; label: string }[] = [
      { key: "newsResults", label: "newsResults" },
      { key: "competitiveIntel", label: "competitiveIntel" },
    ];
    for (const { key, label } of searchSections) {
      const oldVal = (oldKb[key] as string) || "";
      const newVal = (freshResult.knowledge[key] as string) || "";
      if (oldVal && newVal && oldVal !== newVal) {
        changedSections.push(label);
        diffs[label] = computeDiff(oldVal, newVal);
      } else if (!oldVal && newVal) {
        changedSections.push(label);
        diffs[label] = `+ [NEW] ${newVal.slice(0, 500)}`;
      }
    }
  }

  const combinedDiff = Object.entries(diffs).map(([s, d]) => `=== ${s} ===\n${d}`).join("\n\n").slice(0, 3000);
  return { changedSections, combinedDiff };
}

// ── Build combined knowledge string for LLM context ──
function buildKnowledgeContext(kb: KnowledgeBase): string {
  const parts: string[] = [];
  if (kb.homepage) parts.push(`HOMEPAGE:\n${kb.homepage.slice(0, 1500)}`);
  if (kb.aboutPage) parts.push(`ABOUT:\n${kb.aboutPage.slice(0, 1000)}`);
  if (kb.pricingPage) parts.push(`PRICING:\n${kb.pricingPage.slice(0, 1000)}`);
  if (kb.productsPage) parts.push(`PRODUCTS:\n${kb.productsPage.slice(0, 1000)}`);
  if (kb.newsResults) parts.push(`NEWS:\n${kb.newsResults.slice(0, 1000)}`);
  if (kb.competitiveIntel) parts.push(`COMPETITIVE:\n${kb.competitiveIntel.slice(0, 1000)}`);
  return parts.join("\n\n");
}

async function handleChange(slug: string, entry: WatchEntry, diff: string, currentContent: string, changedSections?: string[]) {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const sectionLabel = changedSections?.length ? changedSections.join(", ") : "content";
  let summary = `Changes detected on ${entry.domain} (${sectionLabel})`;

  // Build full knowledge context for richer summarization
  const knowledgeContext = entry.knowledge ? buildKnowledgeContext(entry.knowledge) : "";

  // Summarize with LLM using full context
  if (openrouterKey && diff) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openrouterKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [{ role: "user", content: `You are monitoring ${entry.companyName} (${entry.domain}) for competitive intelligence.\n\nChanged sections: ${sectionLabel}\n\nDiff of changes:\n${diff.slice(0, 2000)}\n\n${knowledgeContext ? `Full knowledge base about this company:\n${knowledgeContext.slice(0, 3000)}\n\n` : ""}Provide a 3-sentence intelligence briefing: (1) What specifically changed, (2) Why it matters strategically, (3) Recommended action. Be specific, quote numbers if present. Return ONLY the 3-sentence briefing.` }],
          max_tokens: 250,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        summary = data.choices?.[0]?.message?.content?.trim() || summary;
      }
    } catch (e) { console.warn("[Watch] Summary error:", e); }
  }

  // Update entry
  entry.lastChange = { timestamp: Date.now(), summary, url: `https://${entry.domain}`, diff };
  entry.lastContent = currentContent;
  entry.lastChecked = Date.now();
  entry.notifyCount++;

  // Store in history
  const alert: AlertHistoryEntry = {
    slug, company: entry.companyName, timestamp: Date.now(),
    summary, changedUrl: `https://${entry.domain}`, acknowledged: false,
  };
  alertHistory.unshift(alert);
  if (alertHistory.length > 50) alertHistory.pop();

  console.log(`[Watch] Change detected on ${entry.domain}: ${summary}`);

  // Create ElevenLabs agent for the briefing call
  let agentId: string | undefined;
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
  if (elevenLabsKey) {
    try {
      const persona = `You are Orbit, an AI startup intelligence assistant. You are calling the user to brief them on a competitor change you detected.\n\nThe change: ${summary}\nChanged URL: https://${entry.domain}\nCompany: ${entry.companyName}\n\nOpen with: "Hi, this is Orbit. I detected a change on ${entry.domain} that you should know about."\nBrief them on exactly what changed. Answer follow-up questions concisely. End when they say "thanks" or "goodbye".`;

      const agentRes = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
        method: "POST",
        headers: { "xi-api-key": elevenLabsKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Orbit Alert: ${entry.companyName}`,
          conversation_config: {
            agent: { prompt: { prompt: persona }, first_message: `Hi, this is Orbit. I detected a change on ${entry.domain}. ${summary} Do you want the full details?`, language: "en" },
            tts: { voice_id: "nPczCjzI2devNBz1zQrb", model_id: "eleven_flash_v2_5" },
          },
        }),
      });
      if (agentRes.ok) {
        const agentData = await agentRes.json();
        agentId = agentData.agent_id;
      }
    } catch (e) { console.warn("[Watch] Agent creation error:", e); }
  }

  // Place real outbound phone call via Twilio
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
  const userPhone = process.env.USER_PHONE_NUMBER;
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  const callKey = `watch-${slug}-${userPhone}`;
  if (twilioSid && twilioToken && twilioPhone && userPhone && !appUrl.includes("localhost") && canPlaceCall(callKey)) {
    try {
      const client = twilio(twilioSid, twilioToken);
      // Store the voice message for TwiML endpoint
      pendingVoiceMessages.set(slug, {
        company: entry.companyName,
        domain: entry.domain,
        summary,
        agentId,
      });

      const call = await client.calls.create({
        to: userPhone,
        from: twilioPhone,
        url: `${appUrl}/api/watch/voice/${slug}`,
        method: "GET",
        statusCallback: `${appUrl}/api/watch/call-status/${slug}`,
        statusCallbackEvent: ["completed", "failed"],
      });
      recordCallPlaced(callKey);
      console.log(`[Watch] Outbound call placed to ${userPhone}: SID ${call.sid}`);
    } catch (e) {
      console.warn("[Watch] Twilio call failed:", e);
    }
  } else if (twilioSid && twilioToken && twilioPhone && userPhone && !canPlaceCall(callKey)) {
    console.log(`[Watch] Skipping call for ${slug} — cooldown active (last call within 10 min)`);
  } else if (twilioSid && twilioToken && twilioPhone && userPhone) {
    console.log(`[Watch] Would call ${userPhone} about change on ${entry.domain} (skipped: localhost)`);
  }

  // Broadcast to SSE clients (in-app alert works regardless of Twilio)
  broadcastSSE({
    type: "competitor_alert",
    slug, company: entry.companyName, domain: entry.domain,
    summary, agentId, timestamp: Date.now(),
  });
}

// Store pending voice messages for TwiML
const pendingVoiceMessages = new Map<string, { company: string; domain: string; summary: string; agentId?: string }>();

// Call cooldown: prevent repeated calls to the same number within 10 minutes
const callCooldowns = new Map<string, number>();
const CALL_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

function canPlaceCall(key: string): boolean {
  const lastCall = callCooldowns.get(key);
  if (!lastCall) return true;
  return Date.now() - lastCall > CALL_COOLDOWN_MS;
}

function recordCallPlaced(key: string) {
  callCooldowns.set(key, Date.now());
}

// Singleton MCP client for Firecrawl
let mcpClient: Client | null = null;
let mcpConnecting = false;

async function getFirecrawlMcpClient(): Promise<Client | null> {
  if (mcpClient) return mcpClient;
  if (mcpConnecting) return null; // avoid parallel init attempts

  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlKey) {
    console.warn("[MCP] FIRECRAWL_API_KEY not set, skipping Firecrawl MCP init");
    return null;
  }

  mcpConnecting = true;
  try {
    console.log("[MCP] Initializing Firecrawl MCP server...");
    const client = new Client({ name: "orbit-server", version: "1.0.0" });
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "firecrawl-mcp"],
      env: {
        ...process.env as Record<string, string>,
        FIRECRAWL_API_KEY: firecrawlKey,
      },
    });
    await client.connect(transport);
    mcpClient = client;
    console.log("[MCP] Firecrawl MCP server connected successfully");
    return mcpClient;
  } catch (err) {
    console.error("[MCP] Failed to initialize Firecrawl MCP:", err);
    mcpConnecting = false;
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Request Logging
  app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ── Server-side TTS proxy (BUG 1 fix: no API keys sent to client) ──
  app.post("/api/tts", async (req, res) => {
    const { text, voiceId } = req.body;
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "ElevenLabs API key not configured" });
    if (!text) return res.status(400).json({ error: "text is required" });

    const voice = voiceId || "nPczCjzI2devNBz1zQrb";
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: stripEmotionTags(text),
            model_id: TTS_MODEL,
            voice_settings: TTS_SETTINGS,
          }),
        }
      );
      if (!response.ok) {
        const errText = await response.text();
        console.error(`ElevenLabs TTS error (${response.status}):`, errText);
        return res.status(response.status).json({ error: "TTS generation failed" });
      }
      res.set("Content-Type", "audio/mpeg");
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error("TTS proxy error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Server-side STT proxy ──
  app.post("/api/stt", async (req, res) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "ElevenLabs API key not configured" });

    // Collect raw body as buffer
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", async () => {
      try {
        const audioBuffer = Buffer.concat(chunks);
        const boundary = "----ElevenLabsBoundary" + Date.now();
        const fileField = "file";
        const fileName = "recording.webm";
        const mimeType = "audio/webm";

        // Build multipart form data manually
        const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
        const modelField = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\nscribe_v1`;
        const langField = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="language_code"\r\n\r\neng`;
        const footer = `\r\n--${boundary}--\r\n`;

        const body = Buffer.concat([
          Buffer.from(header),
          audioBuffer,
          Buffer.from(modelField),
          Buffer.from(langField),
          Buffer.from(footer),
        ]);

        const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
          },
          body,
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`ElevenLabs STT error (${response.status}):`, errText);
          return res.status(response.status).json({ error: "STT transcription failed" });
        }

        const result = await response.json();
        res.json({ transcript: (result.text || "").trim() });
      } catch (err: any) {
        console.error("STT proxy error:", err);
        res.status(500).json({ error: err.message });
      }
    });
  });

  // AI-powered Q&A about startups using OpenRouter + Firecrawl for live data
  app.post("/api/ask", async (req, res) => {
    const { question, startup } = req.body;
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;

    if (!openrouterKey) {
      return res.json({ answer: "I'm sorry, the AI service is not configured right now." });
    }

    if (!question || !startup) {
      return res.json({ answer: "Please ask a question about a specific startup." });
    }

    try {
      console.log(`[AI Q&A] Question about ${startup.name}: "${question}"`);

      // Step 1: Search the web with Firecrawl MCP for real-time data about the question
      let scrapedContext = "";
      if (firecrawlKey) {
        const searchQuery = `${startup.name} ${question}`;
        console.log(`[AI Q&A] Firecrawl MCP searching: "${searchQuery}"`);

        try {
          const client = await getFirecrawlMcpClient();
          if (client) {
            const toolResult = await client.callTool({
              name: "firecrawl_search",
              arguments: {
                query: searchQuery,
                limit: 3,
                scrapeOptions: {
                  formats: ["markdown"],
                  onlyMainContent: true,
                },
              },
            });

            // Extract text content from MCP tool result
            const contentParts = (toolResult.content as Array<{ type: string; text?: string }>) || [];
            const textParts = contentParts
              .filter((part) => part.type === "text" && part.text)
              .map((part) => part.text!);
            scrapedContext = textParts.join("\n\n---\n\n").substring(0, 4000);
            console.log(`[AI Q&A] Got MCP search results, ${scrapedContext.length} chars`);
          } else {
            console.warn("[AI Q&A] Firecrawl MCP client not available");
          }
        } catch (searchErr) {
          console.warn("[AI Q&A] Firecrawl MCP search error:", searchErr);
        }
      }

      // Step 2: Build prompt with scraped web context
      const systemPrompt = `You are the founder of ${startup.name}. You are on a live voice call with someone interested in your company. Speak naturally in first person as the founder. Keep answers concise (2-4 sentences max) and conversational.

About your company:
- Name: ${startup.name}
- Tagline: ${startup.tagline}
- City: ${startup.city}, Country: ${startup.country}
- Industry: ${startup.industry}
- Founded: ${startup.founding_year || "Unknown"}
- Your quote: "${startup.founder_quote || "N/A"}"
${scrapedContext ? `
Here is real, up-to-date information from the web about your company, relevant to the caller's question. Use this data to give accurate, specific answers:

${scrapedContext}
` : ""}
Answer the caller's question using the web data above when available, and your general knowledge otherwise. If you have specific numbers (revenue, valuation, stock price, funding), cite them. Be factual but warm and conversational — you're the founder speaking to a potential investor or fan. Do not use markdown, bullet points, or special characters. Speak naturally.`;

      // Step 3: Call OpenRouter LLM
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
          "X-Title": "Orbit - Startup Radio Globe",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question },
          ],
          max_tokens: 400,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("OpenRouter API Error:", errText);
        return res.json({ answer: `${startup.name} is a ${startup.industry} company based in ${startup.city}. ${startup.tagline}. Unfortunately I couldn't get more details right now.` });
      }

      const result = await response.json();
      const answer = result.choices?.[0]?.message?.content ||
        `${startup.name} is based in ${startup.city}, ${startup.country}. ${startup.tagline}`;

      console.log(`[AI Q&A] Answer: ${answer.substring(0, 100)}...`);
      res.json({ answer });
    } catch (error: any) {
      console.error("AI Q&A Error:", error);
      res.json({ answer: `${startup.name} is a ${startup.industry} company founded in ${startup.founding_year || "recent years"}. ${startup.tagline}` });
    }
  });
  app.get("/api/scrape", async (req, res) => {
    console.log("GET /api/scrape - Request received");
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      console.warn("FIRECRAWL_API_KEY is missing");
      return res.json({ startups: [] });
    }

    try {
      console.log("Fetching from Firecrawl...");
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          // Use a lighter batch-specific page for better reliability as suggested in Fix 2
          url: "https://www.ycombinator.com/companies?batch=W24",
          formats: ["json"],
          timeout: 60000, // Fix 1: Set timeout to 60 seconds
          waitFor: 5000, // Reduced wait time for lighter page
          onlyMainContent: true,
          removeBase64Images: true,
          jsonOptions: {
            prompt: "Extract at least 25 companies. For each company extract: name, one-line tagline/description, city, country, industry category, the company website URL (e.g. https://example.com), any logo image URL you can find, a short founder quote or mission statement, and the founding year. Return as a JSON array named 'startups'.",
            schema: {
              type: "object",
              properties: {
                startups: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      tagline: { type: "string" },
                      city: { type: "string" },
                      country: { type: "string" },
                      industry: { type: "string" },
                      website: { type: "string" },
                      logo: { type: "string" },
                      founder_quote: { type: "string" },
                      founding_year: { type: "number" }
                    },
                    required: ["name", "city", "country"]
                  }
                }
              }
            }
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Firecrawl API error (${response.status}):`, errorText);
        // Return empty list on error so frontend can use fallback
        return res.json({ startups: [] });
      }

      const result = await response.json();
      console.log("Firecrawl response received successfully");
      
      if (!result.success || !result.data?.json?.startups) {
        console.warn("Firecrawl returned no startups or success=false");
        return res.json({ startups: [] });
      }

      let startups = result.data.json.startups;

      // Helper: extract domain from a URL
      const getDomain = (url: string): string | null => {
        try {
          return new URL(url).hostname;
        } catch {
          return null;
        }
      };

      // Add coordinates (Simple geocoding lookup for demo)
      const cityCoords: Record<string, { lat: number, lng: number }> = {
        "San Francisco": { lat: 37.7749, lng: -122.4194 },
        "New York": { lat: 40.7128, lng: -74.0060 },
        "London": { lat: 51.5074, lng: -0.1278 },
        "Paris": { lat: 48.8566, lng: 2.3522 },
        "Bangalore": { lat: 12.9716, lng: 77.5946 },
        "Bengaluru": { lat: 12.9716, lng: 77.5946 },
        "Sydney": { lat: -33.8688, lng: 151.2093 },
        "Sao Paulo": { lat: -23.5505, lng: -46.6333 },
        "Berlin": { lat: 52.5200, lng: 13.4050 },
        "Tokyo": { lat: 35.6762, lng: 139.6503 },
        "Singapore": { lat: 1.3521, lng: 103.8198 },
        "Toronto": { lat: 43.6532, lng: -79.3832 },
        "Austin": { lat: 30.2672, lng: -97.7431 },
        "Seattle": { lat: 47.6062, lng: -122.3321 },
        "Los Angeles": { lat: 34.0522, lng: -118.2437 },
        "Chicago": { lat: 41.8781, lng: -87.6298 },
        "Boston": { lat: 42.3601, lng: -71.0589 },
        "Tel Aviv": { lat: 32.0853, lng: 34.7818 },
        "Seoul": { lat: 37.5665, lng: 126.9780 },
        "Mumbai": { lat: 19.0760, lng: 72.8777 },
        "Delhi": { lat: 28.6139, lng: 77.2090 },
        "Stockholm": { lat: 59.3293, lng: 18.0686 },
        "Amsterdam": { lat: 52.3676, lng: 4.9041 },
        "Madrid": { lat: 40.4168, lng: -3.7038 },
        "Mexico City": { lat: 19.4326, lng: -99.1332 },
        "Vancouver": { lat: 49.2827, lng: -123.1207 },
        "Tallinn": { lat: 59.4370, lng: 24.7536 },
        "Jakarta": { lat: -6.2088, lng: 106.8456 },
        "Buenos Aires": { lat: -34.6037, lng: -58.3816 },
        "Bogota": { lat: 4.7110, lng: -74.0721 },
        "Noida": { lat: 28.5355, lng: 77.3910 },
        "Munich": { lat: 48.1351, lng: 11.5820 },
        "Gurgaon": { lat: 28.4595, lng: 77.0266 },
        "Cologne": { lat: 50.9375, lng: 6.9603 },
        "Zurich": { lat: 47.3769, lng: 8.5417 },
        "Lagos": { lat: 6.5244, lng: 3.3792 },
        "Nairobi": { lat: -1.2921, lng: 36.8219 },
        "Dubai": { lat: 25.2048, lng: 55.2708 },
        "Cape Town": { lat: -33.9249, lng: 18.4241 },
      };

      startups = startups.map((s: any) => {
        // Build a reliable logo URL from the website domain
        const domain = s.website ? getDomain(s.website) : null;
        const nameDomain = s.name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
        const logoDomain = domain || nameDomain;
        
        // Use Google Favicon as primary, keep original logo as secondary
        const logo = s.logo || `https://www.google.com/s2/favicons?sz=64&domain=${logoDomain}`;

        return {
          ...s,
          logo,
          lat: cityCoords[s.city] ? cityCoords[s.city].lat : (Math.random() * 120 - 60),
          lng: cityCoords[s.city] ? cityCoords[s.city].lng : (Math.random() * 240 - 120),
          industry: s.industry || "Other"
        };
      });

      console.log(`Returning ${startups.length} startups`);
      res.json({ startups });
    } catch (error: any) {
      console.error("Scrape Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ══════════════ MODE ENDPOINTS ══════════════

  // ── Story Mode: 2-host debate ──
  app.post("/api/story", async (req, res) => {
    const { slug, name, domain } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const cacheKey = `story:${name}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return res.json(cached);

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

    if (!openrouterKey) return res.json({ error: "OpenRouter not configured", fallback: true });

    try {
      let combinedContent = "";

      // 1. Firecrawl /crawl on domain
      if (firecrawlKey && domain) {
        try {
          const crawlRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${firecrawlKey}` },
            body: JSON.stringify({
              url: `https://${domain}`,
              formats: ["markdown"],
              onlyMainContent: true,
              timeout: 15000,
            }),
          });
          if (crawlRes.ok) {
            const crawlData = await crawlRes.json();
            combinedContent += (crawlData.data?.markdown || "").substring(0, 2000) + "\n\n";
          }
        } catch (e) { console.warn("[Story] Crawl error:", e); }
      }

      // 2. Firecrawl /search for news
      if (firecrawlKey) {
        try {
          const client = await getFirecrawlMcpClient();
          if (client) {
            const searchResult = await client.callTool({
              name: "firecrawl_search",
              arguments: { query: `${name} startup funding news 2025`, limit: 2 },
            });
            const textParts = ((searchResult.content as any[]) || [])
              .filter((p: any) => p.type === "text" && p.text)
              .map((p: any) => p.text!);
            combinedContent += textParts.join("\n").substring(0, 1500);
          }
        } catch (e) { console.warn("[Story] Search error:", e); }
      }

      // 3. OpenRouter generates dialogue script
      const scriptRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
          "X-Title": "Orbit - Startup Radio Globe",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [{
            role: "user",
            content: `Write a short 2-host podcast debate about ${name}.\n\nHOST ALEX: Skeptical, asks hard questions.\nHOST SAM: Optimistic, finds the opportunity.\n\nContent: ${combinedContent.slice(0, 2000)}\n\nRules:\n- 4 exchanges total (keep it tight)\n- Reference facts from content\n- Each line max 2 sentences, natural spoken style\n- Do NOT include any bracketed tags like [laughs] or [sighs] — just write natural speech\n\nReturn ONLY valid JSON:\n{"tension": "one sentence core debate", "exchanges": [{"host": "Alex", "text": "..."}, {"host": "Sam", "text": "..."}]}`
          }],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!scriptRes.ok) return res.json({ error: "Script generation failed", fallback: true });

      const scriptData = await scriptRes.json();
      let rawContent = scriptData.choices?.[0]?.message?.content || "";

      // Try to parse JSON from response
      let script: { tension: string; exchanges: { host: string; text: string }[] };
      try {
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        script = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
      } catch {
        script = {
          tension: `What's really going on at ${name}?`,
          exchanges: [
            { host: "Alex", text: `So ${name}... another startup making big promises.` },
            { host: "Sam", text: `Actually, they have real traction. Let me tell you why.` },
            { host: "Alex", text: `I'll believe it when I see the numbers. [sighs]` },
            { host: "Sam", text: `[laughs] The numbers are exactly what's impressive.` },
            { host: "Alex", text: `Fair enough. But what about the competition?` },
            { host: "Sam", text: `That's where it gets interesting. They're category-defining.` },
          ],
        };
      }

      // 4. Generate audio via ElevenLabs TTS (PARALLEL for speed)
      let audioBuffer: Buffer | null = null;
      if (elevenLabsKey && script.exchanges?.length) {
        try {
          const alexVoice = "nPczCjzI2devNBz1zQrb";
          const samVoice = "EXAVITQu4vr4xnSDxMaL";

          // Generate all TTS calls in parallel
          const ttsPromises = script.exchanges.map((exchange) => {
            const voiceId = exchange.host === "Alex" ? alexVoice : samVoice;
            const cleanText = stripEmotionTags(exchange.text);
            return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
              method: "POST",
              headers: { "xi-api-key": elevenLabsKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                text: cleanText,
                model_id: TTS_MODEL,
                voice_settings: TTS_SETTINGS,
              }),
            }).then(r => r.ok ? r.arrayBuffer().then(ab => Buffer.from(ab)) : null).catch(() => null);
          });

          const results = await Promise.all(ttsPromises);
          const audioChunks = results.filter((r): r is Buffer => r !== null);
          if (audioChunks.length > 0) audioBuffer = Buffer.concat(audioChunks);
        } catch (e) { console.warn("[Story] TTS error:", e); }
      }

      const result = {
        tension: script.tension,
        exchanges: script.exchanges,
        hasAudio: !!audioBuffer,
        firecrawlInfo: { endpoint: "/crawl + /search", wordCount: combinedContent.length },
        elevenlabsInfo: { feature: "Text to Speech (2 voices)", calls: script.exchanges?.length || 0 },
      };

      setCached(cacheKey, result, CACHE_TTL.story);

      if (audioBuffer) {
        // Return audio + metadata as multipart or just audio
        res.set("Content-Type", "audio/mpeg");
        res.set("X-Story-Meta", Buffer.from(JSON.stringify(result)).toString("base64"));
        res.send(audioBuffer);
      } else {
        res.json(result);
      }
    } catch (error: any) {
      console.error("Story Error:", error);
      res.json({ error: error.message, fallback: true });
    }
  });

  // ── Sentiment Mode ──
  app.post("/api/sentiment", async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const cacheKey = `sentiment:${name}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return res.json(cached);

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    try {
      let headlines = "";
      if (firecrawlKey) {
        const client = await getFirecrawlMcpClient();
        if (client) {
          const searchResult = await client.callTool({
            name: "firecrawl_search",
            arguments: { query: `${name} startup news 2025`, limit: 5 },
          });
          const textParts = ((searchResult.content as any[]) || [])
            .filter((p: any) => p.type === "text" && p.text)
            .map((p: any) => p.text!);
          headlines = textParts.join("\n").substring(0, 2000);
        }
      }

      if (!openrouterKey || !headlines) {
        const result = { sentiment: "neutral" as const, score: 0, sources: 0, topHeadline: "No news data available" };
        return res.json(result);
      }

      const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [{
            role: "user",
            content: `Analyze sentiment of these news headlines about ${name}. Return ONLY valid JSON:\n{"sentiment": "positive"|"negative"|"neutral", "score": -100 to +100, "sources": number of headlines analyzed, "topHeadline": "most impactful headline"}\n\n${headlines}`,
          }],
          max_tokens: 200,
        }),
      });

      if (!aiRes.ok) return res.json({ sentiment: "neutral", score: 0, sources: 0, topHeadline: "Analysis failed" });

      const aiData = await aiRes.json();
      const rawContent = aiData.choices?.[0]?.message?.content || "";
      let result;
      try {
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        result = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
      } catch {
        result = { sentiment: "neutral", score: 0, sources: 0, topHeadline: "Could not parse sentiment" };
      }

      setCached(cacheKey, result, CACHE_TTL.sentiment);
      res.json(result);
    } catch (error: any) {
      console.error("Sentiment Error:", error);
      res.json({ sentiment: "neutral", score: 0, sources: 0, topHeadline: error.message });
    }
  });

  // ── Pricing Mode ──
  app.post("/api/pricing", async (req, res) => {
    const { domain, name } = req.body;
    if (!domain || !name) return res.status(400).json({ error: "domain and name are required" });

    const cacheKey = `pricing:${domain}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return res.json(cached);

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    try {
      let pricingContent = "";
      if (firecrawlKey) {
        try {
          const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${firecrawlKey}` },
            body: JSON.stringify({
              url: `https://${domain}/pricing`,
              formats: ["markdown", {
                type: "json",
                prompt: "Extract all pricing tiers with plan name, price, billing period, and features",
                schema: {
                  type: "object",
                  properties: {
                    tiers: { type: "array", items: { type: "object", properties: {
                      name: { type: "string" }, price: { type: "string" },
                      period: { type: "string" }, features: { type: "array", items: { type: "string" } },
                    }}},
                    freeTrialAvailable: { type: "boolean" },
                  },
                },
              }],
              waitFor: 3000,
              timeout: 20000,
              actions: [
                { type: "scroll", direction: "down" },
                { type: "wait", milliseconds: 1000 },
              ],
            }),
          });
          if (scrapeRes.ok) {
            const d = await scrapeRes.json();
            pricingContent = (d.data?.markdown || "").substring(0, 3000);
            if (d.data?.json?.tiers?.length) {
              pricingContent += `\n\nEXTRACTED: ${JSON.stringify(d.data.json)}`;
            }
          }
        } catch (e) { console.warn("[Pricing] Scrape error:", e); }
      }

      if (!openrouterKey) return res.json({ hasPricing: false, tiers: [], summary: "AI not configured" });

      const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openrouterKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [{
            role: "user",
            content: `Extract pricing info from this page for ${name}. Return ONLY valid JSON:\n{"hasPricing": boolean, "tiers": [{"name": string, "price": string, "period": string, "features": [string]}], "freeTrialAvailable": boolean, "summary": "one line summary"}\n\n${pricingContent || "No pricing page content found."}`,
          }],
          max_tokens: 500,
        }),
      });

      let result = { hasPricing: false, tiers: [] as any[], freeTrialAvailable: false, summary: "No pricing info found" };
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const raw = aiData.choices?.[0]?.message?.content || "";
        try {
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          result = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
        } catch {}
      }

      setCached(cacheKey, result, CACHE_TTL.pricing);
      res.json(result);
    } catch (error: any) {
      console.error("Pricing Error:", error);
      res.json({ hasPricing: false, tiers: [], summary: error.message });
    }
  });

  // ── Research Mode ──
  app.post("/api/research", async (req, res) => {
    const { name, domain } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const cacheKey = `research:${name}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return res.json(cached);

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

    try {
      let combinedContent = "";

      if (firecrawlKey) {
        console.log(`[Research] Starting deep research for "${name}"...`);

        // ── Iteration 1: Initial broad search + site scrape (in parallel) ──
        const client = await getFirecrawlMcpClient();
        const iter1Tasks: Promise<any>[] = [];

        // Scrape homepage with waitFor + links + branding
        if (domain) {
          iter1Tasks.push(
            fetch("https://api.firecrawl.dev/v1/scrape", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${firecrawlKey}` },
              body: JSON.stringify({
                url: `https://${domain}`,
                formats: ["markdown", "links", "branding"],
                onlyMainContent: true,
                waitFor: 3000,
                timeout: 20000,
                actions: [
                  { type: "scroll", direction: "down" },
                  { type: "wait", milliseconds: 1000 },
                ],
              }),
            }).then(r => r.ok ? r.json() : null).catch(() => null)
          );
        }

        // Search: funding, competitors, news (3 parallel searches)
        if (client) {
          iter1Tasks.push(
            client.callTool({ name: "firecrawl_search", arguments: { query: `${name} funding investors valuation 2025`, limit: 3 } }).catch(() => null),
            client.callTool({ name: "firecrawl_search", arguments: { query: `${name} competitors analysis market`, limit: 3 } }).catch(() => null),
            client.callTool({ name: "firecrawl_search", arguments: { query: `${name} latest news product launch updates`, limit: 3 } }).catch(() => null),
          );
        }

        const iter1Results = await Promise.all(iter1Tasks);
        const discoveredLinks: string[] = [];

        for (const r of iter1Results) {
          if (!r) continue;
          if (r.data?.markdown) {
            combinedContent += `HOMEPAGE:\n${r.data.markdown.substring(0, 2000)}\n\n`;
            // Collect links for follow-up in iteration 2
            if (r.data?.links) {
              discoveredLinks.push(...(r.data.links as string[]).slice(0, 10));
            }
            // Add branding info
            if (r.data?.branding) {
              combinedContent += `BRANDING: ${JSON.stringify(r.data.branding)}\n\n`;
            }
          }
          if (r.content) {
            const texts = (r.content as any[]).filter((p: any) => p.type === "text" && p.text).map((p: any) => p.text!);
            combinedContent += texts.join("\n").substring(0, 1500) + "\n\n";
          }
        }

        // ── Iteration 2: Follow promising links from homepage ──
        if (discoveredLinks.length > 0 && client) {
          // Filter for relevant links (blog, about, team pages)
          const relevantLinks = discoveredLinks.filter(l =>
            /\/(about|team|blog|news|press|careers|product|features)/i.test(l)
          ).slice(0, 3);

          if (relevantLinks.length > 0) {
            console.log(`[Research] Iteration 2: following ${relevantLinks.length} discovered links`);
            const iter2Results = await Promise.allSettled(
              relevantLinks.map(url =>
                fetch("https://api.firecrawl.dev/v1/scrape", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${firecrawlKey}` },
                  body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, waitFor: 2000, timeout: 15000 }),
                }).then(r => r.ok ? r.json() : null).catch(() => null)
              )
            );
            for (const r of iter2Results) {
              if (r.status === "fulfilled" && r.value?.data?.markdown) {
                combinedContent += `FOLLOW-UP PAGE:\n${r.value.data.markdown.substring(0, 1500)}\n\n`;
              }
            }
          }
        }

        // ── Iteration 3: Gap-filling search ──
        if (client) {
          console.log(`[Research] Iteration 3: gap-filling search`);
          const gapResult = await client.callTool({
            name: "firecrawl_search",
            arguments: { query: `${name} business model revenue strategy target market`, limit: 2 }
          }).catch(() => null);
          if (gapResult?.content) {
            const texts = ((gapResult.content as any[]) || []).filter((p: any) => p.type === "text" && p.text).map((p: any) => p.text!);
            combinedContent += `BUSINESS INTEL:\n${texts.join("\n").substring(0, 1000)}\n\n`;
          }
        }

        console.log(`[Research] Deep research complete: ${combinedContent.length} chars of content from 3 iterations`);
      }

      if (!openrouterKey) return res.json({ keyFacts: [], fundingStage: "Unknown", competitors: [], verdict: "watch", fallback: true });

      // Generate research briefing script
      const scriptRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [{
            role: "user",
            content: `Write a 60-second 2-host research briefing about ${name}.\n\nTwo hosts, 8 exchanges, covering: what they do, business model, funding/investors, key competitors, recent news, investment thesis.\n\nContent: ${combinedContent.slice(0, 5000)}\n\nReturn ONLY valid JSON:\n{"tension": "topic", "exchanges": [{"host": "Alex", "text": "..."}], "keyFacts": ["5 bullet points"], "fundingStage": "stage", "competitors": ["comp1", "comp2"], "verdict": "invest"|"watch"|"pass"}`,
          }],
          max_tokens: 1200,
          temperature: 0.7,
        }),
      });

      let result: any = { keyFacts: [], fundingStage: "Unknown", competitors: [], verdict: "watch", exchanges: [] };
      if (scriptRes.ok) {
        const data = await scriptRes.json();
        const raw = data.choices?.[0]?.message?.content || "";
        try {
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          result = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
        } catch {}
      }

      // Generate audio (parallel)
      if (elevenLabsKey && result.exchanges?.length) {
        try {
          const ttsPromises = result.exchanges.map((ex: any) => {
            const voiceId = ex.host === "Alex" ? "nPczCjzI2devNBz1zQrb" : "EXAVITQu4vr4xnSDxMaL";
            return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
              method: "POST",
              headers: { "xi-api-key": elevenLabsKey, "Content-Type": "application/json" },
              body: JSON.stringify({ text: stripEmotionTags(ex.text), model_id: TTS_MODEL, voice_settings: TTS_SETTINGS }),
            }).then(r => r.ok ? r.arrayBuffer().then(ab => Buffer.from(ab)) : null).catch(() => null);
          });
          const chunks = (await Promise.all(ttsPromises)).filter((r): r is Buffer => r !== null);
          if (chunks.length > 0) { result.hasAudio = true; result._audioBuffer = Buffer.concat(chunks); }
        } catch (e) { console.warn("[Research] TTS error:", e); }
      }

      const { _audioBuffer, ...resultWithout } = result;
      setCached(cacheKey, resultWithout, CACHE_TTL.research);

      if (_audioBuffer) {
        res.set("Content-Type", "audio/mpeg");
        res.set("X-Research-Meta", Buffer.from(JSON.stringify(resultWithout)).toString("base64"));
        res.send(_audioBuffer);
      } else {
        res.json(resultWithout);
      }
    } catch (error: any) {
      console.error("Research Error:", error);
      res.json({ keyFacts: [], fundingStage: "Unknown", competitors: [], verdict: "watch", error: error.message });
    }
  });

  // ── Investor Brief Mode ──
  app.post("/api/investor-brief", async (req, res) => {
    const { domain, name } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const cacheKey = `investor:${name}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return res.json(cached);

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    try {
      let researchContent = "";

      if (firecrawlKey) {
        const client = await getFirecrawlMcpClient();
        const tasks: Promise<any>[] = [];

        // Parallel signal searches
        if (client) {
          tasks.push(
            client.callTool({ name: "firecrawl_search", arguments: { query: `${name} funding round valuation investors series`, limit: 3 } }).catch(() => null),
            client.callTool({ name: "firecrawl_search", arguments: { query: `${name} revenue growth metrics users ARR`, limit: 3 } }).catch(() => null),
            client.callTool({ name: "firecrawl_search", arguments: { query: `${name} risks layoffs legal regulatory concerns`, limit: 2 } }).catch(() => null),
            client.callTool({ name: "firecrawl_search", arguments: { query: `${name} hiring jobs team growth LinkedIn`, limit: 2 } }).catch(() => null),
          );
        }

        // Site scrape with JSON extraction for company metrics
        if (domain) {
          tasks.push(
            fetch("https://api.firecrawl.dev/v1/scrape", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${firecrawlKey}` },
              body: JSON.stringify({
                url: `https://${domain}`,
                formats: ["markdown", {
                  type: "json",
                  prompt: "Extract company metrics: team size, funding, investors, product offerings, partnerships",
                  schema: {
                    type: "object",
                    properties: {
                      teamSize: { type: "string" },
                      totalFunding: { type: "string" },
                      investors: { type: "array", items: { type: "string" } },
                      products: { type: "array", items: { type: "string" } },
                      partnerships: { type: "array", items: { type: "string" } },
                    },
                  },
                }],
                waitFor: 3000,
                timeout: 20000,
              }),
            }).then(r => r.ok ? r.json() : null).catch(() => null)
          );
        }

        const results = await Promise.all(tasks);
        const sections = ["FUNDING", "METRICS", "RISKS", "HIRING", "SITE_DATA"];
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          if (!r) continue;
          const label = sections[i] || "DATA";
          if (r.data?.markdown) researchContent += `${label}:\n${r.data.markdown.substring(0, 1500)}\n`;
          if (r.data?.json) researchContent += `${label}_JSON: ${JSON.stringify(r.data.json)}\n`;
          if (r.content) {
            const texts = (r.content as any[]).filter((p: any) => p.type === "text" && p.text).map((p: any) => p.text!);
            researchContent += `${label}:\n${texts.join("\n").substring(0, 1000)}\n\n`;
          }
        }
      }

      if (!openrouterKey) return res.json({ investmentThesis: "AI not configured", signals: [], riskLevel: "unknown" });

      const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openrouterKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [{
            role: "user",
            content: `Generate an investor intelligence brief for ${name}. Return ONLY valid JSON:\n{"investmentThesis": "2-3 sentence thesis", "signals": [{"type": "funding"|"growth"|"risk"|"hiring"|"market", "signal": "description", "sentiment": "positive"|"negative"|"neutral"}], "riskLevel": "low"|"medium"|"high", "fundingStage": "stage", "estimatedValuation": "string", "keyMetrics": {"teamSize": "string", "monthlyGrowth": "string"}, "competitivePosition": "leader"|"challenger"|"niche", "recommendation": "strong-buy"|"buy"|"hold"|"sell"}\n\n${researchContent.slice(0, 6000)}`,
          }],
          max_tokens: 800,
        }),
      });

      let result: any = { investmentThesis: "Analysis failed", signals: [], riskLevel: "unknown" };
      if (aiRes.ok) {
        const data = await aiRes.json();
        const raw = data.choices?.[0]?.message?.content || "";
        try {
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          result = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
        } catch {}
      }

      setCached(cacheKey, result, CACHE_TTL.research);
      res.json(result);
    } catch (error: any) {
      console.error("Investor Brief Error:", error);
      res.json({ investmentThesis: error.message, signals: [], riskLevel: "unknown" });
    }
  });

  // ── Ambient Sound ──
  app.post("/api/ambient", async (req, res) => {
    const { industry } = req.body;
    if (!industry) return res.status(400).json({ error: "industry is required" });

    const cacheKey = `ambient:${industry}`;
    const cached = getCached<Buffer>(cacheKey);
    if (cached) {
      res.set("Content-Type", "audio/mpeg");
      return res.send(cached);
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsKey) return res.status(500).json({ error: "ElevenLabs not configured" });

    try {
      const prompt = INDUSTRY_AMBIENT_PROMPTS[industry] || INDUSTRY_AMBIENT_PROMPTS.Other;
      const sfxRes = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
        method: "POST",
        headers: { "xi-api-key": elevenLabsKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text: prompt, duration_seconds: 8, prompt_influence: 0.3 }),
      });

      if (!sfxRes.ok) return res.status(500).json({ error: "Sound generation failed" });

      const audioBuffer = Buffer.from(await sfxRes.arrayBuffer());
      setCached(cacheKey, audioBuffer, CACHE_TTL.ambient);
      res.set("Content-Type", "audio/mpeg");
      res.send(audioBuffer);
    } catch (error: any) {
      console.error("Ambient Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Nearby Startups ──
  app.post("/api/nearby", async (req, res) => {
    const { latitude, longitude, city } = req.body;
    const cacheKey = `nearby:${city || `${latitude},${longitude}`}`;
    const cached = getCached<any>(cacheKey);
    if (cached) return res.json(cached);

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey) return res.json({ startups: [] });

    try {
      const client = await getFirecrawlMcpClient();
      if (!client) return res.json({ startups: [] });

      const searchResult = await client.callTool({
        name: "firecrawl_search",
        arguments: { query: `startups companies ${city || 'near me'} 2025`, limit: 5 },
      });

      const textParts = ((searchResult.content as any[]) || [])
        .filter((p: any) => p.type === "text" && p.text)
        .map((p: any) => p.text!);

      const result = { startups: textParts.slice(0, 5), raw: textParts.join("\n") };
      setCached(cacheKey, result, CACHE_TTL.nearby);
      res.json(result);
    } catch (error: any) {
      console.error("Nearby Error:", error);
      res.json({ startups: [] });
    }
  });

  // ── Dubbing: translate + re-speak ──
  app.post("/api/dub", async (req, res) => {
    const { exchanges, targetLanguage, startupName } = req.body;
    if (!exchanges?.length || !targetLanguage) {
      return res.status(400).json({ error: "exchanges and targetLanguage required" });
    }

    const cacheKey = `dub:${startupName}:${targetLanguage}`;
    const cached = getCached<Buffer>(cacheKey);
    if (cached) {
      res.set("Content-Type", "audio/mpeg");
      return res.send(cached);
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

    if (!openrouterKey || !elevenLabsKey) {
      return res.status(500).json({ error: "APIs not configured" });
    }

    const langNames: Record<string, string> = {
      hi: "Hindi", es: "Spanish", ja: "Japanese", fr: "French",
      de: "German", pt: "Portuguese", ar: "Arabic", ko: "Korean",
      zh: "Chinese (Mandarin)", tr: "Turkish",
    };
    const langName = langNames[targetLanguage] || targetLanguage;

    try {
      // 1. Translate all exchanges
      const textsToTranslate = exchanges.map((e: any) => `${e.host}: ${e.text}`).join("\n");
      const transRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [{
            role: "user",
            content: `Translate each line to ${langName}. Keep the "Alex:" and "Sam:" prefixes in English. Return ONLY the translated lines, one per line, no extra text:\n\n${textsToTranslate}`,
          }],
          max_tokens: 800,
        }),
      });

      if (!transRes.ok) return res.status(500).json({ error: "Translation failed" });

      const transData = await transRes.json();
      const translatedText = transData.choices?.[0]?.message?.content || "";
      const translatedLines = translatedText.split("\n").filter((l: string) => l.trim());

      // 2. Generate TTS for each translated line
      const alexVoice = "nPczCjzI2devNBz1zQrb";
      const samVoice = "EXAVITQu4vr4xnSDxMaL";
      const audioChunks: Buffer[] = [];

      for (let i = 0; i < translatedLines.length; i++) {
        const line = translatedLines[i].replace(/^(Alex|Sam):\s*/i, "");
        const isAlex = translatedLines[i].toLowerCase().startsWith("alex");
        const voiceId = isAlex ? alexVoice : samVoice;

        try {
          const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: "POST",
            headers: { "xi-api-key": elevenLabsKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              text: stripEmotionTags(line),
              model_id: TTS_MODEL,
              voice_settings: TTS_SETTINGS,
            }),
          });
          if (ttsRes.ok) {
            audioChunks.push(Buffer.from(await ttsRes.arrayBuffer()));
          }
        } catch (e) { console.warn("[Dub] TTS line error:", e); }
      }

      if (audioChunks.length === 0) {
        return res.status(500).json({ error: "No audio generated" });
      }

      const fullAudio = Buffer.concat(audioChunks);
      setCached(cacheKey, fullAudio, CACHE_TTL.story);
      res.set("Content-Type", "audio/mpeg");
      res.send(fullAudio);
    } catch (error: any) {
      console.error("Dub Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ══════════════ COMPETITOR WATCH ENDPOINTS ══════════════

  // ── Add to watch list ──
  app.post("/api/watch/add", async (req, res) => {
    const { slug, domain, companyName } = req.body;
    if (!slug || !domain) return res.status(400).json({ error: "slug and domain required" });

    if (watchList.has(slug)) return res.json({ status: "already_watching", slug });

    const entry: WatchEntry = {
      slug, domain, companyName: companyName || slug,
      addedAt: Date.now(), notifyCount: 0, monitoredPages: [],
    };

    // Try to register Firecrawl webhook (requires public URL)
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    const appUrl = process.env.APP_URL || "http://localhost:3000";

    if (firecrawlKey && !appUrl.includes("localhost")) {
      try {
        const crawlRes = await fetch("https://api.firecrawl.dev/v1/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${firecrawlKey}` },
          body: JSON.stringify({
            url: `https://${domain}`,
            limit: 5,
            webhook: {
              url: `${appUrl}/api/watch/webhook`,
              events: ["page.changed", "page.added", "page.removed"],
              metadata: { slug, domain },
            },
            scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
          }),
        });
        if (crawlRes.ok) {
          const crawlData = await crawlRes.json();
          entry.crawlJobId = crawlData.id || crawlData.jobId;
        }
      } catch (e) { console.warn("[Watch] Webhook registration failed:", e); }
    }

    // Build comprehensive knowledge base (homepage + about + pricing + products + news + competitive)
    if (firecrawlKey) {
      try {
        console.log(`[Watch] Building initial knowledge base for ${domain}...`);
        const kb = await buildKnowledgeBase(domain, companyName || slug, firecrawlKey);
        entry.knowledge = kb.knowledge;
        entry.monitoredPages = kb.monitoredPages;
        entry.lastContent = kb.knowledge.homepage;
        entry.lastChecked = Date.now();
        console.log(`[Watch] Knowledge base ready: ${kb.monitoredPages.length} sources monitored`);
      } catch (e) {
        console.warn("[Watch] Knowledge base build failed, falling back to homepage:", e);
        // Fallback: just scrape homepage
        try {
          const hp = await scrapePage(`https://${domain}`, firecrawlKey);
          entry.lastContent = hp.markdown;
          entry.lastChecked = Date.now();
          entry.monitoredPages = hp.markdown ? [`https://${domain}`] : [];
        } catch { /* ignore */ }
      }
    }

    watchList.set(slug, entry);
    console.log(`[Watch] Now watching: ${domain} (${slug}) — ${entry.monitoredPages.length} pages monitored`);
    res.json({ status: "watching", slug, domain, monitoredPages: entry.monitoredPages });
  });

  // ── Remove from watch list ──
  app.post("/api/watch/remove", (req, res) => {
    const { slug } = req.body;
    if (!slug) return res.status(400).json({ error: "slug required" });
    const deleted = watchList.delete(slug);
    res.json({ status: deleted ? "removed" : "not_found", slug });
  });

  // ── List all watched ──
  app.get("/api/watch/list", (req, res) => {
    const entries = Array.from(watchList.values()).map(e => {
      const knowledgeSections: Record<string, boolean> = {};
      if (e.knowledge) {
        knowledgeSections.homepage = !!e.knowledge.homepage;
        knowledgeSections.aboutPage = !!e.knowledge.aboutPage;
        knowledgeSections.pricingPage = !!e.knowledge.pricingPage;
        knowledgeSections.productsPage = !!e.knowledge.productsPage;
        knowledgeSections.newsResults = !!e.knowledge.newsResults;
        knowledgeSections.competitiveIntel = !!e.knowledge.competitiveIntel;
      }
      return {
        slug: e.slug, domain: e.domain, companyName: e.companyName,
        addedAt: e.addedAt, lastChecked: e.lastChecked, notifyCount: e.notifyCount,
        monitoredPages: e.monitoredPages || [],
        knowledgeSections,
        lastChange: e.lastChange ? { timestamp: e.lastChange.timestamp, summary: e.lastChange.summary, url: e.lastChange.url, changedSection: e.lastChange.changedSection } : null,
      };
    });
    res.json({ entries });
  });

  // ── Firecrawl webhook handler ──
  app.post("/api/watch/webhook", async (req, res) => {
    const { event, data, metadata } = req.body;
    console.log(`[Watch] Webhook: ${event} for ${metadata?.domain}`);

    if (!metadata?.slug || !watchList.has(metadata.slug)) {
      return res.status(404).json({ error: "Unknown watch entry" });
    }

    const entry = watchList.get(metadata.slug)!;
    const diff = data?.diff || computeDiff(data?.previousContent || "", data?.currentContent || "");

    await handleChange(metadata.slug, entry, diff, data?.currentContent || "");
    res.json({ status: "processed" });
  });

  // ── Manual check (demo trigger) ── comprehensive multi-page check
  app.get("/api/watch/check/:slug", async (req, res) => {
    const { slug } = req.params;
    const entry = watchList.get(slug);
    if (!entry) return res.status(404).json({ error: "Not watching this startup" });

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey) return res.status(500).json({ error: "Firecrawl not configured" });

    console.log(`[Watch] Manual comprehensive check: ${entry.domain}`);

    try {
      // Build fresh knowledge base
      const fresh = await buildKnowledgeBase(entry.domain, entry.companyName, firecrawlKey);

      if (entry.knowledge) {
        // Detect changes via Firecrawl's native changeTracking + local fallback
        const { changedSections, combinedDiff } = detectChanges(entry.knowledge, fresh);

        if (changedSections.length > 0) {
          // Update knowledge base with new data
          entry.knowledge = fresh.knowledge;
          entry.monitoredPages = fresh.monitoredPages;
          entry.lastContent = fresh.knowledge.homepage;
          entry.lastChecked = Date.now();

          await handleChange(slug, entry, combinedDiff, fresh.knowledge.homepage, changedSections);
          res.json({
            status: "change_detected",
            changedSections,
            summary: entry.lastChange?.summary,
            monitoredPages: entry.monitoredPages,
          });
        } else {
          // No changes but update knowledge base with fresh data
          entry.knowledge = fresh.knowledge;
          entry.monitoredPages = fresh.monitoredPages;
          entry.lastContent = fresh.knowledge.homepage;
          entry.lastChecked = Date.now();
          res.json({
            status: "no_change",
            lastChecked: entry.lastChecked,
            monitoredPages: entry.monitoredPages,
          });
        }
      } else {
        // First time building knowledge — just store it
        entry.knowledge = fresh.knowledge;
        entry.monitoredPages = fresh.monitoredPages;
        entry.lastContent = fresh.knowledge.homepage;
        entry.lastChecked = Date.now();
        res.json({
          status: "knowledge_base_built",
          monitoredPages: entry.monitoredPages,
          lastChecked: entry.lastChecked,
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Alert history ──
  app.get("/api/watch/history", (req, res) => {
    res.json({ alerts: alertHistory.slice(0, 20) });
  });

  // ── TwiML Voice endpoint (Twilio hits this when call connects) ──
  // Uses <Connect><Stream> to route audio to ElevenLabs Conversational AI via WebSocket
  app.get("/api/watch/voice/:slug", async (req, res) => {
    const { slug } = req.params;
    const msg = pendingVoiceMessages.get(slug);
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    // Convert https:// to wss:// for WebSocket URL
    const wsUrl = appUrl.replace("https://", "wss://").replace("http://", "ws://");

    const twiml = new twilio.twiml.VoiceResponse();

    if (msg && msg.agentId) {
      // Route the call to ElevenLabs Conversational AI via WebSocket stream
      const connect = twiml.connect();
      connect.stream({
        url: `${wsUrl}/api/watch/media-stream/${slug}`,
      });
    } else if (msg) {
      // Fallback: use Polly TTS if no agentId
      twiml.say({ voice: "Polly.Matthew-Neural", language: "en-US" },
        `Hi, this is Orbit, your startup intelligence assistant. I detected a change on ${msg.domain} that you should know about. ${msg.summary}.`
      );
      twiml.pause({ length: 1 });
      twiml.say({ voice: "Polly.Matthew-Neural" },
        `You can review this alert in your Orbit dashboard. Thanks for using Orbit. Goodbye.`
      );
      twiml.hangup();
      pendingVoiceMessages.delete(slug);
    } else {
      twiml.say({ voice: "Polly.Matthew-Neural" }, "Hi, this is Orbit. No pending alerts at this time. Goodbye.");
      twiml.hangup();
    }

    res.type("text/xml");
    res.send(twiml.toString());
  });

  // ── Call status callback ──
  app.post("/api/watch/call-status/:slug", (req, res) => {
    const { slug } = req.params;
    const status = req.body?.CallStatus || "unknown";
    console.log(`[Watch] Call status for ${slug}: ${status}`);
    res.sendStatus(200);
  });

  // ── Manually trigger a call (for testing without webhook) ──
  app.post("/api/watch/call", async (req, res) => {
    const { slug, phone } = req.body;
    const entry = watchList.get(slug);
    if (!entry) return res.status(404).json({ error: "Not watching this startup" });

    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
    const targetPhone = phone || process.env.USER_PHONE_NUMBER;
    const appUrlVal = process.env.APP_URL || "http://localhost:3000";
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

    if (!twilioSid || !twilioToken || !twilioPhone || !targetPhone) {
      return res.status(400).json({ error: "Twilio not configured or no phone number" });
    }

    const summary = entry.lastChange?.summary || `Monitoring ${entry.domain} for changes.`;
    const knowledgeContext = entry.knowledge ? buildKnowledgeContext(entry.knowledge) : "";

    // Create ElevenLabs Conversational AI agent for interactive call
    let agentId: string | undefined;
    if (elevenLabsKey) {
      try {
        const persona = `You are Orbit, an AI startup intelligence assistant. You are calling the user to brief them about ${entry.companyName} (${entry.domain}).

Summary: ${summary}

${knowledgeContext ? `Company knowledge base:\n${knowledgeContext.slice(0, 3000)}` : ""}

Instructions:
- Open with: "Hi, this is Orbit, your startup intelligence assistant. I have an update about ${entry.companyName} for you."
- Brief them clearly on what changed or what you know about the company.
- Answer any follow-up questions they ask using the knowledge base above.
- Be conversational, concise, and helpful.
- When they say thanks, goodbye, or indicate they're done, say goodbye professionally.`;

        const agentRes = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
          method: "POST",
          headers: { "xi-api-key": elevenLabsKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Orbit Call: ${entry.companyName}`,
            conversation_config: {
              agent: {
                prompt: { prompt: persona },
                first_message: `Hi, this is Orbit, your startup intelligence assistant. I have an update about ${entry.companyName}. ${summary} Would you like to know more?`,
                language: "en",
              },
              tts: { voice_id: "nPczCjzI2devNBz1zQrb", model_id: "eleven_flash_v2_5" },
            },
          }),
        });
        if (agentRes.ok) {
          const data = await agentRes.json();
          agentId = data.agent_id;
          console.log(`[Watch] Created ElevenLabs agent ${agentId} for manual call to ${entry.companyName}`);
        } else {
          console.warn(`[Watch] Agent creation failed: ${agentRes.status}`);
        }
      } catch (e) { console.warn("[Watch] Agent creation error:", e); }
    }

    pendingVoiceMessages.set(slug, {
      company: entry.companyName,
      domain: entry.domain,
      summary,
      agentId,
    });

    try {
      const client = twilio(twilioSid, twilioToken);
      const call = await client.calls.create({
        to: targetPhone,
        from: twilioPhone,
        url: `${appUrlVal}/api/watch/voice/${slug}`,
        method: "GET",
      });
      console.log(`[Watch] Manual call placed: SID ${call.sid} (agentId: ${agentId || "none, using Polly fallback"})`);
      res.json({ status: "call_placed", sid: call.sid, to: targetPhone, agentId: agentId || null });
    } catch (err: any) {
      console.error("[Watch] Manual call error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Signed URL for ElevenLabs Conversational AI ──
  app.post("/api/watch/signed-url", async (req, res) => {
    const { agentId } = req.body;
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsKey || !agentId) {
      return res.status(400).json({ error: "Missing agentId or ELEVENLABS_API_KEY" });
    }

    try {
      const signedRes = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
        { method: "GET", headers: { "xi-api-key": elevenLabsKey } }
      );
      if (!signedRes.ok) {
        const err = await signedRes.text();
        console.error("[Watch] Signed URL error:", err);
        return res.status(signedRes.status).json({ error: "Failed to get signed URL" });
      }
      const data = await signedRes.json();
      res.json({ signedUrl: data.signed_url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── SSE stream for real-time alerts ──
  app.get("/api/watch/alerts/stream", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write("data: {\"type\":\"connected\"}\n\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
  });

  // ── Polling fallback (every 10 minutes) — comprehensive multi-page check ──
  setInterval(async () => {
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey || watchList.size === 0) return;

    console.log(`[Watch] Comprehensive polling ${watchList.size} watched domains...`);
    for (const [slug, entry] of watchList) {
      try {
        const fresh = await buildKnowledgeBase(entry.domain, entry.companyName, firecrawlKey);

        if (entry.knowledge) {
          const { changedSections, combinedDiff } = detectChanges(entry.knowledge, fresh);

          if (changedSections.length > 0) {
            console.log(`[Watch] Changes detected on ${entry.domain}: ${changedSections.join(", ")}`);
            entry.knowledge = fresh.knowledge;
            entry.monitoredPages = fresh.monitoredPages;
            entry.lastContent = fresh.knowledge.homepage;
            await handleChange(slug, entry, combinedDiff, fresh.knowledge.homepage, changedSections);
          } else {
            entry.knowledge = fresh.knowledge;
            entry.monitoredPages = fresh.monitoredPages;
            entry.lastContent = fresh.knowledge.homepage;
            entry.lastChecked = Date.now();
          }
        } else {
          // First poll — store knowledge base
          entry.knowledge = fresh.knowledge;
          entry.monitoredPages = fresh.monitoredPages;
          entry.lastContent = fresh.knowledge.homepage;
          entry.lastChecked = Date.now();
        }
      } catch (e) { console.error(`[Watch] Poll failed for ${slug}:`, e); }
    }
  }, 10 * 60 * 1000); // Poll every 10 minutes

  // ══════════════ PRODUCT WATCH ENDPOINTS ══════════════

  // Add a product to watch
  app.post("/api/product-watch/add", async (req, res) => {
    const { url, name, priceBelow, priceDropPercent, backInStock, anyChange, userPhone } = req.body;
    if (!url || !name) return res.status(400).json({ error: "url and name are required" });

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    if (productWatchList.has(id)) return res.json({ status: "already_watching", id });

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    const watch: ProductWatch = {
      id, url, name,
      alertConditions: {
        priceBelow: priceBelow ? Number(priceBelow) : undefined,
        priceDropPercent: priceDropPercent ? Number(priceDropPercent) : undefined,
        backInStock: backInStock === true,
        anyChange: anyChange === true || (!priceBelow && !priceDropPercent && !backInStock),
      },
      currentData: null,
      previousData: null,
      addedAt: Date.now(),
      lastChecked: Date.now(),
      alertCount: 0,
      userPhone,
    };

    // Initial scrape
    if (firecrawlKey) {
      console.log(`[ProductWatch] Scraping initial data for "${name}"...`);
      const data = await scrapeProduct(url, firecrawlKey);
      if (data) {
        watch.currentData = data;
        console.log(`[ProductWatch] Initial data: ${data.title} | ${data.currency} ${data.price} | ${data.availability} | ⭐${data.rating}`);
      }
    }

    productWatchList.set(id, watch);
    console.log(`[ProductWatch] Now tracking: "${name}" (${url}) — conditions: ${JSON.stringify(watch.alertConditions)}`);

    res.json({
      status: "watching",
      id,
      name,
      url,
      currentData: watch.currentData,
      alertConditions: watch.alertConditions,
    });
  });

  // List all watched products
  app.get("/api/product-watch/list", (req, res) => {
    const entries = Array.from(productWatchList.values()).map(w => ({
      id: w.id,
      url: w.url,
      name: w.name,
      alertConditions: w.alertConditions,
      currentData: w.currentData,
      addedAt: w.addedAt,
      lastChecked: w.lastChecked,
      alertCount: w.alertCount,
    }));
    res.json({ products: entries });
  });

  // Remove a product watch
  app.delete("/api/product-watch/remove/:id", (req, res) => {
    const { id } = req.params;
    if (productWatchList.delete(id)) {
      res.json({ status: "removed", id });
    } else {
      res.status(404).json({ error: "not found" });
    }
  });

  // Manual check for a specific product
  app.get("/api/product-watch/check/:id", async (req, res) => {
    const { id } = req.params;
    const watch = productWatchList.get(id);
    if (!watch) return res.status(404).json({ error: "not found" });

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey) return res.status(500).json({ error: "FIRECRAWL_API_KEY missing" });

    console.log(`[ProductWatch] Manual check for "${watch.name}"...`);
    const freshData = await scrapeProduct(watch.url, firecrawlKey);
    if (!freshData) return res.json({ status: "scrape_failed" });

    watch.previousData = watch.currentData;
    watch.currentData = freshData;
    watch.lastChecked = Date.now();

    const alertMsg = checkProductAlerts(watch);
    if (alertMsg) {
      await handleProductAlert(watch, alertMsg);
      return res.json({ status: "alert_triggered", alert: alertMsg, currentData: freshData });
    }

    res.json({ status: "no_changes", currentData: freshData });
  });

  // ── Product watch polling (every 60 seconds) ──
  setInterval(async () => {
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey || productWatchList.size === 0) return;

    console.log(`[ProductWatch] Polling ${productWatchList.size} products...`);
    for (const [id, watch] of productWatchList) {
      try {
        const freshData = await scrapeProduct(watch.url, firecrawlKey);
        if (!freshData) continue;

        watch.previousData = watch.currentData;
        watch.currentData = freshData;
        watch.lastChecked = Date.now();

        const alertMsg = checkProductAlerts(watch);
        if (alertMsg) {
          await handleProductAlert(watch, alertMsg);
        }
      } catch (e) { console.error(`[ProductWatch] Poll failed for ${id}:`, e); }
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  // API 404 Catch-all
  app.get("/api/*", (req, res) => {
    console.warn(`[Server] API Route Not Found: ${req.url}`);
    res.status(404).json({ error: "API Route Not Found", url: req.url });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Create HTTP server and attach WebSocket server for Twilio media streams
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  // ── WebSocket handler for Twilio <Connect><Stream> → ElevenLabs Conversational AI ──
  wss.on("connection", (twilioWs, req) => {
    const urlPath = req.url || "";
    const match = urlPath.match(/\/api\/watch\/media-stream\/(.+)/);
    if (!match) {
      console.log(`[WS] Non-media connection to ${urlPath}, closing`);
      twilioWs.close();
      return;
    }

    const slug = match[1];
    const msg = pendingVoiceMessages.get(slug);
    console.log(`[WS] Twilio media-stream connected for slug: ${slug}`);

    if (!msg?.agentId) {
      console.warn(`[WS] No agentId for slug ${slug}, closing`);
      twilioWs.close();
      return;
    }

    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsKey) {
      console.warn(`[WS] No ELEVENLABS_API_KEY, closing`);
      twilioWs.close();
      return;
    }

    let streamSid: string | null = null;
    let elevenLabsWs: WebSocket | null = null;

    // Get signed URL and connect to ElevenLabs Conversational AI
    (async () => {
      try {
        const signedRes = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${msg.agentId}`,
          { method: "GET", headers: { "xi-api-key": elevenLabsKey } }
        );
        if (!signedRes.ok) {
          console.error(`[WS] Failed to get signed URL: ${signedRes.status}`);
          twilioWs.close();
          return;
        }
        const { signed_url } = await signedRes.json();
        console.log(`[WS] Got ElevenLabs signed URL, connecting...`);

        elevenLabsWs = new WebSocket(signed_url);

        elevenLabsWs.on("open", () => {
          console.log(`[WS] Connected to ElevenLabs Conversational AI for ${slug}`);
          // Send initial config for audio format compatible with Twilio
          elevenLabsWs!.send(JSON.stringify({
            type: "conversation_initiation_client_data",
            conversation_config_override: {
              agent: { prompt: { prompt: msg.summary } },
              tts: { output_format: "ulaw_8000" },
            },
          }));
        });

        // ElevenLabs → Twilio: forward AI audio responses
        elevenLabsWs.on("message", (data) => {
          try {
            const elMsg = JSON.parse(data.toString());
            if (elMsg.type === "audio" && elMsg.audio?.chunk && streamSid) {
              // Send audio back to Twilio
              twilioWs.send(JSON.stringify({
                event: "media",
                streamSid,
                media: { payload: elMsg.audio.chunk },
              }));
            } else if (elMsg.type === "conversation_initiation_metadata") {
              console.log(`[WS] ElevenLabs conversation initiated for ${slug}`);
            } else if (elMsg.type === "agent_response") {
              console.log(`[WS] Agent: ${elMsg.agent_response_event?.agent_response || ""}`);
            } else if (elMsg.type === "user_transcript") {
              console.log(`[WS] User: ${elMsg.user_transcription_event?.user_transcript || ""}`);
            }
          } catch { /* ignore parse errors */ }
        });

        elevenLabsWs.on("close", () => {
          console.log(`[WS] ElevenLabs disconnected for ${slug}`);
          pendingVoiceMessages.delete(slug);
          twilioWs.close();
        });

        elevenLabsWs.on("error", (err) => {
          console.error(`[WS] ElevenLabs error for ${slug}:`, err);
        });
      } catch (e) {
        console.error(`[WS] Setup error:`, e);
        twilioWs.close();
      }
    })();

    // Twilio → ElevenLabs: forward caller audio
    twilioWs.on("message", (data) => {
      try {
        const twilioMsg = JSON.parse(data.toString());
        if (twilioMsg.event === "start") {
          streamSid = twilioMsg.start.streamSid;
          console.log(`[WS] Twilio stream started: ${streamSid}`);
        } else if (twilioMsg.event === "media" && elevenLabsWs?.readyState === WebSocket.OPEN) {
          // Forward Twilio audio (μ-law 8kHz) to ElevenLabs
          elevenLabsWs.send(JSON.stringify({
            user_audio_chunk: twilioMsg.media.payload,
          }));
        } else if (twilioMsg.event === "stop") {
          console.log(`[WS] Twilio stream stopped for ${slug}`);
          elevenLabsWs?.close();
        }
      } catch { /* ignore parse errors */ }
    });

    twilioWs.on("close", () => {
      console.log(`[WS] Twilio WS closed for ${slug}`);
      elevenLabsWs?.close();
      pendingVoiceMessages.delete(slug);
    });

    twilioWs.on("error", (err) => {
      console.error(`[WS] Twilio WS error:`, err);
    });
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
