import Image from "next/image";
import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="portal-page">
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
        <span className="navbar-label">ASSESSMENT PLATFORM</span>
      </header>

      <section className="portal-main">
        <div className="portal-card">
          <span className="portal-status">SIGNED IN</span>
          <h1>Welcome to your portal</h1>
          <p>
            You’re signed in successfully. Your Knight Frank assessment
            platform is ready.
          </p>
          <Link className="portal-link" href="/">
            Return to home
          </Link>
        </div>
      </section>

      <footer className="page-footer">
        <span>KNIGHT FRANK</span>
        <span>Assessment Platform</span>
      </footer>
    </main>
  );
}
