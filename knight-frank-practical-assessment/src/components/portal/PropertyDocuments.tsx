"use client";

type Props = {
  isNdaSigned: boolean;
  imPdfUrl: string;
  onSignNda: () => void;
};

export default function PropertyDocuments({
  isNdaSigned,
  imPdfUrl,
  onSignNda,
}: Props) {
  return (
    <footer className="fp-property-documents">
      {isNdaSigned ? (
        <div className="fp-document-button fp-document-button-complete" aria-label="NDA signed">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m4 10 4 4 8-8" />
          </svg>
          NDA signed
        </div>
      ) : (
        <button
          type="button"
          className="fp-document-button fp-document-button-secondary"
          onClick={onSignNda}
        >
          Sign NDA
        </button>
      )}
      {isNdaSigned ? (
        <a
          className="fp-document-button"
          href={imPdfUrl}
          download="Investment_Memorandum.pdf"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 2v11m-4-4 4 4 4-4M3 15v3h14v-3" />
          </svg>
          Download Investment Memorandum
        </a>
      ) : (
        <div className="fp-document-disabled">
          <button
            type="button"
            className="fp-document-button"
            disabled
            aria-describedby="fp-document-lock-hint"
          >
            Download Investment Memorandum
          </button>
          <span id="fp-document-lock-hint" className="fp-document-hint">
            Sign the NDA to unlock
          </span>
        </div>
      )}
    </footer>
  );
}
