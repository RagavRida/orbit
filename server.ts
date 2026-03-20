import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Proxy for Firecrawl (Scraping YC)
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
            prompt: "Extract at least 10 companies with their name, tagline, city, country, industry, logo URL, a short founder quote, and founding year as a JSON array named 'startups'.",
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
      };

      startups = startups.map((s: any) => ({
        ...s,
        lat: cityCoords[s.city] ? cityCoords[s.city].lat : (Math.random() * 120 - 60),
        lng: cityCoords[s.city] ? cityCoords[s.city].lng : (Math.random() * 240 - 120),
        industry: s.industry || "Other"
      }));

      console.log(`Returning ${startups.length} startups`);
      res.json({ startups });
    } catch (error: any) {
      console.error("Scrape Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
