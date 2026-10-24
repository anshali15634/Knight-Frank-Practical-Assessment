"use client";

import { useEffect, useRef, useState } from "react";
import SignaturePad from "./SignaturePad";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

type DocumentUrls = {
  nda_pdf_url: string;
  im_pdf_url: string;
};

type Props = {
  onClose: () => void;
  onComplete: (imPdfUrl: string) => void;
};

function isDocumentUrls(value: unknown): value is DocumentUrls {
  const isHttpUrl = (url: unknown): url is string => {
    if (typeof url !== "string" || !url.trim()) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  return (
    typeof value === "object" &&
    value !== null &&
    "nda_pdf_url" in value &&
    isHttpUrl(value.nda_pdf_url) &&
    "im_pdf_url" in value &&
    isHttpUrl(value.im_pdf_url)
  );
}

export default function NdaModal({ onClose, onComplete }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<"review" | "signature">("review");
  const [ndaUrl, setNdaUrl] = useState("");
  const [imUrl, setImUrl] = useState("");
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasSignature, setHasSignature] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>(".fp-nda-close")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    async function loadNda() {
      setIsLoading(true);
      setLoadError("");
      setNdaUrl("");
      try {
        const response = await fetch(`${API_URL}/api/v1/property-documents`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Document links are temporarily unavailable.");
        }
        const payload: unknown = await response.json();
        if (!isDocumentUrls(payload)) {
          throw new Error("The document links could not be read.");
        }

        const pdfResponse = await fetch(payload.nda_pdf_url, {
          signal: controller.signal,
        });
        if (!pdfResponse.ok) {
          throw new Error("The NDA could not be loaded.");
        }
        const pdfBlob = await pdfResponse.blob();
        if (!pdfBlob.size) throw new Error("The NDA file is empty.");
        const pdfHeader = new TextDecoder().decode(
          await pdfBlob.slice(0, 5).arrayBuffer(),
        );
        if (pdfHeader !== "%PDF-") {
          throw new Error("The NDA file could not be displayed.");
        }

        objectUrl = URL.createObjectURL(pdfBlob);
        setNdaUrl(objectUrl);
        setImUrl(payload.im_pdf_url);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "We couldn’t load the NDA. Please try again.",
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadNda();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [retryCount]);

  function retryLoading() {
    setRetryCount((count) => count + 1);
  }

  function completeSigning() {
    if (hasSignature && imUrl) onComplete(imUrl);
  }

  return (
    <div
      className="fp-nda-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="fp-nda-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fp-nda-title"
        aria-describedby="fp-nda-step"
      >
        <header className="fp-nda-header">
          <div>
            <p id="fp-nda-step" className="fp-nda-step">
              {step === "review" ? "Step 1 of 2 · Review NDA" : "Step 2 of 2 · Signature"}
            </p>
            <h2 id="fp-nda-title">Non-Disclosure Agreement</h2>
          </div>
          <button
            type="button"
            className="fp-detail-close fp-nda-close"
            aria-label="Close NDA signing"
            onClick={onClose}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m5 5 10 10M15 5 5 15" />
            </svg>
          </button>
        </header>

        <div className="fp-nda-content">
          {step === "review" ? (
            <>
              {isLoading && (
                <p className="fp-detail-status" role="status">Loading the NDA…</p>
              )}
              {loadError && (
                <div className="fp-nda-load-error" role="alert">
                  <p>{loadError} Please check your connection and retry.</p>
                  <button
                    type="button"
                    className="fp-document-button fp-document-button-secondary"
                    onClick={retryLoading}
                  >
                    Retry
                  </button>
                </div>
              )}
              {ndaUrl && (
                <iframe
                  className="fp-nda-viewer"
                  src={ndaUrl}
                  title="Investment non-disclosure agreement"
                />
              )}
            </>
          ) : (
            <SignaturePad onSignatureChange={setHasSignature} />
          )}
        </div>

        <footer className="fp-nda-footer">
          {step === "review" ? (
            <>
              <button
                type="button"
                className="fp-document-button fp-document-button-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="fp-document-button"
                disabled={!ndaUrl || isLoading || Boolean(loadError)}
                onClick={() => {
                  setHasSignature(false);
                  setStep("signature");
                }}
              >
                Accept
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="fp-document-button fp-document-button-secondary"
                onClick={() => {
                  setHasSignature(false);
                  setStep("review");
                }}
              >
                Back
              </button>
              {hasSignature && (
                <button
                  type="button"
                  className="fp-document-button"
                  onClick={completeSigning}
                >
                  Done
                </button>
              )}
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
