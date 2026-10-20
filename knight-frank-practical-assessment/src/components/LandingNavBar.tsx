
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, CircleUserRound, LogOut } from "lucide-react";

export default function LandingNavbar() {
  const router = useRouter();
  const [name, setName] = useState("User");
  const [email, setEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setName(sessionStorage.getItem("kf_user_name") || "User");
    setEmail(sessionStorage.getItem("kf_user_email") || "");
  }, []);

  function handleLogout() {
    sessionStorage.removeItem("kf_user_name");
    sessionStorage.removeItem("kf_user_email");
    sessionStorage.removeItem("kf_auth_token");
    setMenuOpen(false);
    router.replace("/");
  }

  return (
    <header className="landing-navbar">
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

      <div className="profile-wrapper">
        <button
          type="button"
          className="profile-trigger"
          aria-label="Open profile menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <CircleUserRound size={27} strokeWidth={1.7} />
          <ChevronDown
            size={16}
            className={menuOpen ? "profile-chevron profile-chevron-open" : "profile-chevron"}
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
    </header>
  );
}
