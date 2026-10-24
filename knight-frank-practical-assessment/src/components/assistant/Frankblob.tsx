"use client";

import { Sparkle } from "lucide-react";
import type { CSSProperties } from "react";

type Props = {
  /** Diameter in px */
  size?: number;
  className?: string;
};

export default function FrankBlob({ size = 72, className = "" }: Props) {
  return (
    <span
      className={`frank-blob ${className}`.trim()}
      style={{ "--s": `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <Sparkle
        className="frank-blob__sparkle"
        size={size * 0.48}
        fill="currentColor"
        strokeWidth={1.8}
      />
    </span>
  );
}