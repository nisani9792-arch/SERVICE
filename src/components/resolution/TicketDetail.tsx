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
import { QuickReplyBar } from "@/components/QuickReplyBar";
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
  open: "bg-blue-50 text-blue-800 border-blue-200",
  in_progress: "bg-amber-50 text-amber-900 border-amber-200",
  closed: "bg-slate-100 text-slate-600 border-slate-200"
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

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-white">
      <div className="jds-panel-header shrink-0 px-3 py-2">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge category={ticket.category} />
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[ticket.status]}`}
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

      <div className="jds-list-scroll min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {followUpThread ? (
          <CustomerFollowUpDisplay body={ticket.body || ""} variant="light" showHistory />
        ) : null}

        <div className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm leading-relaxed text-slate-800">
          {followUpThread ? (
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              שרשור מלא
            </p>
          ) : null}
          {ticket.body || "אין תוכן להצגה"}
        </div>

        {ticket.closureNote ? (
          <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
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

      <div className="jds-panel-footer shrink-0 border-t border-slate-200/90">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-2 py-1.5">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-900"
            onClick={() => onSetStatus(ticket.id, "in_progress")}
          >
            <CircleDot className="size-3" />
            בטיפול
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-700"
            onClick={() => onSaveInquiry(ticket)}
          >
            <Save className="size-3" />
            שמור
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-700"
            onClick={() => onEdit(ticket)}
          >
            <Pencil className="size-3" />
            עריכה
          </button>
          {onSpam ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-900"
              onClick={() => onSpam(ticket.id)}
            >
              <ShieldBan className="size-3" />
              ספאם
            </button>
          ) : null}
          {onArchive ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-900"
              onClick={() => onArchive(ticket.id)}
            >
              <Archive className="size-3" />
              ארכיון
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-800"
            onClick={() => onDelete(ticket.id)}
          >
            <Trash2 className="size-3" />
            מחק
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600"
            onClick={() => onReply(ticket)}
          >
            <Maximize2 className="size-3" />
            מורחב
          </button>
          <select
            className="mr-auto max-w-[8rem] rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700"
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
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-indigo-700"
            >
              <ExternalLink className="size-3" />
            </Link>
          ) : null}
        </div>

        {ticket.tags.length > 0 ? (
          <p className="flex flex-wrap items-center gap-1 px-3 py-1 text-[10px] text-slate-500">
            <Tag className="size-3" />
            {ticket.tags.join(", ")}
          </p>
        ) : null}

        {onInlineReply ? (
          <QuickReplyBar
            key={replyKey}
            ticket={ticket}
            variant="workbench"
            onSubmit={handleInlineSubmit}
            onSent={() => setReplyKey((k) => k + 1)}
          />
        ) : (
          <div className="px-3 py-2">
            <button
              type="button"
              onClick={() => onReply(ticket)}
              className="w-full rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white"
            >
              כתוב מענה
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
