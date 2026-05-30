"use client";

import { useMemo } from "react";

export type WaveformProgressProps = {
  /** 0–100 */
  value: number;
  className?: string;
  /** Show animated bars overlay */
  animated?: boolean;
};

export function WaveformProgress({ value, className = "", animated = true }: WaveformProgressProps) {
  const pct = Math.min(100, Math.max(0, value));
  const bars = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  return (
    <div
      className={`jm3-waveform ${className}`.trim()}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="jm3-waveform__fill"
        style={{ transform: `scaleX(${pct / 100})` }}
      />
      {animated && pct > 0 && pct < 100 ? (
        <div className="jm3-waveform__bars" aria-hidden>
          {bars.map((i) => (
            <span
              key={i}
              className="jm3-waveform__bar"
              style={{
                height: `${28 + ((i * 17) % 72)}%`,
                animationDelay: `${(i % 8) * 0.08}s`
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
