"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { CircleDot, ExternalLink, Loader2, Pencil, Save, Send, Tag, Trash2, X } from "lucide-react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { TicketAttachments } from "@/components/TicketAttachments";
import { TriageAssignBar } from "@/components/TriageAssignBar";
import { AiCoPilotCard } from "@/components/resolution/AiCoPilotCard";
import { ResolutionActionBar } from "@/components/resolution/ResolutionActionBar";
import { ResolutionSkeleton } from "@/components/resolution/ResolutionSkeleton";
import { useReplySuggestions } from "@/hooks/useReplySuggestions";
import { ACTIVE_CATEGORIES, categoryLabel } from "@/lib/categories";
import { displayTicketDate } from "@/lib/ticket-row";
import { formatTicketNumber } from "@/lib/ticket-sequence";
import { isPendingTriage } from "@/lib/triage";
import type { Ticket, TicketStatus } from "@/lib/types";

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "פתוח",
  in_progress: "בטיפול",
  closed: "סגור"
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: "bg-blue-500/15 text-blue-200 border-blue-400/30",
  in_progress: "bg-amber-500/15 text-amber-200 border-amber-400/30",
  closed: "bg-white/5 jds-empty-subtitle border-white/10"
};

function formatWhen(ticket: Ticket): string {
  return displayTicketDate(ticket).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function StatusChip({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export type TicketDetailProps = {
  ticket: Ticket;
  detailLoading?: boolean;
  onSetStatus: (id: string, status: TicketStatus) => void;
  onReply: (ticket: Ticket) => void;
  onSaveInquiry: (ticket: Ticket) => void;
  onEdit: (ticket: Ticket) => void;
  onDelete: (id: string) => void;
  onChangeCategory: (id: string, category: string) => void;
  onTriageAssign?: (id: string, category: string) => void;
  onSpam?: (id: string) => void;
  onArchive?: (id: string) => void;
  onInlineReply?: (ticketId: string, message: string) => Promise<void>;
  onClose?: () => void;
  compactHeader?: boolean;
};

export function TicketDetail({
  ticket,
  detailLoading,
  onSetStatus,
  onReply,
  onSaveInquiry,
  onEdit,
  onDelete,
  onChangeCategory,
  onTriageAssign,
  onSpam,
  onArchive,
  onInlineReply,
  onClose,
  compactHeader
}: TicketDetailProps) {
  const [replyDraft, setReplyDraft] = useState("");
  const [sending, setSending] = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const { suggestions, topSuggestion, highConfidence, loading: suggestionsLoading } =
    useReplySuggestions(ticket.id);

  useEffect(() => {
    setReplyDraft("");
  }, [ticket.id]);

  useEffect(() => {
    const onFocusReply = () => {
      replyRef.current?.focus();
      replyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.addEventListener("resolution:focus-reply", onFocusReply);
    return () => window.removeEventListener("resolution:focus-reply", onFocusReply);
  }, []);

  const sendInline = useCallback(
    async (message: string) => {
      if (!message.trim() || sending) return;
      if (onInlineReply) {
        setSending(true);
        try {
          await onInlineReply(ticket.id, message.trim());
          setReplyDraft("");
        } finally {
          setSending(false);
        }
        return;
      }
      onReply(ticket);
    },
    [onInlineReply, onReply, sending, ticket]
  );

  const onSubmitReply = async (event?: FormEvent) => {
    event?.preventDefault();
    await sendInline(replyDraft);
  };

  if (detailLoading && !ticket.body) {
    return <ResolutionSkeleton variant="detail" />;
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="jds-panel-header shrink-0 px-3 py-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge category={ticket.category} />
            <StatusChip status={ticket.status} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] jds-empty-subtitle">{formatWhen(ticket)}</span>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 p-1.5 jds-empty-subtitle hover:bg-white/5 xl:hidden"
                aria-label="סגור כרטיס פנייה"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ticket.ticketNumber != null ? (
            <span className="rounded-md bg-[var(--jds-primary-glow)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--jds-primary)]">
              {formatTicketNumber(ticket.ticketNumber)}
            </span>
          ) : null}
          <h2
            className={`min-w-0 flex-1 font-bold leading-snug ${compactHeader ? "text-sm" : "text-base"}`}
          >
            {ticket.subject}
          </h2>
        </div>
        <p className="mt-1 text-xs jds-empty-subtitle">
          {ticket.senderName || "ללא שם"} ·{" "}
          {ticket.senderEmail ? (
            <Link
              href={`/customer/${encodeURIComponent(ticket.senderEmail)}`}
              className="text-[var(--jds-primary)] underline-offset-2 hover:underline"
            >
              {ticket.senderEmail}
            </Link>
          ) : (
            "ללא אימייל"
          )}
        </p>
      </div>

      <div className="jds-list-scroll min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-xs font-semibold leading-snug">{ticket.aiSummary || ticket.subject}</p>
        </div>
        <div className="mt-2 max-h-56 overflow-y-auto overscroll-contain whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-relaxed">
          {ticket.body || "אין תוכן להצגה"}
        </div>

        {ticket.closureNote ? (
          <div className="mt-2 rounded-xl bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-300">
            הערת סגירה: {ticket.closureNote}
          </div>
        ) : null}
        <TicketAttachments ticketId={ticket.id} />
        {isPendingTriage(ticket.category) && onTriageAssign ? (
          <div className="mt-3">
            <TriageAssignBar onAssign={(category) => onTriageAssign(ticket.id, category)} />
          </div>
        ) : null}

        <div className="mt-4">
          <AiCoPilotCard
            suggestion={topSuggestion}
            highConfidence={highConfidence}
            loading={suggestionsLoading}
            sending={sending}
            onApproveSend={(text) => void sendInline(text)}
            onUseDraft={(text) => {
              setReplyDraft(text);
              replyRef.current?.focus();
            }}
          />

          {suggestions.length > 1 ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {suggestions.slice(1, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setReplyDraft(item.replyText)}
                  className="rounded-lg border border-violet-400/25 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold text-violet-200"
                >
                  {item.replyText.slice(0, 28)}
                  {item.replyText.length > 28 ? "…" : ""}
                </button>
              ))}
            </div>
          ) : null}

          <form onSubmit={(e) => void onSubmitReply(e)} className="space-y-2">
            <label className="block text-[11px] font-semibold jds-empty-subtitle">
              מענה ידני
              <textarea
                ref={replyRef}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                rows={4}
                placeholder="כתוב מענה ללקוח…"
                className="mt-1 w-full resize-y rounded-xl2 border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--jds-primary)]/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void onSubmitReply();
                  }
                }}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!replyDraft.trim() || sending}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--jds-primary-glow)] px-3 py-2 text-xs font-bold text-[var(--jds-primary)] disabled:opacity-45"
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                שלח מענה
              </button>
              <button
                type="button"
                onClick={() => onReply(ticket)}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/5"
              >
                מענה מורחב
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="jds-panel-footer shrink-0 space-y-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-amber-400/30 bg-amber-500/10 px-2 py-2 text-xs font-bold text-amber-200"
            onClick={() => onSetStatus(ticket.id, "in_progress")}
          >
            <CircleDot className="size-3.5" />
            בטיפול
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs font-bold"
            onClick={() => onSaveInquiry(ticket)}
          >
            <Save className="size-3.5" />
            שמור
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs font-bold"
            onClick={() => onEdit(ticket)}
          >
            <Pencil className="size-3.5" />
            עריכה
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-400/30 bg-rose-500/10 px-2 py-2 text-xs font-bold text-rose-300"
            onClick={() => onDelete(ticket.id)}
          >
            <Trash2 className="size-3.5" />
            מחיקה
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr,auto]">
          <label className="block text-[11px] font-semibold jds-empty-subtitle">
            קטגוריה
            <select
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none focus:border-[var(--jds-primary)]/50"
              value={ticket.category}
              onChange={(event) => onChangeCategory(ticket.id, event.target.value)}
            >
              {ACTIVE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
          </label>
          {ticket.senderEmail ? (
            <Link
              href={`/customer/${encodeURIComponent(ticket.senderEmail)}`}
              className="inline-flex items-end justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold hover:bg-white/10"
            >
              <ExternalLink className="size-3.5" />
              היסטוריה
            </Link>
          ) : null}
        </div>

        {ticket.tags.length > 0 ? (
          <p className="inline-flex flex-wrap items-center gap-1 text-[11px] jds-empty-subtitle">
            <Tag className="size-3" />
            {ticket.tags.join(", ")}
          </p>
        ) : null}
      </div>

      {onSpam && onArchive ? (
        <ResolutionActionBar
          disabled={sending}
          onSpam={() => onSpam(ticket.id)}
          onArchive={() => onArchive(ticket.id)}
          onReplyFocus={() => window.dispatchEvent(new Event("resolution:focus-reply"))}
        />
      ) : null}
    </div>
  );
}
