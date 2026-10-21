"use client";

import Image from "next/image";
import type { CSSProperties } from "react";

export type Gaze = "center" | "down" | "up" | "left" | "right";

type Props = {
  /** Diameter in px */
  size?: number;
  gaze?: Gaze;
  /** When true the eyes play a single blink */
  blink?: boolean;
  /** Called when a blink finishes so the parent can reset `blink` */
  onBlinkEnd?: () => void;
  /** Static = chat avatar: no bobbing */
  isStatic?: boolean;
  className?: string;
};

export default function FrankBlob({
  size = 72,
  gaze = "center",
  blink = false,
  onBlinkEnd,
  isStatic = false,
  className = "",
}: Props) {
  const classes = [
    "frank-blob",
    blink ? "frank-blob--blink" : "",
    isStatic ? "frank-blob--static" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classes}
      style={{ "--s": `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <span className="frank-blob__bob">
        <Image
          src="/sphere.png"
          alt=""
          width={size * 2}
          height={size * 2}
          className="frank-blob__img"
          draggable={false}
        />
        <span className="frank-blob__eyes" data-gaze={gaze}>
          <span className="frank-blob__eye" onAnimationEnd={onBlinkEnd} />
          <span className="frank-blob__eye" />
        </span>
      </span>
    </span>
  );
}