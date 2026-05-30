"use client";

import { MailCheck, Plus, RefreshCw } from "lucide-react";
import { M3ExpressiveToolbar } from "@/design-system/react/M3ExpressiveToolbar";
import type { M3ToolbarMetric } from "@/design-system/react/M3ExpressiveToolbar";

export type CrmWorkspaceHeaderProps = {
  title: string;
  subtitle?: string;
  metrics?: Array<{ label: string; value: number; accent?: "primary" | "amber" | "muted" }>;
  /** 0–100 queue progress for waveform strip */
  progress?: number;
  onRefresh?: () => void;
  onEmailSync?: () => void;
  onNewTicket?: () => void;
  refreshing?: boolean;
  emailSyncing?: boolean;
  lastSyncedAt?: Date | null;
  actions?: React.ReactNode;
};

function mapMetrics(
  metrics: CrmWorkspaceHeaderProps["metrics"]
): M3ToolbarMetric[] | undefined {
  return metrics?.map((m) => ({
    label: m.label,
    value: m.value,
    tone: m.accent
  }));
}

export function CrmWorkspaceHeader({
  title,
  subtitle,
  metrics = [],
  progress,
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

  const iconActions = [
    ...(onRefresh
      ? [
          {
            id: "refresh",
            label: "רענן",
            icon: <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />,
            onClick: onRefresh,
            disabled: refreshing
          }
        ]
      : []),
    ...(onEmailSync
      ? [
          {
            id: "sync",
            label: "סנכרן מיילים",
            icon: <MailCheck className={`size-3.5 ${emailSyncing ? "animate-pulse" : ""}`} />,
            onClick: onEmailSync,
            disabled: emailSyncing
          }
        ]
      : []),
    ...(onNewTicket
      ? [
          {
            id: "new",
            label: "פנייה חדשה",
            icon: <Plus className="size-3.5" />,
            onClick: onNewTicket,
            primary: true
          }
        ]
      : [])
  ];

  const subtitleWithSync =
    [subtitle, syncLabel ? `עודכן ${syncLabel}` : null].filter(Boolean).join(" · ") || undefined;

  return (
    <M3ExpressiveToolbar
      title={title}
      subtitle={subtitleWithSync}
      progress={progress}
      metrics={mapMetrics(metrics)}
      iconActions={iconActions}
      trailing={actions}
      className="crm-workspace-header"
    />
  );
}
