"use client";

import {Bot} from "lucide-react";
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
      <Bot
        size={size * 0.48}
        strokeWidth={1.8}
      />
    </span>
  );
}