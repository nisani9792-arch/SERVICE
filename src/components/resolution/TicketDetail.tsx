"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  CircleDot,
  ExternalLink,
  Maximize2,
  Pencil,
  Save,
  ShieldBan,
  Tag,
  Trash2,
  X
} from "lucide-react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { CustomerFollowUpDisplay } from "@/components/CustomerFollowUpDisplay";
import { InlineReplyComposer } from "@/components/InlineReplyComposer";
import { TicketAttachments } from "@/components/TicketAttachments";
import { TriageAssignBar } from "@/components/TriageAssignBar";
import { ResolutionSkeleton } from "@/components/resolution/ResolutionSkeleton";
import { hasCustomerFollowUp } from "@/lib/customer-followup-text";
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
  open: "bg-primary-soft text-primary",
  in_progress: "bg-amber-50/90 text-amber-900",
  closed: "bg-surface-container text-on-surface-variant"
};

function formatWhen(ticket: Ticket): string {
  return displayTicketDate(ticket).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short"
  });
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

function TicketActionButtons({
  ticket,
  onSetStatus,
  onSaveInquiry,
  onEdit,
  onDelete,
  onReply,
  onSpam,
  onArchive,
  onChangeCategory
}: Pick<
  TicketDetailProps,
  | "ticket"
  | "onSetStatus"
  | "onSaveInquiry"
  | "onEdit"
  | "onDelete"
  | "onReply"
  | "onSpam"
  | "onArchive"
  | "onChangeCategory"
>) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-lg bg-amber-50/90 px-2 py-1 text-[10px] font-bold text-amber-900 shadow-sm"
        onClick={() => onSetStatus(ticket.id, "in_progress")}
      >
        <CircleDot className="size-3" />
        בטיפול
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-lg bg-surface-container px-2 py-1 text-[10px] font-bold text-on-surface shadow-sm"
        onClick={() => onSaveInquiry(ticket)}
      >
        <Save className="size-3" />
        שמור
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-lg bg-surface-container px-2 py-1 text-[10px] font-bold text-on-surface shadow-sm"
        onClick={() => onEdit(ticket)}
      >
        <Pencil className="size-3" />
        עריכה
      </button>
      {onSpam ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg bg-amber-50/90 px-2 py-1 text-[10px] font-bold text-amber-900 shadow-sm"
          onClick={() => onSpam(ticket.id)}
        >
          <ShieldBan className="size-3" />
          ספאם
        </button>
      ) : null}
      {onArchive ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50/90 px-2 py-1 text-[10px] font-bold text-emerald-900 shadow-sm"
          onClick={() => onArchive(ticket.id)}
        >
          <Archive className="size-3" />
          ארכיון
        </button>
      ) : null}
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-lg bg-rose-50/90 px-2 py-1 text-[10px] font-bold text-rose-800 shadow-sm"
        onClick={() => onDelete(ticket.id)}
      >
        <Trash2 className="size-3" />
        מחק
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-lg bg-surface-container px-2 py-1 text-[10px] font-bold text-on-surface-variant shadow-sm"
        onClick={() => onReply(ticket)}
      >
        <Maximize2 className="size-3" />
        מורחב
      </button>
      <select
        className="mr-auto max-w-[8rem] rounded-lg bg-surface-container px-2 py-1 text-[10px] font-semibold text-on-surface shadow-sm"
        value={ticket.category}
        onChange={(event) => onChangeCategory(ticket.id, event.target.value)}
        aria-label="קטגוריה"
      >
        {ACTIVE_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {categoryLabel(category)}
          </option>
        ))}
      </select>
      {ticket.senderEmail ? (
        <Link
          href={`/customer/${encodeURIComponent(ticket.senderEmail)}`}
          className="inline-flex items-center gap-1 rounded-lg bg-primary-soft px-2 py-1 text-[10px] font-bold text-primary shadow-sm"
        >
          <ExternalLink className="size-3" />
        </Link>
      ) : null}
    </div>
  );
}

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
  const [replyKey, setReplyKey] = useState(0);
  const followUpThread = hasCustomerFollowUp(ticket.body || "");
  const bodyText = ticket.body || "";

  useEffect(() => {
    setReplyKey((k) => k + 1);
  }, [ticket.id]);

  const handleInlineSubmit = useCallback(
    async (message: string) => {
      if (!onInlineReply) {
        onReply(ticket);
        return;
      }
      await onInlineReply(ticket.id, message);
    },
    [onInlineReply, onReply, ticket]
  );

  if (detailLoading && !ticket.body) {
    return <ResolutionSkeleton variant="detail" />;
  }

  const actionProps = {
    ticket,
    onSetStatus,
    onSaveInquiry,
    onEdit,
    onDelete,
    onReply,
    onSpam,
    onArchive,
    onChangeCategory
  };

  return (
    <div className="relative flex h-full max-h-full min-h-0 flex-col gen-surface-strong">
      <div className="jds-panel-header shrink-0 px-3 py-2">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge category={ticket.category} />
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[ticket.status]}`}
            >
              {STATUS_LABELS[ticket.status]}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500">{formatWhen(ticket)}</span>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="crm-icon-btn lg:hidden"
                aria-label="סגור"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ticket.ticketNumber != null ? (
            <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-700">
              {formatTicketNumber(ticket.ticketNumber)}
            </span>
          ) : null}
          <h2
            className={`min-w-0 flex-1 font-bold leading-snug text-slate-900 ${compactHeader ? "text-sm" : "text-base"}`}
          >
            {ticket.subject}
          </h2>
        </div>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {ticket.senderName || "ללא שם"} ·{" "}
          {ticket.senderEmail ? (
            <Link
              href={`/customer/${encodeURIComponent(ticket.senderEmail)}`}
              className="text-indigo-600 underline-offset-2 hover:underline"
            >
              {ticket.senderEmail}
            </Link>
          ) : (
            "ללא אימייל"
          )}
        </p>
      </div>

      <div className="jds-detail-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
        {followUpThread ? (
          <CustomerFollowUpDisplay body={bodyText} variant="light" showHistory />
        ) : null}

        {followUpThread ? (
          <details className="mt-2 rounded-xl2 gen-panel !p-0">
            <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-on-surface-variant">
              שרשור מלא (היסטוריית מייל)
            </summary>
            <div className="max-h-48 overflow-y-auto overscroll-contain whitespace-pre-wrap px-3 py-2 text-[13px] leading-relaxed text-on-surface lg:max-h-none">
              {bodyText || "אין תוכן"}
            </div>
          </details>
        ) : (
          <div className="mt-2 whitespace-pre-wrap rounded-xl2 gen-panel p-3 text-sm leading-relaxed text-on-surface">
            {bodyText || "אין תוכן להצגה"}
          </div>
        )}

        {ticket.closureNote ? (
          <div className="mt-2 rounded-xl2 bg-emerald-50/90 p-2 text-xs text-emerald-900 shadow-sm">
            הערת סגירה: {ticket.closureNote}
          </div>
        ) : null}

        <TicketAttachments ticketId={ticket.id} />

        {isPendingTriage(ticket.category) && onTriageAssign ? (
          <div className="mt-2">
            <TriageAssignBar onAssign={(category) => onTriageAssign(ticket.id, category)} />
          </div>
        ) : null}
      </div>

      <div className="jds-detail-footer shrink-0 gen-reply-composer pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-float">
        <div className="hidden px-2 py-1.5 lg:block">
          <TicketActionButtons {...actionProps} />
        </div>

        <details className="lg:hidden">
          <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-slate-600">
            פעולות על הפנייה
          </summary>
          <div className="px-2 pb-2">
            <TicketActionButtons {...actionProps} />
          </div>
        </details>

        {ticket.tags.length > 0 ? (
          <p className="flex flex-wrap items-center gap-1 px-3 py-1 text-[10px] text-slate-500">
            <Tag className="size-3" />
            {ticket.tags.join(", ")}
          </p>
        ) : null}

        {onInlineReply ? (
          <InlineReplyComposer
            key={replyKey}
            ticket={ticket}
            onSubmit={handleInlineSubmit}
            onSent={() => setReplyKey((k) => k + 1)}
          />
        ) : (
          <div className="px-3 py-2">
            <button
              type="button"
              onClick={() => onReply(ticket)}
              className="gen-reply-send w-full py-2.5 text-xs"
            >
              כתוב מענה
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
