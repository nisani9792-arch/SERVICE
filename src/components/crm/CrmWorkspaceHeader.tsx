"use client";

import { MailCheck, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";

export type CrmWorkspaceHeaderProps = {
  title: string;
  subtitle?: string;
  metrics?: Array<{ label: string; value: number; accent?: "primary" | "amber" | "muted" }>;
  onRefresh?: () => void;
  onEmailSync?: () => void;
  onNewTicket?: () => void;
  refreshing?: boolean;
  emailSyncing?: boolean;
  lastSyncedAt?: Date | null;
  actions?: React.ReactNode;
};

export function CrmWorkspaceHeader({
  title,
  subtitle,
  metrics = [],
  onRefresh,
  onEmailSync,
  onNewTicket,
  refreshing,
  emailSyncing,
  lastSyncedAt,
  actions
}: CrmWorkspaceHeaderProps) {
  const syncLabel = lastSyncedAt
    ? lastSyncedAt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <header className="crm-workspace-header shrink-0 border-b border-slate-200/90 bg-white/95 px-3 py-2 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle ? (
            <p className="truncate text-[10px] font-medium text-slate-500">{subtitle}</p>
          ) : null}
        </div>

        {metrics.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {metrics.map((m) => (
              <span
                key={m.label}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold tabular-nums",
                  m.accent === "amber"
                    ? "border-amber-200/80 bg-amber-50 text-amber-950"
                    : m.accent === "primary"
                      ? "border-indigo-200/80 bg-indigo-50 text-indigo-800"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                )}
                title={m.label}
              >
                <span className="font-medium opacity-80">{m.label}</span>
                {m.value.toLocaleString("he-IL")}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-1">
          {syncLabel ? (
            <span className="hidden text-[10px] text-slate-400 sm:inline">עודכן {syncLabel}</span>
          ) : null}
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="crm-icon-btn"
              aria-label="רענן"
            >
              <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            </button>
          ) : null}
          {onEmailSync ? (
            <button
              type="button"
              onClick={onEmailSync}
              disabled={emailSyncing}
              className="crm-icon-btn"
              aria-label="סנכרן מיילים"
            >
              <MailCheck className={cn("size-3.5", emailSyncing && "animate-pulse")} />
            </button>
          ) : null}
          {onNewTicket ? (
            <button type="button" onClick={onNewTicket} className="crm-icon-btn-primary" aria-label="פנייה חדשה">
              <Plus className="size-3.5" />
            </button>
          ) : null}
          {actions}
        </div>
      </div>
    </header>
  );
}
