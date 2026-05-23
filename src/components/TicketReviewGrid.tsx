"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, ShieldBan, Trash2 } from "lucide-react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { BulkActionBar } from "@/components/BulkActionBar";
import { ReplyTicketModal } from "@/components/ReplyTicketModal";
import {
  deleteTicket,
  deleteTicketsBulk,
  sendTicketReply,
  updateTicketsBulk
} from "@/lib/firebase";
import { listInquiryPreview } from "@/lib/inquiry-preview";
import { confirmSpamWithBlockSender } from "@/lib/spam-confirm";
import type { Ticket } from "@/lib/types";

export type ReviewFilterMode = "active" | "triage" | "all";

type TicketReviewGridProps = {
  tickets: Ticket[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onMutated: () => void;
};

export function TicketReviewGrid({
  tickets,
  isLoading,
  hasMore,
  onLoadMore,
  onMutated
}: TicketReviewGridProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [replyingTicket, setReplyingTicket] = useState<Ticket | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const markSpam = useCallback(
    async (ids: string[]) => {
      const { ok, blockSender } = confirmSpamWithBlockSender(
        `לסמן ${ids.length} פניות כספאם?`
      );
      if (!ok) return;
      await updateTicketsBulk(ids, { category: "spam", status: "closed", blockSender });
      setSelectedIds(new Set());
      onMutated();
    },
    [onMutated]
  );

  const removeTickets = useCallback(
    async (ids: string[]) => {
      if (!window.confirm(`למחוק ${ids.length} פניות?`)) return;
      if (ids.length === 1) await deleteTicket(ids[0]);
      else await deleteTicketsBulk(ids);
      setSelectedIds(new Set());
      onMutated();
    },
    [onMutated]
  );

  const onSendReply = async (message: string) => {
    if (!replyingTicket) return;
    await sendTicketReply(replyingTicket.id, message, { closeAfterSend: true });
    setReplyingTicket(null);
    onMutated();
  };

  const focusedTicket = tickets.find((t) => t.id === focusedId) ?? tickets[0] ?? null;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!focusedTicket || replyingTicket) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        setReplyingTicket(focusedTicket);
      } else if (event.key === "d" || event.key === "D") {
        event.preventDefault();
        void markSpam([focusedTicket.id]);
      } else if (event.key === "x" || event.key === "X") {
        event.preventDefault();
        void removeTickets([focusedTicket.id]);
      } else if (event.key === " ") {
        event.preventDefault();
        toggleSelect(focusedTicket.id);
      }
    },
    [focusedTicket, replyingTicket, markSpam, removeTickets]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!hasMore || isLoading) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

  return (
    <>
      <p className="mb-3 text-center text-[10px] text-on-surface-variant">
        קיצורים: R מענה · D ספאם · X מחק · רווח בחירה
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tickets.map((ticket) => {
          const selected = selectedIds.has(ticket.id);
          const focused = focusedId === ticket.id;
          const preview = listInquiryPreview(ticket, 220);
          const createdAt = new Date(ticket.createdAt).toLocaleDateString("he-IL", {
            day: "numeric",
            month: "short"
          });

          return (
            <article
              key={ticket.id}
              tabIndex={0}
              onFocus={() => setFocusedId(ticket.id)}
              onClick={() => setFocusedId(ticket.id)}
              className={`glass-panel flex min-h-[11rem] flex-col rounded-2xl border p-3 text-right outline-none transition ${
                selected ? "ring-2 ring-primary ring-offset-1" : ""
              } ${focused ? "border-primary/40 shadow-glow-sm" : "border-outline/70"}`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleSelect(ticket.id)}
                  className="crm-touch-target mt-0.5 size-4 shrink-0 accent-primary"
                  aria-label="בחירה"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-on-surface">{ticket.senderEmail}</p>
                  <p className="text-[10px] text-on-surface-variant">{createdAt}</p>
                </div>
                <CategoryBadge category={ticket.category} />
              </div>

              <p className="mb-3 line-clamp-5 flex-1 text-xs leading-relaxed text-on-surface">
                {preview}
              </p>

              <div className="mt-auto grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setReplyingTicket(ticket)}
                  className="crm-touch-target inline-flex items-center justify-center gap-1 rounded-xl border border-primary/30 bg-primary-soft px-2 py-2 text-[10px] font-bold text-primary"
                >
                  <MessageSquare className="size-3.5" />
                  מענה
                </button>
                <button
                  type="button"
                  onClick={() => void markSpam([ticket.id])}
                  className="crm-touch-target inline-flex items-center justify-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-[10px] font-bold text-amber-950"
                >
                  <ShieldBan className="size-3.5" />
                  ספאם
                </button>
                <button
                  type="button"
                  onClick={() => void removeTickets([ticket.id])}
                  className="crm-touch-target inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2 py-2 text-[10px] font-bold text-rose-800"
                >
                  <Trash2 className="size-3.5" />
                  מחק
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-xs text-on-surface-variant">טוען כרטיסים…</p>
      ) : null}

      {!isLoading && tickets.length === 0 ? (
        <p className="py-12 text-center text-sm text-on-surface-variant">אין פניות להצגה</p>
      ) : null}

      <div ref={loadMoreRef} className="h-4" aria-hidden />

      {selectedIds.size > 0 ? (
        <BulkActionBar
          count={selectedIds.size}
          onReply={() => {
            const first = tickets.find((t) => selectedIds.has(t.id));
            if (first) setReplyingTicket(first);
          }}
          onAiClassify={async () => {}}
          aiBusy
          onDelete={async () => removeTickets(Array.from(selectedIds))}
          onChangeCategory={async () => {}}
          onSetStatus={async () => {}}
          onAddTags={async () => {}}
          onMoveToSpam={async () => markSpam(Array.from(selectedIds))}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      ) : null}

      {replyingTicket ? (
        <ReplyTicketModal
          ticket={replyingTicket}
          onClose={() => setReplyingTicket(null)}
          onSubmit={onSendReply}
        />
      ) : null}
    </>
  );
}
