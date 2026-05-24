"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Route } from "next";
import { AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { FocusActionBar } from "@/components/crm/FocusActionBar";
import { FocusTriageCard } from "@/components/triage/FocusTriageCard";
import { TriageActionToast } from "@/components/triage/TriageActionToast";
import { ReplyTicketModal } from "@/components/ReplyTicketModal";
import { useTriageActions, type TriageUndoState } from "@/hooks/useTriageActions";
import { useUnifiedTriageQueue } from "@/hooks/useUnifiedTriageQueue";
import { sendTicketReply } from "@/lib/firebase";
import type { TriageQueueKey } from "@/lib/ticket-bucket-view";
import { BUCKET_LABELS, type TicketBucket } from "@/lib/ticket-buckets";
import type { Ticket } from "@/lib/types";

function parseQueue(raw: string | null): TriageQueueKey {
  const v = (raw ?? "active").toLowerCase();
  if (["active", "triage", "handled", "spam", "outbox", "deleted", "all"].includes(v)) {
    return v as TriageQueueKey;
  }
  if (raw && raw in BUCKET_LABELS) return raw as TicketBucket;
  return "active";
}

/**
 * Mobile Focus Engine — zero-friction card stack (Tinder-style).
 * Shared hooks with desktop; minimal chrome, gesture + FAB actions.
 */
export function MobileFocusEngine() {
  const searchParams = useSearchParams();
  const queue = useMemo(
    () => parseQueue(searchParams.get("queue")),
    [searchParams]
  );

  const {
    current,
    nextCards,
    detail,
    total,
    remaining,
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-surface via-surface to-surface-container">
      <div className="shrink-0 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Focus Engine
        </p>
        <p className="text-xs font-bold text-on-surface">{queueLabel}</p>
        <p className="text-[10px] tabular-nums text-on-surface-variant">
          {remaining.toLocaleString("he-IL")} נותרו · {total.toLocaleString("he-IL")}
        </p>
      </div>

      <main className="relative min-h-0 flex-1 px-3 pb-36 pt-2">
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
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-semibold">התור ריק</p>
            <Link href={"/dashboard" as Route} className="text-xs text-primary underline">
              מרכז פיקוד
            </Link>
          </div>
        ) : (
          <div className="relative mx-auto h-[min(90dvh,90%)] w-full max-w-lg">
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
