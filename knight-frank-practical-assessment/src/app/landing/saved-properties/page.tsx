"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LandingNavbar from "@/components/LandingNavBar";
import FrankAssistant from "@/components/assistant/Frankassistant";

const SAVED_PROP_BG = "/realestate5.jpeg";

export default function SavedPropertiesPage() {
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    const savedName = sessionStorage.getItem("kf_user_name");
    if (savedName) setUserName(savedName);
  }, []);

  return (
    <main className="investment-page">
      <LandingNavbar />

      <section className="investment-hero">
        <div className="investment-hero-background" aria-hidden="true">
          <div
            className="investment-hero-background-image"
            style={{
              backgroundImage: `url("${SAVED_PROP_BG}")`,
              opacity: 1,
            }}
          />
        </div>

        <div className="investment-intro">
          <p className="investment-eyebrow">KNIGHT FRANK · YOUR PORTFOLIO</p>

          <div className="heading-transition">
            <h1 className="investment-heading is-visible">
              Your saved properties,{" "}
              <span className="desktop-break" style={{ color: "#252525" }}>
                {userName}
              </span>
            </h1>
          </div>

          <p className="investment-description">
            Keep the global investment opportunities you are interested in
            together in one place.
          </p>
        </div>
      </section>

      <section
        className="portal-section"
        aria-label="Saved properties"
      >
        <div className="portal-placeholder-content">
          <p className="portal-placeholder-note">
            Your saved properties will appear here. This section is a
            placeholder while property saving is being prepared.
          </p>
          <Link
            href="/landing#find-property"
            className="portal-placeholder-link"
          >
            Find a Property
          </Link>
        </div>
      </section>

      <footer className="investment-footer">
        <span>KNIGHT FRANK</span>
        <span>Global Investment Portal</span>
      </footer>

      <FrankAssistant />
    </main>
  );
}