"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Keyboard, Loader2 } from "lucide-react";
import { CrmWorkspaceHeader } from "@/components/crm/CrmWorkspaceHeader";
import { QuickReplyBar } from "@/components/QuickReplyBar";
import { TriageCard } from "@/components/TriageCard";
import { useTriageQueue } from "@/hooks/useTriageQueue";
import { TRIAGE_ASSIGN_CATEGORIES } from "@/lib/triage";

const KEY_HINTS = [
  "1–8 קטגוריה",
  "Enter אישור AI",
  "S ספאם",
  "J/K הבא·קודם",
  "R מענה",
  "רווח דילוג"
];

export function TriageMode() {
  const {
    current,
    detail,
    loading,
    error,
    busy,
    total,
    remaining,
    assignCategory,
    approveSuggestion,
    markSpam,
    skip,
    goPrev,
    goNext,
    refresh
  } = useTriageQueue();

  const [showReply, setShowReply] = useState(false);

  useEffect(() => {
    setShowReply(false);
  }, [current?.id]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!current || busy) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "TEXTAREA" || target?.tagName === "INPUT") return;

      const num = parseInt(event.key, 10);
      if (num >= 1 && num <= TRIAGE_ASSIGN_CATEGORIES.length) {
        event.preventDefault();
        void assignCategory(TRIAGE_ASSIGN_CATEGORIES[num - 1]);
        return;
      }

      switch (event.key) {
        case "Enter":
        case "ArrowRight":
          event.preventDefault();
          if (current.aiSuggestedCategory) void approveSuggestion();
          break;
        case "s":
        case "S":
          event.preventDefault();
          void markSpam();
          break;
        case "j":
        case "J":
          event.preventDefault();
          goNext();
          break;
        case "k":
        case "K":
          event.preventDefault();
          goPrev();
          break;
        case "r":
        case "R":
          event.preventDefault();
          setShowReply(true);
          break;
        case " ":
          event.preventDefault();
          skip();
          break;
        default:
          break;
      }
    },
    [approveSuggestion, assignCategory, busy, current, goNext, goPrev, markSpam, skip]
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  const done = total > 0 ? total - remaining : 0;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="crm-inbox-page flex min-h-0 flex-1 flex-col">
      <CrmWorkspaceHeader
        title="סינון מהיר"
        subtitle={remaining > 0 ? `${remaining} פניות בתור · ${done}/${total} טופלו` : "אין פניות ממתינות"}
        metrics={[
          { label: "בתור", value: remaining, accent: "primary" },
          { label: "סה״כ", value: total, accent: "muted" }
        ]}
        onRefresh={() => void refresh()}
        refreshing={loading}
        actions={
          <Link
            href="/dashboard?view=workbench"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
          >
            <ArrowRight className="size-3 rotate-180" />
            לוח עיבוד
          </Link>
        }
      />

      <div className="h-1 shrink-0 bg-slate-200">
        <div
          className="h-full bg-indigo-600 transition-all duration-300"
          style={{ width: `${Math.min(100, progressPct)}%` }}
        />
      </div>

      <div className="crm-inbox-toolbar hidden shrink-0 flex-wrap items-center gap-2 sm:flex">
        <Keyboard className="size-3.5 text-slate-400" aria-hidden />
        {KEY_HINTS.map((hint) => (
          <span
            key={hint}
            className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-600"
          >
            {hint}
          </span>
        ))}
      </div>

      {error ? (
        <p className="shrink-0 bg-rose-50 px-3 py-2 text-center text-xs text-rose-800">{error}</p>
      ) : null}

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden py-2">
        {loading && !current ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-indigo-600" />
          </div>
        ) : current ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <TriageCard
                ticket={current}
                detail={detail}
                busy={busy}
                onApprove={() => void approveSuggestion()}
                onSpam={() => void markSpam()}
                onSkip={skip}
                onReplyOpen={() => setShowReply(true)}
                onAssign={(cat) => void assignCategory(cat)}
              />
            </div>
            {showReply ? (
              <div className="shrink-0 border-t border-slate-200">
                <QuickReplyBar
                  ticket={detail ?? current}
                  variant="workbench"
                  onSent={() => {
                    setShowReply(false);
                    skip();
                  }}
                  onCancel={() => setShowReply(false)}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="m-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-800">אין פניות ממתינות לסינון</p>
            <Link
              href="/dashboard?view=workbench"
              className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
            >
              חזרה ללוח עיבוד
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
