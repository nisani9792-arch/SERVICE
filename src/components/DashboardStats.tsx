"use client";

import { categoryLabel } from "@/lib/categories";
import type { TicketStatus } from "@/lib/types";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Inbox, Layers, Target, Zap } from "lucide-react";

export type DashboardStatsModel = {
  total: number;
  byCategory: { category: string; count: number }[];
  statusCounts: { open: number; in_progress: number; closed: number };
  openClosedRatio: { open: number; closed: number };
  spamPercent: number;
  spamCount: number;
};

interface DashboardStatsProps {
  stats: DashboardStatsModel | null;
  activeStatus: TicketStatus | "all";
  onStatusFilter: (s: TicketStatus | "all") => void;
}

export function DashboardStats({ stats, activeStatus, onStatusFilter }: DashboardStatsProps) {
  const total = stats?.total ?? 0;
  const open = stats?.statusCounts.open ?? 0;
  const progress = stats?.statusCounts.in_progress ?? 0;
  const closed = stats?.statusCounts.closed ?? 0;
  const spam = stats?.spamPercent ?? 0;
  const top = stats?.byCategory.slice(0, 6) ?? [];

  const activePipe = open + progress;
  const maxCat = top.length ? Math.max(...top.map((c) => c.count), 1) : 1;

  const taskCard = (
    id: TicketStatus | "all",
    label: string,
    value: number,
    hint: string,
    Icon: LucideIcon
  ) => {
    const active = activeStatus === id;
    return (
      <button
        type="button"
        onClick={() => onStatusFilter(id)}
        className={`group flex min-h-20 flex-col rounded-xl border p-3 text-right transition ${
          active
            ? "border-primary/50 bg-primary-soft/80 ring-1 ring-primary/20"
            : "border-outline/70 bg-surface-high/90 hover:border-primary/30"
        }`}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <Icon
            className={`size-4 shrink-0 ${active ? "text-primary" : "text-on-surface-variant group-hover:text-primary"}`}
          />
          <span className="text-xl font-bold tabular-nums tracking-tight text-on-surface">
            {value.toLocaleString("he-IL")}
          </span>
        </div>
        <span className="text-xs font-semibold text-on-surface">{label}</span>
        <span className="mt-0.5 text-[11px] leading-snug text-on-surface-variant">{hint}</span>
      </button>
    );
  };

  return (
    <section className="grid gap-2 xl:grid-cols-[minmax(0,1fr),24rem]">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {taskCard("all", "כלל הפניות", total, "תמונת מצב מלאה", Layers)}
          {taskCard("open", "פתוחות", open, "דורשות תגובה או הקצאה", Zap)}
          {taskCard("in_progress", "בטיפול", progress, "בעבודה פעילה", Target)}
          {taskCard("closed", "סגורות", closed, "טופלו או בארכיון", CheckCircle2)}
        </div>

      <div className="rounded-xl border border-outline/65 bg-surface-high/95 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-on-surface">מבט קטגוריות</p>
          <span className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant">
            <Inbox className="size-3" />
            ספאם {spam.toLocaleString("he-IL", { maximumFractionDigits: 1 })}%
          </span>
        </div>
        {top.length === 0 ? (
          <p className="text-xs text-on-surface-variant">אין נתונים להצגה.</p>
        ) : (
          <ul className="space-y-1.5">
            {top.map((c) => (
              <li key={c.category}>
                <div className="mb-0.5 flex justify-between gap-2 text-[11px]">
                  <span className="truncate font-medium text-on-surface">{categoryLabel(c.category)}</span>
                  <span className="shrink-0 tabular-nums text-on-surface-variant">
                    {c.count.toLocaleString("he-IL")}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-container">
                  <div
                    className="h-full max-w-full rounded-full bg-primary"
                    style={{ width: `${Math.max(8, (c.count / maxCat) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-on-surface-variant">
          עומס פתוח + בטיפול: {activePipe.toLocaleString("he-IL")}
        </p>
      </div>
    </section>
  );
}
