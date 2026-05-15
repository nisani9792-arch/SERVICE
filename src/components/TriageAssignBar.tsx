"use client";

import { categoryLabel } from "@/lib/categories";
import { TRIAGE_ASSIGN_CATEGORIES } from "@/lib/triage";

interface TriageAssignBarProps {
  disabled?: boolean;
  onAssign: (category: string) => void;
}

export function TriageAssignBar({ disabled, onAssign }: TriageAssignBarProps) {
  return (
    <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/80 p-3">
      <p className="mb-2 text-xs font-bold text-fuchsia-950">שליחה לקטגוריה (לחיצה אחת)</p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {TRIAGE_ASSIGN_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            disabled={disabled}
            onClick={() => onAssign(category)}
            className="rounded-lg border border-fuchsia-200/80 bg-white px-2 py-2 text-[11px] font-bold text-fuchsia-950 transition hover:border-fuchsia-400 hover:bg-fuchsia-100 disabled:opacity-50"
          >
            {categoryLabel(category)}
          </button>
        ))}
      </div>
    </div>
  );
}
