"use client";

import Image from "next/image";
import { RefreshCw } from "lucide-react";
import { useOperatorName } from "@/components/AccessGate";
import { APP_LOGO_SRC } from "@/lib/brand";
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
  const operatorName = useOperatorName();

  return (
    <header className="crm-app-header sticky top-[max(0.5rem,env(safe-area-inset-top))] z-30 rounded-2xl border border-outline/70 bg-white px-3 py-2">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-xl border border-outline bg-white">
            <Image
              src={APP_LOGO_SRC}
              alt="Jusic"
              fill
              sizes="40px"
              className="object-contain"
              priority
              unoptimized
            />
          </div>

          <div className="min-w-0">
            <h1 className="text-base font-black leading-tight text-on-surface md:text-lg">SERVICE</h1>
            <p className="truncate text-[11px] text-on-surface-variant">
              CRM פניות מסודר
              {operatorName ? ` · גורם מטפל: ${operatorName}` : ""}
              {" · עודכן: "}
              {formatSynced(lastSyncedAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {actions}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-outline bg-white px-3 py-1.5 text-xs font-semibold text-on-surface transition enabled:hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-55"
          >
            <RefreshCw className={`size-3.5 text-primary ${refreshing ? "animate-spin" : ""}`} />
            רענון
          </button>
        </div>
      </div>
    </header>
  );
}
