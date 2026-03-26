import React, { useEffect, useRef, useMemo } from "react";
import GlobeGL, { GlobeMethods } from "react-globe.gl";
import { Startup, INDUSTRY_COLORS } from "../types";

interface GlobeProps {
  startups: Startup[];
  onSelectStartup: (startup: Startup) => void;
  selectedStartup: Startup | null;
}

/** Build a chain of logo URLs to try in order */
function getLogoUrls(startup: Startup): string[] {
  const name = encodeURIComponent(startup.name);
  const color = (INDUSTRY_COLORS[startup.industry] || "#6366f1").replace("#", "");

  // Try to get the domain from the logo URL or guess it
  const domainGuesses: string[] = [];
  if (startup.logo) {
    try {
      // If it's a clearbit URL like https://logo.clearbit.com/stripe.com, extract the domain
      const match = startup.logo.match(/clearbit\.com\/(.+)/);
      if (match) domainGuesses.push(match[1]);
    } catch {}
  }
  // Always add the company name as a guess
  const nameDomain = startup.name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
  domainGuesses.push(nameDomain);

  const urls: string[] = [];

  // 1. Google Favicon service (very reliable, no CORS)
  if (domainGuesses[0]) {
    urls.push(`https://www.google.com/s2/favicons?sz=64&domain=${domainGuesses[0]}`);
  }

  // 2. Clearbit logo (original)
  if (startup.logo) urls.push(startup.logo);

  // 3. Logo.dev (another reliable logo API)
  if (domainGuesses[0]) {
    urls.push(`https://img.logo.dev/${domainGuesses[0]}?token=pk_X-1ZO13GSgeOoUrIuJ6BeA`);
  }

  // 4. UI Avatars fallback (always works, text-based)
  urls.push(
    `https://ui-avatars.com/api/?name=${name}&background=${color}&color=fff&bold=true&size=64&font-size=0.4`
  );

  return urls;
}

/** Jitter overlapping coordinates so every startup shows as a unique pin */
function jitterCoordinates(startups: Startup[]): (Startup & { jLat: number; jLng: number })[] {
  const seen: Record<string, number> = {};
  return startups.map((s) => {
    const key = `${s.lat.toFixed(2)},${s.lng.toFixed(2)}`;
    const count = seen[key] || 0;
    seen[key] = count + 1;
    // Spread in a small spiral so clusters of many don't overlap 
    const angle = count * 137.5 * (Math.PI / 180); // golden angle
    const radius = count === 0 ? 0 : 1.2 + count * 0.6; // degrees
    return {
      ...s,
      jLat: s.lat + (count === 0 ? 0 : radius * Math.cos(angle)),
      jLng: s.lng + (count === 0 ? 0 : radius * Math.sin(angle)),
    };
  });
}

const Globe: React.FC<GlobeProps> = ({ startups, onSelectStartup, selectedStartup }) => {
  const globeRef = useRef<GlobeMethods | null>(null);

  const jitteredStartups = useMemo(() => jitterCoordinates(startups), [startups]);

  const markerData = useMemo(
    () =>
      jitteredStartups.map((s) => ({
        ...s,
        lat: s.jLat,
        lng: s.jLng,
        color: INDUSTRY_COLORS[s.industry] || INDUSTRY_COLORS.Other,
        logoUrls: getLogoUrls(s),
      })),
    [jitteredStartups]
  );

  const arcData = useMemo(() => {
    const arcs: any[] = [];
    const industries = Array.from(new Set(startups.map((s) => s.industry)));
    industries.forEach((industry: string) => {
      const industryStartups = jitteredStartups.filter((s) => s.industry === industry);
      for (let i = 0; i < industryStartups.length - 1; i++) {
        arcs.push({
          startLat: industryStartups[i].jLat,
          startLng: industryStartups[i].jLng,
          endLat: industryStartups[i + 1].jLat,
          endLng: industryStartups[i + 1].jLng,
          color: INDUSTRY_COLORS[industry] || INDUSTRY_COLORS.Other,
        });
      }
    });
    return arcs;
  }, [jitteredStartups]);

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = !selectedStartup;
      globeRef.current.controls().autoRotateSpeed = 0.5;
    }
  }, [selectedStartup]);

  useEffect(() => {
    if (selectedStartup && globeRef.current) {
      // Use jittered coordinates so the camera points to where the marker is actually rendered
      const jittered = jitteredStartups.find((s) => s.name === selectedStartup.name);
      const lat = jittered ? jittered.jLat : selectedStartup.lat;
      const lng = jittered ? jittered.jLng : selectedStartup.lng;
      globeRef.current.pointOfView(
        { lat, lng, altitude: 0.5 },
        1000
      );
    }
  }, [selectedStartup, jitteredStartups]);

  return (
    <div className="w-full h-full">
      <GlobeGL
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

        arcsData={arcData}
        arcColor="color"
        arcDashLength={0.4}
        arcDashGap={4}
        arcDashInitialGap={() => Math.random() * 5}
        arcDashAnimateTime={1000}
        arcAltitudeAutoScale={0.5}

        htmlElementsData={markerData}
        htmlLat="lat"
        htmlLng="lng"
        htmlTransitionDuration={0}
        htmlElement={(d: any) => {
          const isSelected = selectedStartup?.name === d.name;
          const size = isSelected ? 50 : 38;

          // Wrapper centers the marker around the lat/lng point
          const wrapper = document.createElement("div");
          wrapper.style.width = `${size}px`;
          wrapper.style.height = `${size + 16}px`;
          wrapper.style.transform = `translate(-${size / 2}px, -${size / 2}px)`;
          wrapper.style.cursor = "pointer";
          wrapper.style.pointerEvents = "auto";
          wrapper.onclick = () => onSelectStartup(d);

          const el = document.createElement("div");
          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          el.style.borderRadius = "50%";
          el.style.border = `${isSelected ? 3 : 2}px solid ${d.color}`;
          el.style.backgroundColor = "#ffffff";
          el.style.boxShadow = `0 0 ${isSelected ? 22 : 10}px ${d.color}, 0 2px 8px rgba(0,0,0,0.4)`;
          el.style.overflow = "hidden";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";
          el.title = `${d.name} — ${d.city}, ${d.country}`;

          const img = document.createElement("img");
          img.style.width = "70%";
          img.style.height = "70%";
          img.style.objectFit = "contain";
          img.style.borderRadius = "0";
          img.referrerPolicy = "no-referrer";
          img.alt = d.name;

          // Try logo URLs in order
          let urlIndex = 0;
          const logoUrls: string[] = d.logoUrls;
          const tryNextUrl = () => {
            if (urlIndex < logoUrls.length) {
              img.src = logoUrls[urlIndex++];
            }
          };
          img.onerror = tryNextUrl;
          tryNextUrl();

          el.appendChild(img);
          wrapper.appendChild(el);

          // Name label below pin
          const label = document.createElement("div");
          label.textContent = d.name;
          label.style.fontSize = "9px";
          label.style.fontWeight = "700";
          label.style.color = "#fff";
          label.style.textAlign = "center";
          label.style.marginTop = "2px";
          label.style.textShadow = "0 1px 4px rgba(0,0,0,0.9)";
          label.style.whiteSpace = "nowrap";
          label.style.letterSpacing = "0.03em";
          wrapper.appendChild(label);

          return wrapper;
        }}
      />
    </div>
  );
};

export default Globe;
