"use client";

import { useRef, useState } from "react";

type Props = {
  onSignatureChange: (hasSignature: boolean) => void;
};

export default function SignaturePad({ onSignatureChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const point = getPoint(event);
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !point) return;

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x, point.y);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#12201f";
    context.stroke();
    setIsDrawing(true);
    onSignatureChange(true);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const point = getPoint(event);
    const context = canvasRef.current?.getContext("2d");
    if (!point || !context) return;

    event.preventDefault();
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function stopDrawing() {
    setIsDrawing(false);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    setIsDrawing(false);
    onSignatureChange(false);
  }

  return (
    <div className="fp-signature">
      <p id="fp-signature-instructions" className="fp-signature-instructions">
        Draw your signature below using your mouse or touch screen.
      </p>
      <canvas
        ref={canvasRef}
        className="fp-signature-canvas"
        width={1000}
        height={300}
        aria-label="Signature drawing area"
        aria-describedby="fp-signature-instructions"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onLostPointerCapture={stopDrawing}
      />
      <div className="fp-signature-actions">
        <button
          type="button"
          className="fp-document-button fp-document-button-secondary"
          onClick={clearSignature}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
