"use client";

import { useEffect, useRef, useState } from "react";
import LandingNavbar from "@/components/LandingNavBar";
import InvestmentGlobe from "@/components/InvestmentGlobe";
import AssetsPropertiesSearchMain from "@/components/portal/assets_properties_search_main";

const REGIONS = [
  "Asia",
  "Australia",
  "Europe",
  "UK",
  "USA",
  "Africa",
  "Middle East",
  "Rest of the World",
];

const SCROLL_DURATION_MS = 1100;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export default function LandingPage() {
  const [userName, setUserName] = useState("User");
  const [headingStage, setHeadingStage] = useState<"welcome" | "invest">(
    "welcome"
  );
  const [selectedRegion, setSelectedRegion] = useState("");
  const [isPortalLocked, setIsPortalLocked] = useState(false);
  const portalRef = useRef<HTMLElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const savedName = sessionStorage.getItem("kf_user_name");

    if (savedName) {
      setUserName(savedName);
    }

    const timer = window.setTimeout(() => {
      setHeadingStage("invest");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, []);

  // Lock page scrolling once the user has arrived at the portal
  useEffect(() => {
    if (!isPortalLocked) return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isPortalLocked]);

  // Cancel any running scroll animation on unmount
  useEffect(
    () => () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    },
    []
  );

  function handleRegionSelect(region: string) {
    if (isPortalLocked) return;

    setSelectedRegion(region);

    const portal = portalRef.current;
    if (!portal) return;

    // To always animate while developing, change to: const duration = SCROLL_DURATION_MS;
    const duration = SCROLL_DURATION_MS;
    const startY = window.scrollY;
    const startTime = performance.now();

    // Respect the sticky navbar offset defined by scroll-margin-top in the CSS
    const offset = parseFloat(getComputedStyle(portal).scrollMarginTop) || 0;
    const getTargetY = () =>
      portal.getBoundingClientRect().top + window.scrollY - offset;

    const step = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      // Target is re-measured every frame so layout shifts don't break the scroll
      const y = startY + (getTargetY() - startY) * easeInOutCubic(t);

      window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });

      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        setIsPortalLocked(true);
      }
    };

    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(step);
  }

  return (
    <main className="investment-page">
      <LandingNavbar />

      <section className="investment-hero">
        <div className="investment-intro">
          <p className="investment-eyebrow">KNIGHT FRANK · GLOBAL INVESTMENT</p>

          <div className="heading-transition" aria-live="polite">
            <h1
              className={
                headingStage === "welcome"
                  ? "investment-heading is-visible"
                  : "investment-heading"
              }
              aria-hidden={headingStage !== "welcome"}
            >
              Welcome, <span>{userName}</span>
            </h1>
            <h1
              className={
                headingStage === "invest"
                  ? "investment-heading is-visible"
                  : "investment-heading"
              }
              aria-hidden={headingStage !== "invest"}
            >
              Where would you like to invest?
            </h1>
          </div>

          <p className="investment-description">
            Explore markets around the world and choose the region you would
            like to discover.
          </p>

          <div className="region-legend" aria-label="Available regions">
            {REGIONS.map((region) => (
              <button
                key={region}
                type="button"
                className="region-chip"
                onClick={() => handleRegionSelect(region)}
              >
                <span className="region-chip-dot" />
                {region}
              </button>
            ))}
          </div>
        </div>

        <div className="globe-section">
          <InvestmentGlobe onSelectRegion={handleRegionSelect} />
        </div>
      </section>

      <section
        className="portal-section"
        ref={portalRef}
        aria-label="Property search portal"
      >
        <AssetsPropertiesSearchMain region={selectedRegion} />
      </section>

      <footer className="investment-footer">
        <span>KNIGHT FRANK</span>
        <span>Global Investment Portal</span>
      </footer>
    </main>
  );
}