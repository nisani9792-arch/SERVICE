"use client";

import { cn } from "@/lib/cn";

export interface JusicLogoProps {
  size?: number;
  className?: string;
  variant?: "full" | "mark";
  animated?: boolean;
}

/** Premium soft-gradient JUSIC mark — abstract wave + letterforms, no figurative art. */
export function JusicLogo({
  size = 40,
  className,
  variant = "full",
  animated = true
}: JusicLogoProps) {
  const id = "jusic-logo-grad";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(animated && "jusic-logo-float", className)}
      role="img"
      aria-label="Jusic"
    >
      <defs>
        <linearGradient id={`${id}-a`} x1="8" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C8EF5" />
          <stop offset="0.45" stopColor="#9B7CF7" />
          <stop offset="1" stopColor="#5ECFC8" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="24" x2="48" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" stopOpacity="0.35" />
          <stop offset="1" stopColor="#67E8F9" stopOpacity="0.15" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="14"
        fill={`url(#${id}-b)`}
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="1"
      />

      {/* Abstract fluid arc */}
      <path
        d="M10 32C14 22 20 16 28 14C34 13 38 16 38 20C38 26 30 30 22 32C16 33 12 35 10 32Z"
        fill={`url(#${id}-a)`}
        opacity="0.22"
      />

      {/* Stylized J wave */}
      <path
        d="M14 14V28C14 31 16 33 19 33C22 33 24 31 24 28V18"
        stroke={`url(#${id}-a)`}
        strokeWidth="3.2"
        strokeLinecap="round"
        filter={`url(#${id}-glow)`}
      />

      {/* Music pulse bars — minimalist */}
      <rect x="28" y="16" width="3" height="14" rx="1.5" fill={`url(#${id}-a)`} opacity="0.9" />
      <rect x="33" y="12" width="3" height="18" rx="1.5" fill={`url(#${id}-a)`} opacity="0.75" />
      <rect x="38" y="18" width="3" height="12" rx="1.5" fill={`url(#${id}-a)`} opacity="0.6" />

      {variant === "full" ? (
        <text
          x="24"
          y="43"
          textAnchor="middle"
          fill={`url(#${id}-a)`}
          fontSize="7"
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
          letterSpacing="0.12em"
        >
          JUSIC
        </text>
      ) : null}
    </svg>
  );
}
