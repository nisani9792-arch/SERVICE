"use client";

import Image from "next/image";
import { Activity, RefreshCw, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

interface AppHeaderProps {
  actions: ReactNode;
  onRefresh: () => void;
  refreshing: boolean;
  lastSyncedAt: Date | null;
}

function formatSynced(d: Date | null): string {
  if (!d) return "מסנכרן…";
  return d.toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function AppHeader({ actions, onRefresh, refreshing, lastSyncedAt }: AppHeaderProps) {
  return (
    <header className="crm-app-header relative overflow-hidden rounded-2xl border border-white/25 bg-surface-high/70 shadow-card backdrop-blur-xl">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        aria-hidden
        style={{
          background:
            "radial-gradient(120% 80% at 100% 0%, rgba(90, 90, 201, 0.18) 0%, transparent 55%), radial-gradient(90% 70% at 0% 100%, rgba(13, 148, 136, 0.12) 0%, transparent 50%), linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,247,251,0.85) 100%)"
        }}
      />
      <div className="relative z-10 flex flex-col gap-2 p-2.5 md:flex-row md:items-center md:justify-between md:p-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="brand-logo-aura mx-auto scale-75 shrink-0 sm:mx-0">
            <div className="brand-logo-inner">
              <span className="relative z-10 block aspect-square w-full">
                <Image
                  src="/jusic-logo.png"
                  alt="Jusic"
                  fill
                  sizes="96px"
                  className="object-contain drop-shadow-sm"
                  priority
                  unoptimized
                />
              </span>
            </div>
          </div>

          <div className="min-w-0 text-center sm:text-right">
            <div className="mb-0.5 inline-flex items-center gap-1.5 rounded-full border border-outline/50 bg-white/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-on-surface-variant shadow-sm backdrop-blur-sm">
              <Sparkles className="size-3 text-accent" aria-hidden />
              <span>מרכז פיקוד חכם</span>
            </div>
            <h1 className="crm-display-title text-balance bg-gradient-to-l from-on-surface via-primary to-accent bg-clip-text text-lg font-bold tracking-tight text-transparent md:text-xl">
              SERVICE
            </h1>
            <p className="mt-0.5 max-w-xl text-[11px] leading-snug text-on-surface-variant md:text-xs">
              שולחן עבודה קומפקטי למיון וטיפול בפניות Jusic.
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-on-surface-variant sm:justify-start">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 font-medium text-success">
                <span className="relative flex size-2">
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
                מחובר לסביבת העבודה
              </span>
              <span className="inline-flex items-center gap-1 text-on-surface-variant/90">
                <Activity className="size-3.5 opacity-70" aria-hidden />
                עודכן לאחרונה: {formatSynced(lastSyncedAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">{actions}</div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="crm-refresh-btn inline-flex items-center justify-center gap-2 rounded-xl border border-outline/70 bg-white/80 px-3 py-1.5 text-xs font-medium text-on-surface shadow-soft backdrop-blur-sm transition enabled:hover:border-primary/35 enabled:hover:bg-primary-soft/40 disabled:cursor-not-allowed disabled:opacity-55 sm:self-end"
          >
            <RefreshCw className={`size-4 text-primary ${refreshing ? "animate-spin" : ""}`} />
            רענן דשבורד ונתונים
          </button>
        </div>
      </div>
    </header>
  );
}
