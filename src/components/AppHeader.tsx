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
    <header className="crm-app-header relative overflow-hidden rounded-3xl border border-white/25 bg-surface-high/70 shadow-card backdrop-blur-xl">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        aria-hidden
        style={{
          background:
            "radial-gradient(120% 80% at 100% 0%, rgba(90, 90, 201, 0.18) 0%, transparent 55%), radial-gradient(90% 70% at 0% 100%, rgba(13, 148, 136, 0.12) 0%, transparent 50%), linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,247,251,0.85) 100%)"
        }}
      />
      <div className="relative z-10 flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-7">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
          <div className="brand-logo-aura shrink-0">
            <div className="brand-logo-inner">
              <Image
                src="/jusic-logo.svg"
                width={34}
                height={34}
                alt="Jusic"
                className="relative z-10 drop-shadow-sm"
                unoptimized
              />
            </div>
          </div>

          <div className="min-w-0 text-right">
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-outline/50 bg-white/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant shadow-sm backdrop-blur-sm">
              <Sparkles className="size-3 text-accent" aria-hidden />
              <span>מרכז פיקוד חכם</span>
            </div>
            <h1 className="crm-display-title text-balance bg-gradient-to-l from-on-surface via-primary to-accent bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl">
              Jusic Nexus
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-on-surface-variant md:text-[0.95rem]">
              ניהול פניות, סיווג ותפעול בשיטה אחת — ממשק שנבנה כדי להקטין רעש, להגדיל בהירות
              ולזרז החלטות בזמן אמת.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 font-medium text-success">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/40 opacity-60" />
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

        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="crm-refresh-btn inline-flex items-center justify-center gap-2 self-end rounded-2xl border border-outline/70 bg-white/80 px-4 py-2.5 text-sm font-medium text-on-surface shadow-soft backdrop-blur-sm transition enabled:hover:border-primary/35 enabled:hover:bg-primary-soft/40 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <RefreshCw className={`size-4 text-primary ${refreshing ? "animate-spin" : ""}`} />
            רענן דשבורד ונתונים
          </button>
        </div>
      </div>
    </header>
  );
}
