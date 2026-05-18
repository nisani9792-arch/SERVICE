"use client";

export interface BatchProgressBarProps {
  visible: boolean;
  label: string;
  processed: number;
  total: number;
  progress: number;
}

export function BatchProgressBar({
  visible,
  label,
  processed,
  total,
  progress
}: BatchProgressBarProps) {
  if (!visible) return null;

  const pct = Math.min(100, Math.max(0, progress));

  return (
    <div
      className="crm-batch-progress fixed inset-x-3 bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+3.5rem))] z-40 rounded-2xl border border-primary/25 bg-white/95 p-3 shadow-lg backdrop-blur-sm md:inset-x-auto md:right-4 md:w-80"
      role="status"
      aria-live="polite"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-on-surface">
        <span>{label}</span>
        <span className="tabular-nums text-primary">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-container">
        <div
          className="h-full rounded-full bg-gradient-to-l from-primary to-primary/70 transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-on-surface-variant">
        {processed.toLocaleString("he-IL")} / {total.toLocaleString("he-IL")} פניות
      </p>
    </div>
  );
}
