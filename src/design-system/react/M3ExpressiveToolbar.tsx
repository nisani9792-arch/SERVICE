"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { JM3_SPRING, JM3_EASE_EMPHASIZED } from "../tokens/motion";
import { WaveformProgress } from "./WaveformProgress";

export type M3ToolbarSegment = {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number;
};

export type M3ToolbarMetric = {
  label: string;
  value: number;
  tone?: "primary" | "amber" | "muted";
};

export type M3ToolbarIconAction = {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
};

export type M3ExpressiveToolbarProps = {
  title: string;
  subtitle?: string;
  /** 0–100 — shows waveform strip when defined */
  progress?: number;
  segments?: M3ToolbarSegment[];
  activeSegmentId?: string;
  onSegmentChange?: (id: string) => void;
  metrics?: M3ToolbarMetric[];
  iconActions?: M3ToolbarIconAction[];
  /** Primary split button */
  splitLabel?: string;
  splitIcon?: ReactNode;
  onSplitMain?: () => void;
  onSplitMenu?: () => void;
  trailing?: ReactNode;
  className?: string;
};

function metricClass(tone?: M3ToolbarMetric["tone"]): string {
  if (tone === "amber") return "jm3-metric-chip jm3-metric-chip--amber";
  if (tone === "primary") return "jm3-metric-chip jm3-metric-chip--primary";
  return "jm3-metric-chip jm3-metric-chip--muted";
}

function SegmentGroup({
  segments,
  activeId,
  onChange
}: {
  segments: M3ToolbarSegment[];
  activeId?: string;
  onChange?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ width: 0, x: 0 });

  const activeIndex = segments.findIndex((s) => s.id === activeId);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root || activeIndex < 0) return;
    const btn = root.querySelectorAll<HTMLButtonElement>(".jm3-segment-btn")[activeIndex];
    if (!btn) return;
    setIndicator({ width: btn.offsetWidth, x: btn.offsetLeft });
  }, [activeIndex, segments, activeId]);

  return (
    <LayoutGroup id="jm3-segment-group">
      <div ref={containerRef} className="jm3-segment-group" role="tablist">
        {activeIndex >= 0 && indicator.width > 0 ? (
          <motion.div
            layoutId="jm3-segment-pill"
            className="jm3-segment-group__indicator"
            initial={false}
            animate={{ width: indicator.width, x: indicator.x }}
            transition={JM3_SPRING}
          />
        ) : null}
        {segments.map((seg) => {
          const active = seg.id === activeId;
          return (
            <button
              key={seg.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`jm3-segment-btn ${active ? "jm3-segment-btn--active" : ""}`}
              onClick={() => onChange?.(seg.id)}
            >
              {seg.icon}
              <span>{seg.label}</span>
              {seg.badge != null && seg.badge > 0 ? (
                <span className="opacity-80 tabular-nums">({seg.badge.toLocaleString("he-IL")})</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/**
 * M3 Expressive adaptive toolbar — segmented morph group, icon cluster, split CTA, waveform progress.
 */
export function M3ExpressiveToolbar({
  title,
  subtitle,
  progress,
  segments,
  activeSegmentId,
  onSegmentChange,
  metrics = [],
  iconActions = [],
  splitLabel,
  splitIcon,
  onSplitMain,
  onSplitMenu,
  trailing,
  className = ""
}: M3ExpressiveToolbarProps) {
  return (
    <header className={`jm3-toolbar ${className}`.trim()}>
      {progress != null ? <WaveformProgress value={progress} /> : null}

      <div className="jm3-toolbar__row">
        <div className="jm3-toolbar__title-block">
          <h1 className="jm3-toolbar__title">{title}</h1>
          {subtitle ? <p className="jm3-toolbar__subtitle">{subtitle}</p> : null}
        </div>

        {metrics.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {metrics.map((m) => (
              <span key={m.label} className={metricClass(m.tone)} title={m.label}>
                <span style={{ fontWeight: 500, opacity: 0.85 }}>{m.label}</span>
                {m.value.toLocaleString("he-IL")}
              </span>
            ))}
          </div>
        ) : null}

        {segments && segments.length > 0 ? (
          <SegmentGroup
            segments={segments}
            activeId={activeSegmentId}
            onChange={onSegmentChange}
          />
        ) : null}

        {iconActions.length > 0 ? (
          <div className="jm3-icon-cluster">
            {iconActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={`jm3-icon-btn ${action.primary ? "jm3-icon-btn--primary" : ""}`}
                onClick={action.onClick}
                disabled={action.disabled}
                aria-label={action.label}
                title={action.label}
              >
                {action.icon}
              </button>
            ))}
          </div>
        ) : null}

        {splitLabel && onSplitMain ? (
          <div className="jm3-split-btn">
            <button type="button" className="jm3-split-btn__main" onClick={onSplitMain}>
              {splitIcon}
              {splitLabel}
            </button>
            {onSplitMenu ? (
              <button
                type="button"
                className="jm3-split-btn__chevron"
                onClick={onSplitMenu}
                aria-label="אפשרויות נוספות"
              >
                ▾
              </button>
            ) : null}
          </div>
        ) : null}

        {trailing}
      </div>
    </header>
  );
}

export { JM3_EASE_EMPHASIZED, JM3_SPRING };
