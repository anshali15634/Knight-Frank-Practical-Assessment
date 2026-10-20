"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MeshBasicMaterial } from "three";

type Region = {
  name: string;
  lat: number;
  lng: number;
  labelSide?: "left" | "right";
};

// next/dynamic doesn't forward refs, so pass the ref as a normal prop
const Globe = dynamic(
  async () => {
    const { default: G } = await import("react-globe.gl");
    return function GlobeWithRef({ globeRef, ...props }: any) {
      return <G ref={globeRef} {...props} />;
    };
  },
  {
    ssr: false,
    loading: () => (
      <div className="globe-loading" role="status">
        Preparing the globe...
      </div>
    ),
  }
);

const regions: Region[] = [
  { name: "Asia", lat: 25, lng: 105 },
  { name: "Australia", lat: -25, lng: 134 },
  { name: "Europe", lat: 48, lng: 16 },
  { name: "UK", lat: 54, lng: -2, labelSide: "left" },
  { name: "USA", lat: 39, lng: -98 },
  { name: "Africa", lat: 1, lng: 20 },
  { name: "Middle East", lat: 25, lng: 45 },
  { name: "Rest of the World", lat: -15, lng: -110 },
];

const COUNTRIES_URL = "/data/countries.geojson";

const COLORS = {
  sphere: "#EEF2F7",
  dots: "#f36382",
  atmosphere: "#f36382",
  pin: "#D0103A",
};

// Transition timings (ms) - tweak these to taste
const ZOOM_MS = 1400;
const FADE_MS = 700;
const FADE_START = 900; // when the white fade begins
const NAVIGATE_AT = 1700; // when onSelectRegion fires

type Props = { onSelectRegion: (region: string) => void };

type CountryFeatureCollection = {
  type: "FeatureCollection";
  features: object[];
};

function isCountryFeatureCollection(
  value: unknown
): value is CountryFeatureCollection {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "FeatureCollection" &&
    "features" in value &&
    Array.isArray(value.features)
  );
}

export default function InvestmentGlobe({ onSelectRegion }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(undefined);
  const selectingRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [countries, setCountries] = useState<object[]>([]);
  const [countryLoadError, setCountryLoadError] = useState(false);
  const [globeMaterial, setGlobeMaterial] = useState<MeshBasicMaterial | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 600, height: 480 });

  // Create the material on the client only (avoids the Math.random prerender error)
  useEffect(() => {
    let cancelled = false;
    import("three").then(({ MeshBasicMaterial }) => {
      if (!cancelled) {
        setGlobeMaterial(new MeshBasicMaterial({ color: COLORS.sphere }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load country shapes locally so the globe does not rely on a third-party host.
  useEffect(() => {
    const controller = new AbortController();

    async function loadCountries() {
      try {
        const response = await fetch(COUNTRIES_URL, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Country data request failed: ${response.status}`);
        }

        const data: unknown = await response.json();
        if (!isCountryFeatureCollection(data)) {
          throw new Error("Country data is not a GeoJSON feature collection.");
        }

        setCountries(data.features);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Unable to load globe country outlines.", error);
        setCountryLoadError(true);
      }
    }

    void loadCountries();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const w = Math.floor(entry.contentRect.width);
      const height = window.matchMedia("(min-width: 701px)").matches
        ? w
        : Math.max(340, Math.min(560, Math.floor(w * 0.78)));
      setDimensions({
        width: Math.max(280, w),
        height,
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const handleReady = useCallback(() => {
    const controls = globeRef.current?.controls();
    if (!controls) return;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
    controls.enableZoom = false;
    controls.addEventListener("start", () => {
      if (!selectingRef.current) controls.autoRotate = false;
    });
    controls.addEventListener("end", () => {
      if (!selectingRef.current) controls.autoRotate = true;
    });
    globeRef.current.pointOfView({ lat: 30, lng: 20, altitude: 2.4 });
  }, []);

  const handleSelect = useCallback(
    (region: Region) => {
      if (selectingRef.current) return;
      selectingRef.current = true;

      const controls = globeRef.current?.controls();
      if (controls) controls.autoRotate = false;

      // 1. Glide the camera to the region
      globeRef.current?.pointOfView(
        { lat: region.lat, lng: region.lng, altitude: 1.2 },
        ZOOM_MS
      );
      // 2. Fade the page to white
      timers.current.push(setTimeout(() => setLeaving(true), FADE_START));
      // 3. Navigate
      timers.current.push(
        setTimeout(() => onSelectRegion(region.name), NAVIGATE_AT)
      );
    },
    [onSelectRegion]
  );

  // Pins are plain DOM elements, so styles are inlined (no CSS file needed)
  const pinElement = useCallback(
    (d: object) => {
      const region = d as Region;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", `Select ${region.name}`);
      Object.assign(btn.style, {
        display: "flex",
        flexDirection: region.labelSide === "left" ? "row-reverse" : "row",
        alignItems: "center",
        gap: "8px",
        background: "none",
        border: "0",
        padding: "0",
        cursor: "pointer",
        pointerEvents: "auto",
        transform: "translate(0, -50%)",
        transition: "opacity 0.3s",
      });

      const dot = document.createElement("span");
      Object.assign(dot.style, {
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        background: COLORS.pin,
        boxShadow: "0 0 0 4px rgba(208,16,58,0.22)",
        transition: "box-shadow 0.2s",
        flexShrink: "0",
      });

      const label = document.createElement("span");
      label.textContent = region.name;
      Object.assign(label.style, {
        background: "#fff",
        color: "#f36382",
        fontSize: "13px",
        fontWeight: "600",
        fontFamily: "inherit",
        padding: "4px 10px",
        borderRadius: "999px",
        boxShadow: "0 2px 8px rgba(0,38,77,0.18)",
        whiteSpace: "nowrap",
      });

      const grow = () => (dot.style.boxShadow = "0 0 0 8px rgba(208,16,58,0.3)");
      const shrink = () => (dot.style.boxShadow = "0 0 0 4px rgba(208,16,58,0.22)");
      btn.addEventListener("mouseenter", grow);
      btn.addEventListener("mouseleave", shrink);
      btn.addEventListener("focus", grow);
      btn.addEventListener("blur", shrink);
      btn.addEventListener("click", () => handleSelect(region));

      btn.append(dot, label);
      return btn;
    },
    [handleSelect]
  );

  return (
    <div className="investment-globe" ref={containerRef}>
      {globeMaterial && (
        <Globe
          globeRef={globeRef}
          onGlobeReady={handleReady}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={globeMaterial}
          showAtmosphere
          atmosphereColor={COLORS.atmosphere}
          atmosphereAltitude={0.1}
          hexPolygonsData={countries}
          hexPolygonResolution={3}
          hexPolygonMargin={0.2}
          hexPolygonUseDots
          hexPolygonColor={() => COLORS.dots}
          htmlElementsData={regions}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.02}
          htmlElement={pinElement}
          // Hide pins on the far side of the globe
          htmlElementVisibilityModifier={(el: HTMLElement, isVisible: boolean) => {
            el.style.opacity = isVisible ? "1" : "0";
            el.style.pointerEvents = isVisible ? "auto" : "none";
          }}
        />
      )}

      <p className="globe-instruction">
        Drag to explore · Select a pin to choose a region
      </p>

      {countryLoadError && (
        <p className="globe-error" role="alert">
          Country outlines could not be loaded. Please refresh and try again.
        </p>
      )}

      {/* White fade-out overlay used during the transition */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background: "#fff",
          opacity: leaving ? 1 : 0,
          pointerEvents: leaving ? "auto" : "none",
          transition: `opacity ${FADE_MS}ms ease`,
          zIndex: 50,
        }}
      />
    </div>
  );
}