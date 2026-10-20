
"use client";

import { useEffect, useRef, useState } from "react";
import LandingNavbar from "@/components/LandingNavBar";
import InvestmentGlobe from "@/components/InvestmentGlobe";

export default function LandingPage() {
  const [userName, setUserName] = useState("User");
  const [headingStage, setHeadingStage] = useState<"welcome" | "invest">(
    "welcome"
  );
  const [selectedRegion, setSelectedRegion] = useState("");
  const nextStepRef = useRef<HTMLElement>(null);

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

  function handleRegionSelect(region: string) {
    setSelectedRegion(region);

    window.setTimeout(() => {
      nextStepRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
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
          {[
            "Asia",
            "Australia",
            "Europe",
            "UK",
            "USA",
            "Africa",
            "Middle East",
            "Rest of the World",
          ].map((region) => (
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
        className="next-step-section"
        ref={nextStepRef}
        aria-labelledby="next-step-heading"
      >
        <div className="next-step-inner">
          <p className="investment-eyebrow">YOUR INVESTMENT JOURNEY</p>
          <h2 id="next-step-heading">Next step here</h2>
          <p className="next-step-description">
            {selectedRegion
              ? `You selected ${selectedRegion}. The next stage of your investment journey will appear here.`
              : "Your next stage will appear here after you choose a region."}
          </p>

          {selectedRegion && (
            <div className="selected-region">
              <span className="selected-region-label">SELECTED REGION</span>
              <span className="selected-region-value">{selectedRegion}</span>
            </div>
          )}
        </div>
      </section>

      <footer className="investment-footer">
        <span>KNIGHT FRANK</span>
        <span>Global Investment · Assessment Platform</span>
      </footer>
    </main>
  );
}
