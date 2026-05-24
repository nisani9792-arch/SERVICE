"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { AnimatePresence } from "framer-motion";
import { Layers, Loader2 } from "lucide-react";
import { FocusActionBar } from "@/components/crm/FocusActionBar";
import { FocusTriageCard } from "@/components/triage/FocusTriageCard";
import { TriageActionToast } from "@/components/triage/TriageActionToast";
import { ReplyTicketModal } from "@/components/ReplyTicketModal";
import { MobileDock } from "@/components/MobileDock";
import { useTriageActions, type TriageUndoState } from "@/hooks/useTriageActions";
import { useUnifiedTriageQueue } from "@/hooks/useUnifiedTriageQueue";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { sendTicketReply } from "@/lib/firebase";
import type { TriageQueueKey } from "@/lib/ticket-bucket-view";
import { BUCKET_LABELS, type TicketBucket } from "@/lib/ticket-buckets";
import type { Ticket } from "@/lib/types";

const QUEUE_CHIPS: Array<{ key: TriageQueueKey; label: string }> = [
  { key: "active", label: "פעילות" },
  { key: "triage", label: "סינון" },
  { key: "handled", label: "טופלו" },
  { key: "spam", label: "ספאם" },
  { key: "outbox", label: "יוצא" }
];

function parseQueue(raw: string | null): TriageQueueKey {
  const v = (raw ?? "active").toLowerCase();
  if (["active", "triage", "handled", "spam", "outbox", "deleted", "all"].includes(v)) {
    return v as TriageQueueKey;
  }
  if (raw && raw in BUCKET_LABELS) return raw as TicketBucket;
  return "active";
}

/**
 * Mobile Focus Engine — card stack for fast review.
 * Full inbox management stays on /dashboard/inbox; dock links back.
 */
export function MobileFocusEngine() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queue = useMemo(
    () => parseQueue(searchParams.get("queue")),
    [searchParams]
  );

  const { stats } = useDashboardStats();
  const triageCount = stats?.pendingTriageCount ?? 0;

  const {
    current,
    nextCards,
    detail,
    total,
    remaining,
    bucketCounts,
    loading,
    error,
    index,
    reload,
    advanceOptimistic,
    restoreTicket
  } = useUnifiedTriageQueue(queue);

  const [replying, setReplying] = useState<Ticket | null>(null);
  const [toast, setToast] = useState<{ message: string; undo?: TriageUndoState } | null>(
    null
  );

  const onToast = useCallback((payload: { message: string; undo?: TriageUndoState }) => {
    setToast(payload);
  }, []);

  const { busy, handleArchive, handleDelete, handleSpam, handleUndo } = useTriageActions({
    current,
    index,
    advanceOptimistic,
    restoreTicket,
    onToast
  });

  const queueLabel =
    queue === "triage"
      ? "ממתין לסינון"
      : queue in BUCKET_LABELS
        ? BUCKET_LABELS[queue as TicketBucket]
        : queue;

  const countForQueue = (key: string) =>
    bucketCounts[key] != null ? bucketCounts[key].toLocaleString("he-IL") : "—";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-surface via-surface to-surface-container pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <div className="shrink-0 space-y-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={"/dashboard/inbox" as Route}
            className="inline-flex items-center gap-1 rounded-lg border border-outline/60 bg-white/80 px-2.5 py-1.5 text-[11px] font-bold text-primary"
          >
            <Layers className="size-3.5" />
            לוח עיבוד
          </Link>
          <Link
            href={"/triage" as Route}
            className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1.5 text-[11px] font-bold text-fuchsia-900"
          >
            סינון מהיר
            {triageCount > 0 ? ` (${triageCount})` : ""}
          </Link>
        </div>

        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
            מצב סריקה
          </p>
          <p className="text-xs font-bold text-on-surface">{queueLabel}</p>
          <p className="text-[10px] tabular-nums text-on-surface-variant">
            {remaining.toLocaleString("he-IL")} נותרו · {total.toLocaleString("he-IL")} בתור
          </p>
        </div>

        <div
          className="flex gap-1 overflow-x-auto pb-0.5"
          role="tablist"
          aria-label="תור סריקה"
        >
          {QUEUE_CHIPS.map((chip) => {
            const selected = queue === chip.key;
            return (
              <Link
                key={chip.key}
                href={`/mobile/triage?queue=${chip.key}` as Route}
                role="tab"
                aria-selected={selected}
                className={`min-w-[4.5rem] shrink-0 rounded-xl border px-2 py-1.5 text-center text-[10px] font-bold transition ${
                  selected
                    ? "border-primary bg-primary text-white"
                    : "border-outline/70 bg-white/90 text-on-surface"
                }`}
              >
                <span className="block leading-tight">{chip.label}</span>
                <span className={`mt-0.5 block tabular-nums ${selected ? "opacity-90" : "text-on-surface-variant"}`}>
                  {countForQueue(chip.key)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <main className="relative min-h-0 flex-1 px-3 pb-28 pt-1">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-10 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-rose-700">
            <p>{error}</p>
            <button type="button" onClick={() => void reload()} className="underline">
              נסה שוב
            </button>
          </div>
        ) : !current ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm font-semibold">התור ריק</p>
            <Link
              href={"/dashboard/inbox" as Route}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white"
            >
              חזרה ללוח עיבוד
            </Link>
          </div>
        ) : (
          <div className="relative mx-auto h-[min(78dvh,100%)] w-full max-w-lg">
            <AnimatePresence mode="popLayout">
              {[current, ...nextCards].map((ticket, i) => (
                <FocusTriageCard
                  key={ticket.id}
                  ticket={ticket}
                  detail={i === 0 ? detail : null}
                  stackIndex={i}
                  isTop={i === 0}
                  busy={busy}
                  tall
                  onArchive={() => void handleArchive()}
                  onDelete={() => void handleDelete()}
                  onSpam={() => void handleSpam()}
                  onReply={() => setReplying(ticket)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <FocusActionBar
        disabled={!current || busy}
        onDelete={() => void handleDelete()}
        onReply={() => current && setReplying(current)}
        onArchive={() => void handleArchive()}
      />

      <MobileDock
        onSyncMail={() => router.push("/dashboard/inbox")}
        onTriage={() => router.push("/triage")}
        onAnswerBundles={() => router.push("/answer-bundles")}
        onReview={() => router.push("/mobile/triage?queue=active")}
        emailSyncing={false}
        triageCount={triageCount}
        bundleCount={0}
        activeReview
      />

      <TriageActionToast
        visible={!!toast}
        message={toast?.message ?? ""}
        onUndo={
          toast?.undo
            ? () => {
                void handleUndo(toast.undo!);
                setToast(null);
              }
            : undefined
        }
        onDismiss={() => setToast(null)}
      />

      {replying ? (
        <ReplyTicketModal
          ticket={replying}
          onClose={() => setReplying(null)}
          onSubmit={async (message) => {
            await sendTicketReply(replying.id, message, { closeAfterSend: true });
            setReplying(null);
            advanceOptimistic();
          }}
        />
      ) : null}
    </div>
  );
}
