"use client";

import Image from "next/image";
import { Mail, RefreshCw } from "lucide-react";
import { useOperatorName } from "@/components/AccessGate";
import { APP_LOGO_SRC } from "@/lib/brand";
import type { ReactNode } from "react";

interface AppHeaderProps {
  actions: ReactNode;
  onRefresh: () => void;
  onEmailSync?: () => void;
  emailSyncing?: boolean;
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

export function AppHeader({
  actions,
  onRefresh,
  onEmailSync,
  emailSyncing = false,
  refreshing,
  lastSyncedAt
}: AppHeaderProps) {
  const operatorName = useOperatorName();

  return (
    <header className="crm-app-header sticky top-[max(0.35rem,env(safe-area-inset-top))] z-30">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative size-11 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <Image
              src={APP_LOGO_SRC}
              alt="Jusic"
              fill
              sizes="44px"
              className="object-contain"
              priority
              unoptimized
            />
          </div>

          <div className="min-w-0">
            <h1 className="text-base font-black tracking-tight text-slate-900 md:text-lg">SERVICE</h1>
            <p className="truncate text-[11px] text-slate-500">
              {operatorName ? `מטפל: ${operatorName} · ` : ""}
              <span className={lastSyncedAt ? "crm-badge-sync" : "crm-badge-sync crm-badge-sync-pending"}>
                מייל: {formatSynced(lastSyncedAt)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {actions}
          {onEmailSync ? (
            <button
              type="button"
              onClick={onEmailSync}
              disabled={emailSyncing}
              className="crm-btn"
              title="סנכרן מיילים"
            >
              <Mail className={`size-3.5 ${emailSyncing ? "animate-pulse" : ""}`} />
              <span className="hidden sm:inline">{emailSyncing ? "מסנכרן…" : "סנכרן מייל"}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="crm-btn"
            title="רענון רשימה"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">רענון</span>
          </button>
        </div>
      </div>
    </header>
  );
}
