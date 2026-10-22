import Link from "next/link";
import LandingNavbar from "@/components/LandingNavBar";

export default function SavedPropertiesPage() {
  return (
    <main className="investment-page portal-placeholder-page">
      <LandingNavbar />
      <section className="portal-placeholder-section">
        <div className="portal-placeholder-content">
          <p className="investment-eyebrow">KNIGHT FRANK · YOUR PORTFOLIO</p>
          <h1>Saved Properties</h1>
          <p className="portal-placeholder-description">
            Keep the global investment opportunities you are interested in
            together in one place.
          </p>
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
    </main>
  );
}
