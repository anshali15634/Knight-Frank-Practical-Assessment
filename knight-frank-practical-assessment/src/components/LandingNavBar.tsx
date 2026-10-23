
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, CircleUserRound, LogOut } from "lucide-react";

export default function LandingNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState("User");
  const [email, setEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const exploreHref =
    pathname === "/landing" ? "#explore-regions" : "/landing#explore-regions";
  const findPropertyHref =
    pathname === "/landing" ? "#find-property" : "/landing#find-property";
  useEffect(() => {
    setName(sessionStorage.getItem("kf_user_name") || "User");
    setEmail(sessionStorage.getItem("kf_user_email") || "");
  }, []);

  useEffect(() => {
    if (pathname !== "/landing") return;

    const pendingSection = sessionStorage.getItem("kf_landing_scroll_target");
    if (!pendingSection) return;

    sessionStorage.removeItem("kf_landing_scroll_target");
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(pendingSection)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  function handleSectionClick(
    event: MouseEvent<HTMLAnchorElement>,
    sectionId: string
  ) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();

    if (pathname === "/landing") {
      window.history.pushState(null, "", `#${sectionId}`);
      document
        .getElementById(sectionId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    sessionStorage.setItem("kf_landing_scroll_target", sectionId);
    router.push("/landing");
  }

  function handleLogout() {
    sessionStorage.removeItem("kf_user_name");
    sessionStorage.removeItem("kf_user_email");
    sessionStorage.removeItem("kf_auth_token");
    setMenuOpen(false);
    router.replace("/");
  }

  return (
    <header className="landing-navbar">
      <div className="landing-navbar-top">
        <Link href="/landing" className="landing-brand" aria-label="Knight Frank home">
          <Image
            src="/Knight-Frank-Logo.png"
            alt="Knight Frank"
            className="brand-logo"
            width={220}
            height={80}
            priority
          />
        </Link>

        <span className="landing-brand-title">Global Investment Portal</span>

        <div className="profile-wrapper">
          <button
            type="button"
            className="profile-trigger"
            aria-label="Open profile menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="profile-label">Profile</span>
            <CircleUserRound size={27} strokeWidth={1.7} />
            <ChevronDown
              size={16}
              className={
                menuOpen
                  ? "profile-chevron profile-chevron-open"
                  : "profile-chevron"
              }
            />
          </button>

          {menuOpen && (
            <>
              <button
                type="button"
                className="profile-dismiss"
                aria-label="Close profile menu"
                onClick={() => setMenuOpen(false)}
              />
              <div className="profile-dropdown" role="menu">
                <div className="profile-details">
                  <div className="profile-dropdown-name">{name}</div>
                  <div className="profile-dropdown-email">
                    {email || "Email unavailable"}
                  </div>
                </div>

                <div className="profile-divider" />

                <button
                  type="button"
                  role="menuitem"
                  className="profile-logout"
                  onClick={handleLogout}
                >
                  <LogOut size={17} />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <nav className="landing-nav" aria-label="Main navigation">
        <Link
          href={exploreHref}
          className="landing-nav-link"
          onClick={(event) => handleSectionClick(event, "explore-regions")}
        >
          Explore Regions
        </Link>
        <Link
          href={findPropertyHref}
          className="landing-nav-link"
          onClick={(event) => handleSectionClick(event, "find-property")}
        >
          Find a Property
        </Link>
        <Link href="/landing/saved-properties" className="landing-nav-link">
          Saved Properties
        </Link>
        {/* <Link href="/landing/sell-property" className="landing-nav-link">
          Sell a Property
        </Link> */}
      </nav>
    </header>
  );
}
