
import Image from "next/image";
import Link from "next/link";
import AuthPanel from "@/components/AuthPanel";

export default function Home() {
  return (
    <main className="landing-page">
      {/* Fixed background carousel */}
      <div className="background-carousel" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((image, index) => (
          <div
            key={image}
            className="carousel-image"
            style={{
              backgroundImage: `url('/realestate${image}.jpeg')`,
              animationDelay: `${index * 6}s`,
            }}
          />
        ))}
      </div>

      <div className="background-overlay" />

      {/* Transparent navigation */}
      <header className="navbar">
        <Link href="/" className="brand" aria-label="Knight Frank home">
          <Image
            src="/Knight-Frank-Logo.png"
            alt="Knight Frank"
            className="brand-logo"
            width={604}
            height={221}
          />
        </Link>

        <span className="navbar-label">Global Investment Portal</span>
      </header>

      {/* Main content */}
      <section className="hero">
        <div className="hero-content">
          <div className="intro">
            <p className="eyebrow">WELCOME TO</p>
            <h1>KNIGHT FRANK</h1>
            <p className="tagline">Your partners in property</p>

            <div className="accent-line" />

            <h2>Global Investment Portal</h2>
            <p className="hero-description">
              Your next step starts here.
            </p>
          </div>

          <AuthPanel />
        </div>
      </section>

      <footer className="page-footer">
        <span>KNIGHT FRANK</span>
        <span>Global Investment Portal</span>
      </footer>
    </main>
  );
}
