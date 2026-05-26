"use client";

import Link from "next/link";

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
};

const TABS: Array<{
  id: InboxTabId;
  label: string;
  hint: string;
}> = [
  { id: "active", label: "פעילות", hint: "פתוחות ובטיפול" },
  { id: "triage", label: "סינון", hint: "חדשות ממייל" },
  { id: "followup", label: "תשובות חוזרות", hint: "לקוח חזר" },
  { id: "in_progress", label: "בטיפול", hint: "במעקב" },
  { id: "outbox", label: "דואר יוצא", hint: "נענו ונסגרו" },
  { id: "closed", label: "ארכיון", hint: "כל הסגורות" }
];

export function DashboardInboxTabs({ activeTab, counts, onTabChange }: DashboardInboxTabsProps) {
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
    <div className="space-y-2">
      <div
        className="flex gap-1 overflow-x-auto pb-0.5"
        role="tablist"
        aria-label="סינון פניות"
      >
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTabChange(tab.id)}
              className={`min-w-[5.5rem] shrink-0 rounded-xl border px-2.5 py-2 text-right transition ${
                selected
                  ? "border-primary bg-primary text-white shadow-soft"
                  : "border-outline/80 bg-white text-on-surface hover:border-primary/30"
              }`}
            >
              <span className="block text-[11px] font-bold leading-tight">{tab.label}</span>
              <span className={`mt-0.5 block text-[10px] ${selected ? "opacity-90" : "text-on-surface-variant"}`}>
                {countFor(tab.id).toLocaleString("he-IL")}
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === "triage" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] text-on-surface-variant">
            {TABS.find((t) => t.id === "triage")?.hint} — {counts.triage.toLocaleString("he-IL")} פניות
          </p>
          <Link
            href="/dashboard?view=triage"
            className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-2 py-1 text-[10px] font-bold text-fuchsia-900 hover:bg-fuchsia-100"
          >
            מצב סינון מהיר
            {counts.triageAiHint != null ? ` (${counts.triageAiHint} עם AI)` : ""}
          </Link>
        </div>
      ) : activeTab === "outbox" ? (
        <p className="text-[11px] text-on-surface-variant">
          מעקב אחרי פניות שנענו ונסגרו — ממוין לפי תאריך טיפול אחרון
        </p>
      ) : null}
    </div>
  );
}
