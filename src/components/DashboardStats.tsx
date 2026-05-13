"use client";

import { categoryLabel } from "@/lib/categories";
import type { TicketStatus } from "@/lib/types";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Layers, PieChart, Target, Zap } from "lucide-react";

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
  const resolutionPct = total > 0 ? Math.round((closed / total) * 100) : 0;
  const backlogPct = total > 0 ? Math.min(100, Math.round((activePipe / total) * 100)) : 0;
  const healthConic = `conic-gradient(var(--color-accent) ${resolutionPct}%, var(--color-primary) ${resolutionPct}% 100%)`;

  let insight = "";
  let insightTone: "neutral" | "warn" | "good" = "neutral";
  if (total === 0) {
    insight = "מערכת ריקה — מוכנים לייבוא או ליצירת פנייה ראשונה.";
    insightTone = "neutral";
  } else if (activePipe > total * 0.45) {
    insight = "נפח גבוה בתורים הפתוחים — שקלו לסנן ״בטיפול״ ולתעדף לפי תגיות.";
    insightTone = "warn";
  } else if (resolutionPct >= 55) {
    insight = "שיעור סגירה טוב — המשיכו לתחזק קטגוריות חוזרות עם תבניות תשובה.";
    insightTone = "good";
  } else {
    insight = "מאזן פעילות תקין — עקבו אחרי קטגוריות עם עלייה חדה בשבוע האחרון.";
    insightTone = "neutral";
  }

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
        className={`crm-bento-card group flex flex-col rounded-2xl border p-4 text-right transition ${
          active
            ? "border-primary/50 bg-gradient-to-br from-primary-soft/90 to-white shadow-md ring-2 ring-primary/20"
            : "border-outline/70 bg-surface-high/90 hover:border-primary/30 hover:shadow-soft"
        }`}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <Icon
            className={`size-5 shrink-0 ${active ? "text-primary" : "text-on-surface-variant group-hover:text-primary"}`}
          />
          <span className="text-2xl font-bold tabular-nums tracking-tight text-on-surface md:text-3xl">
            {value.toLocaleString("he-IL")}
          </span>
        </div>
        <span className="text-sm font-semibold text-on-surface">{label}</span>
        <span className="mt-1 text-xs leading-snug text-on-surface-variant">{hint}</span>
      </button>
    );
  };

  return (
    <section className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-8">
          {taskCard("all", "כלל הפניות", total, "תמונת מצב מלאה", Layers)}
          {taskCard("open", "פתוחות", open, "דורשות תגובה או הקצאה", Zap)}
          {taskCard("in_progress", "בטיפול", progress, "בעבודה פעילה", Target)}
          {taskCard("closed", "סגורות", closed, "טופלו או בארכיון", CheckCircle2)}
        </div>

        <div className="lux-card flex flex-col justify-between gap-4 rounded-2xl border border-outline/60 bg-surface-high/95 p-5 lg:col-span-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                מד ציון תפעול
              </p>
              <p className="mt-1 text-sm text-on-surface">שיעור סגירה מהמאגר</p>
            </div>
            <PieChart className="size-6 text-accent" aria-hidden />
          </div>
          <div className="flex items-center gap-4">
            <div
              className="crm-donut shrink-0"
              style={{ background: healthConic }}
              role="img"
              aria-label={`שיעור סגירה ${resolutionPct} אחוז`}
            >
              <div className="crm-donut-inner flex flex-col items-center justify-center">
                <span className="text-lg font-bold tabular-nums text-on-surface">{resolutionPct}%</span>
                <span className="text-[10px] font-medium text-on-surface-variant">סגירה</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2 text-xs">
              <div>
                <div className="mb-1 flex justify-between text-on-surface-variant">
                  <span>עומס פתוח + בטיפול</span>
                  <span className="tabular-nums font-medium text-on-surface">
                    {activePipe.toLocaleString("he-IL")}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-primary to-accent transition-all"
                    style={{ width: `${backlogPct}%` }}
                  />
                </div>
              </div>
              <div
                className={`rounded-xl px-3 py-2 leading-snug ${
                  insightTone === "warn"
                    ? "bg-warning/10 text-amber-950"
                    : insightTone === "good"
                      ? "bg-success/10 text-emerald-950"
                      : "bg-surface-container text-on-surface-variant"
                }`}
              >
                <span className="inline-flex items-start gap-2">
                  {insightTone === "warn" ? (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  ) : null}
                  {insight}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lux-card rounded-2xl border border-outline/65 bg-surface-high/95 p-5 lg:col-span-7">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            פיזור קטגוריות (נפח יחסי)
          </p>
          {top.length === 0 ? (
            <p className="text-sm text-on-surface-variant">אין נתונים להצגה — הוסיפו פניות כדי לראות התפלגות.</p>
          ) : (
            <ul className="space-y-3">
              {top.map((c) => (
                <li key={c.category}>
                  <div className="mb-1 flex justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-on-surface">{categoryLabel(c.category)}</span>
                    <span className="shrink-0 tabular-nums text-on-surface-variant">
                      {c.count.toLocaleString("he-IL")}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                    <div
                      className="h-full max-w-full rounded-full bg-gradient-to-l from-primary/90 via-primary to-accent/80"
                      style={{ width: `${Math.max(8, (c.count / maxCat) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lux-card flex flex-col justify-center gap-3 rounded-2xl border border-outline/65 bg-gradient-to-br from-primary-soft/50 via-surface-high to-accent-soft/40 p-5 lg:col-span-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            סיגנל איכות
          </p>
          <p className="text-4xl font-bold tabular-nums text-primary md:text-5xl">
            {spam.toLocaleString("he-IL", { maximumFractionDigits: 1 })}%
          </p>
          <p className="text-sm text-on-surface">
            מהפניות מסווגות כ<strong className="text-on-surface"> ספאם / שיווק (PR)</strong> — אחוז נמוך יותר
            מצביע על זרימת שירות נקייה יותר.
          </p>
          <p className="text-xs text-on-surface-variant">
            {(stats?.spamCount ?? 0).toLocaleString("he-IL")} רשומות מתוך{" "}
            {total.toLocaleString("he-IL")} בסך הכל
          </p>
        </div>
      </div>
    </section>
  );
}
