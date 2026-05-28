"use client";

import { categoryLabel } from "@/lib/categories";
import { TRIAGE_ASSIGN_CATEGORIES } from "@/lib/triage";
import { cn } from "@/lib/cn";

interface TriageAssignBarProps {
  disabled?: boolean;
  onAssign: (category: string) => void;
  compact?: boolean;
}

export function TriageAssignBar({ disabled, onAssign, compact }: TriageAssignBarProps) {
  return (
    <div
      className={cn(
        compact ? "border-t border-slate-200/90 pt-2" : "rounded-xl border border-fuchsia-200 bg-fuchsia-50/80 p-3"
      )}
    >
      {!compact ? (
        <p className="mb-2 text-xs font-bold text-fuchsia-950">שליחה לקטגוריה (1–8)</p>
      ) : null}
      <div
        className={cn(
          "grid gap-1",
          compact ? "grid-cols-4 sm:grid-cols-8" : "grid-cols-2 sm:grid-cols-4"
        )}
        role="group"
        aria-label="שיוך קטגוריה"
      >
        {TRIAGE_ASSIGN_CATEGORIES.map((category, i) => (
          <button
            key={category}
            type="button"
            disabled={disabled}
            onClick={() => onAssign(category)}
            className={cn(
              "group flex min-h-8 items-center justify-center gap-1 rounded-lg border font-bold transition active:scale-[0.98] disabled:opacity-50",
              compact
                ? "border-slate-200 bg-white px-1 py-1 text-[10px] text-slate-800 hover:border-indigo-300 hover:bg-indigo-50"
                : "min-h-11 border-fuchsia-200/80 bg-white px-2 py-2 text-xs text-fuchsia-950 hover:border-fuchsia-400 hover:bg-fuchsia-100"
            )}
            title={`${categoryLabel(category)} (${i + 1})`}
          >
            <kbd
              className={cn(
                "rounded px-0.5 font-mono text-[9px] leading-none",
                compact ? "bg-slate-100 text-slate-500" : "bg-fuchsia-100 text-fuchsia-800"
              )}
            >
              {i + 1}
            </kbd>
            <span className="truncate">{categoryLabel(category)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
