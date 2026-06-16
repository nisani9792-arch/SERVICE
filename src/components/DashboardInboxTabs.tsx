"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

export type InboxTabId =
  | "active"
  | "triage"
  | "followup"
  | "in_progress"
  | "outbox"
  | "closed";

export type DashboardInboxTabsProps = {
  activeTab: InboxTabId;
  counts: {
    active: number;
    triage: number;
    followup: number;
    inProgress: number;
    outbox: number;
    closed: number;
    triageAiHint?: number;
  };
  onTabChange: (tab: InboxTabId) => void;
  compact?: boolean;
};

const TABS: Array<{ id: InboxTabId; label: string }> = [
  { id: "active", label: "פעילות" },
  { id: "triage", label: "סינון" },
  { id: "followup", label: "חוזרות" },
  { id: "in_progress", label: "בטיפול" },
  { id: "outbox", label: "יוצא" },
  { id: "closed", label: "ארכיון" }
];

export function DashboardInboxTabs({ activeTab, counts, onTabChange, compact }: DashboardInboxTabsProps) {
  const countFor = (id: InboxTabId): number => {
    switch (id) {
      case "active":
        return counts.active;
      case "triage":
        return counts.triage;
      case "followup":
        return counts.followup;
      case "in_progress":
        return counts.inProgress;
      case "outbox":
        return counts.outbox;
      case "closed":
        return counts.closed;
      default:
        return 0;
    }
  };

  return (
    <div className={compact ? "min-w-0" : "space-y-2"}>
      <div
        className="flex gap-0.5 overflow-x-auto"
        role="tablist"
        aria-label="סינון פניות"
      >
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          const n = countFor(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "crm-touch-target shrink-0 rounded-jm3-md px-2 py-1 text-[10px] font-bold leading-tight transition",
                selected
                  ? "bg-primary text-white shadow-jm3-1"
                  : "text-on-surface-variant hover:bg-surface-high",
                tab.id === "followup" && !selected && n > 0 && "bg-warning/10 text-warning"
              )}
            >
              {tab.label}
              <span className={cn("ms-1 tabular-nums", selected ? "opacity-90" : "opacity-70")}>
                {n.toLocaleString("he-IL")}
              </span>
            </button>
          );
        })}
      </div>

      {!compact && activeTab === "triage" ? (
        <Link
          href="/dashboard?view=triage"
          className="inline-block rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-2 py-1 text-[10px] font-bold text-fuchsia-900"
        >
          מצב סינון מהיר
        </Link>
      ) : null}
    </div>
  );
}
