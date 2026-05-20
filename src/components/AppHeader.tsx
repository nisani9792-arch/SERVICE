"use client";

import { Mail, RefreshCw, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useOperatorName } from "@/components/AccessGate";
import { JusicLogo } from "@/components/ui/JusicLogo";
import { cn } from "@/lib/cn";
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
    <header className="crm-app-header">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <motion.div
          className="flex min-w-0 items-center gap-3"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl2 border border-white/60 bg-white/50 p-1.5 shadow-glow-sm">
            <JusicLogo size={36} variant="mark" />
          </div>

          <div className="min-w-0">
            <h1 className="flex items-center gap-1.5 text-base font-extrabold tracking-tight text-on-surface md:text-lg">
              <span className="bg-gradient-to-l from-primary via-[#8b7cf8] to-accent bg-clip-text text-transparent">
                JUSIC
              </span>
              <Sparkles className="size-3.5 text-primary/60" aria-hidden />
            </h1>
            <p className="truncate text-[11px] leading-relaxed text-on-surface-variant">
              {operatorName ? (
                <span className="font-medium text-on-surface">מטפל: {operatorName}</span>
              ) : null}
              {operatorName ? " · " : ""}
              <span className={cn(lastSyncedAt ? "crm-badge-sync" : "crm-badge-sync crm-badge-sync-pending")}>
                מייל: {formatSynced(lastSyncedAt)}
              </span>
            </p>
          </div>
        </motion.div>

        <motion.div
          className="flex flex-wrap items-center gap-2 lg:justify-end"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.05 }}
        >
          {actions}
          {onEmailSync ? (
            <motion.button
              type="button"
              onClick={onEmailSync}
              disabled={emailSyncing}
              className="crm-btn"
              title="סנכרן מיילים"
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.02 }}
            >
              <Mail className={cn("size-3.5", emailSyncing && "animate-pulse text-primary")} />
              <span className="hidden sm:inline">{emailSyncing ? "מסנכרן…" : "סנכרן מייל"}</span>
            </motion.button>
          ) : null}
          <motion.button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="crm-btn"
            title="רענון רשימה"
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.02 }}
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin text-primary")} />
            <span className="hidden sm:inline">רענון</span>
          </motion.button>
        </motion.div>
      </div>
    </header>
  );
}
