"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Keyboard, Loader2, RefreshCw } from "lucide-react";
import { QuickReplyBar } from "@/components/QuickReplyBar";
import { TriageCard } from "@/components/TriageCard";
import { useTriageQueue } from "@/hooks/useTriageQueue";
import { TRIAGE_ASSIGN_CATEGORIES } from "@/lib/triage";

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

  const progressPct = total > 0 ? Math.round(((total - remaining + 1) / total) * 100) : 0;

  return (
    <div className="crm-shell flex min-h-screen flex-col">
      <header className="crm-card mb-3 flex flex-wrap items-center gap-3 px-3 py-2.5">
        <Link
          href="/dashboard?view=workbench"
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowRight className="size-4 rotate-180" />
          חזרה ללוח
        </Link>
        <h1 className="text-sm font-bold text-on-surface">מצב סינון מהיר</h1>
        <div className="mr-auto flex items-center gap-2">
          <span className="text-xs text-on-surface-variant">
            {remaining > 0 ? `${remaining} נותרו` : "אין פניות בתור"}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="crm-btn-ghost"
            aria-label="רענון"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </header>

      <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface-container">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${Math.min(100, progressPct)}%` }}
        />
      </div>

      <div className="glass-panel hidden flex-wrap items-center gap-2 px-3 py-2 text-[10px] text-on-surface-variant md:flex">
        <Keyboard className="size-3.5" />
        <span>1–8 קטגוריה · Enter אישור AI · S ספאם · J/K הבא/קודם · R תשובה · רווח דילוג</span>
      </div>

      {error ? (
        <p className="crm-toast crm-toast-error mx-auto mt-3 w-full max-w-xl text-center">{error}</p>
      ) : null}

      <main className="flex flex-1 flex-col justify-center py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : current ? (
          <>
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
            {showReply ? (
              <div className="mx-auto mt-3 w-full max-w-xl">
                <QuickReplyBar
                  ticket={detail ?? current}
                  onSent={() => {
                    setShowReply(false);
                    skip();
                  }}
                  onCancel={() => setShowReply(false)}
                />
              </div>
            ) : null}
          </>
        ) : (
          <div className="crm-card mx-auto max-w-md p-8 text-center">
            <p className="text-sm font-semibold text-on-surface">אין פניות ממתינות לסינון</p>
            <Link href="/dashboard?view=workbench" className="crm-btn-primary mt-4 inline-flex">
              חזרה ללוח עיבוד
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
