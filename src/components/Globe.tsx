import React, { useEffect, useRef, useMemo } from "react";
import GlobeGL from "react-globe.gl";
import { Startup, INDUSTRY_COLORS } from "../types";

interface GlobeProps {
  startups: Startup[];
  onSelectStartup: (startup: Startup) => void;
  selectedStartup: Startup | null;
}

const Globe: React.FC<GlobeProps> = ({ startups, onSelectStartup, selectedStartup }) => {
  const globeRef = useRef<any>(null);

  // Prepare data for markers
  const markerData = useMemo(() => {
    return startups.map((s) => ({
      ...s,
      size: 0.5,
      color: INDUSTRY_COLORS[s.industry] || INDUSTRY_COLORS.Other,
    }));
  }, [startups]);

  // Prepare arcs (connecting same industry)
  const arcData = useMemo(() => {
    const arcs: any[] = [];
    const industries = Array.from(new Set(startups.map((s) => s.industry)));
    
    industries.forEach((industry: string) => {
      const industryStartups = startups.filter((s) => s.industry === industry);
      for (let i = 0; i < industryStartups.length - 1; i++) {
        arcs.push({
          startLat: industryStartups[i].lat,
          startLng: industryStartups[i].lng,
          endLat: industryStartups[i + 1].lat,
          endLng: industryStartups[i + 1].lng,
          color: INDUSTRY_COLORS[industry] || INDUSTRY_COLORS.Other,
        });
      }
    });
    return arcs;
  }, [startups]);

  useEffect(() => {
    if (globeRef.current) {
      // Auto-rotation
      globeRef.current.controls().autoRotate = !selectedStartup;
      globeRef.current.controls().autoRotateSpeed = 0.5;
    }
  }, [selectedStartup]);

  useEffect(() => {
    if (selectedStartup && globeRef.current) {
      // Zoom to selected startup
      globeRef.current.pointOfView(
        { lat: selectedStartup.lat, lng: selectedStartup.lng, altitude: 0.5 },
        1000
      );
    }
  }, [selectedStartup]);

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
          const el = document.createElement("div");
          el.className = "globe-marker";
          el.style.width = "40px";
          el.style.height = "40px";
          el.style.borderRadius = "50%";
          el.style.border = `2px solid ${d.color}`;
          el.style.backgroundColor = "white"; // White background to make it pop
          el.style.cursor = "pointer";
          el.style.boxShadow = `0 0 15px ${d.color}`;
          el.style.overflow = "hidden";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";
          el.onclick = () => onSelectStartup(d);

          const img = document.createElement("img");
          // Use a more reliable fallback if logo is missing
          const logoUrl = d.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name)}&background=random`;
          img.src = logoUrl;
          img.style.width = "80%"; // Slightly smaller to show the white background
          img.style.height = "80%";
          img.style.objectFit = "contain";
          img.referrerPolicy = "no-referrer";
          img.alt = d.name;
          
          img.onerror = () => {
            img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name)}&background=${d.color.replace('#', '')}&color=fff`;
            img.style.width = "100%";
            img.style.height = "100%";
          };

          el.appendChild(img);
          return el;
        }}
      />
    </div>
  );
};

export default Globe;
