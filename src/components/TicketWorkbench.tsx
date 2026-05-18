"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CircleDot, ExternalLink, Pencil, Save, Send, Tag, Trash2, X } from "lucide-react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { TicketListPanel } from "@/components/TicketListPanel";
import { formatTicketNumber } from "@/lib/ticket-sequence";
import { TicketAttachments } from "@/components/TicketAttachments";
import { TriageAssignBar } from "@/components/TriageAssignBar";
import { ACTIVE_CATEGORIES, categoryLabel } from "@/lib/categories";
import { useTicketDetail } from "@/hooks/useTicketDetail";
import { displayTicketDate } from "@/lib/ticket-row";
import { isPendingTriage } from "@/lib/triage";
import type { Ticket, TicketStatus } from "@/lib/types";

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "פתוח",
  in_progress: "בטיפול",
  closed: "סגור"
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: "bg-blue-50 text-blue-950 border-blue-200",
  in_progress: "bg-amber-50 text-amber-950 border-amber-200",
  closed: "bg-surface-container text-on-surface-variant border-outline"
};

function formatWhen(ticket: Ticket): string {
  return displayTicketDate(ticket).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function StatusChip({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

interface TicketDetailPanelProps {
  ticket: Ticket;
  onSetStatus: (id: string, status: TicketStatus) => void;
  onReply: (ticket: Ticket) => void;
  onSaveInquiry: (ticket: Ticket) => void;
  onEdit: (ticket: Ticket) => void;
  onDelete: (id: string) => void;
  onChangeCategory: (id: string, category: string) => void;
  onTriageAssign?: (id: string, category: string) => void;
  onClose?: () => void;
  compactHeader?: boolean;
}

function TicketDetailPanel({
  ticket,
  onSetStatus,
  onReply,
  onSaveInquiry,
  onEdit,
  onDelete,
  onChangeCategory,
  onTriageAssign,
  onClose,
  compactHeader
}: TicketDetailPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-outline/70 px-3 py-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge category={ticket.category} />
            <StatusChip status={ticket.status} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-on-surface-variant">{formatWhen(ticket)}</span>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-outline p-1.5 text-on-surface-variant hover:bg-surface-container xl:hidden"
                aria-label="סגור כרטיס פנייה"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ticket.ticketNumber != null ? (
            <span className="rounded-md bg-primary-soft/50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
              {formatTicketNumber(ticket.ticketNumber)}
            </span>
          ) : null}
          <h2 className={`min-w-0 flex-1 font-bold leading-snug text-on-surface ${compactHeader ? "text-sm" : "text-base"}`}>
            {ticket.subject}
          </h2>
        </div>
        <p className="mt-1 text-xs text-on-surface-variant">
          {ticket.senderName || "ללא שם"} ·{" "}
          {ticket.senderEmail ? (
            <Link
              href={`/customer/${encodeURIComponent(ticket.senderEmail)}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              {ticket.senderEmail}
            </Link>
          ) : (
            "ללא אימייל"
          )}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <div className="rounded-xl bg-surface-container/70 p-3">
          <p className="text-xs font-semibold leading-snug text-on-surface">
            {ticket.aiSummary || ticket.subject}
          </p>
        </div>
        <div className="mt-2 max-h-72 overflow-y-auto overscroll-contain whitespace-pre-wrap rounded-xl border border-outline/70 bg-white p-3 text-sm leading-relaxed text-on-surface">
          {ticket.body || "אין תוכן להצגה"}
        </div>
        {ticket.closureNote ? (
          <div className="mt-2 rounded-xl bg-success/10 p-3 text-xs leading-relaxed text-success">
            הערת סגירה: {ticket.closureNote}
          </div>
        ) : null}
        <TicketAttachments ticketId={ticket.id} />
        {isPendingTriage(ticket.category) && onTriageAssign ? (
          <div className="mt-3">
            <TriageAssignBar onAssign={(category) => onTriageAssign(ticket.id, category)} />
          </div>
        ) : null}
      </div>

      <div className="shrink-0 space-y-2 border-t border-outline/70 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(30,27,36,0.15)]">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2 py-2.5 text-xs font-bold text-amber-950 active:scale-[0.98]"
            onClick={() => onSetStatus(ticket.id, "in_progress")}
          >
            <CircleDot className="size-3.5" />
            העבר לטיפול
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-primary/25 bg-primary-soft px-2 py-2.5 text-xs font-bold text-primary active:scale-[0.98]"
            onClick={() => onReply(ticket)}
          >
            <Send className="size-3.5" />
            מענה ללקוח
          </button>
        </div>

        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-outline bg-white px-2 py-2 text-xs font-bold text-on-surface"
          onClick={() => onSaveInquiry(ticket)}
        >
          <Save className="size-3.5" />
          שמירת הפנייה
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-outline bg-white px-2 py-2 text-xs font-bold text-on-surface"
            onClick={() => onEdit(ticket)}
          >
            <Pencil className="size-3.5" />
            עריכה מלאה
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-danger/30 bg-danger/10 px-2 py-2 text-xs font-bold text-danger"
            onClick={() => onDelete(ticket.id)}
          >
            <Trash2 className="size-3.5" />
            מחיקה
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr,auto]">
          <label className="block text-[11px] font-semibold text-on-surface-variant">
            העבר לקטגוריה
            <select
              className="mt-1 w-full rounded-xl border border-outline bg-white px-3 py-2 text-xs outline-none focus:border-primary"
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
              className="inline-flex items-end justify-center gap-1 rounded-xl border border-outline bg-white px-3 py-2 text-xs font-bold text-on-surface hover:bg-surface-container"
            >
              <ExternalLink className="size-3.5" />
              היסטוריה
            </Link>
          ) : null}
        </div>

        {ticket.tags.length > 0 ? (
          <p className="inline-flex flex-wrap items-center gap-1 text-[11px] text-on-surface-variant">
            <Tag className="size-3" />
            {ticket.tags.join(", ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

interface TicketWorkbenchProps {
  title?: string;
  subtitle?: string;
  tickets: Ticket[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  isRefreshing?: boolean;
  selectedIds: Set<string>;
  activeTicket: Ticket | null;
  onSetActiveTicket: (ticket: Ticket) => void;
  onToggleSelect: (id: string) => void;
  onSelectPage: (select: boolean) => void;
  onPageChange: (page: number) => void;
  onEdit: (ticket: Ticket) => void;
  onDelete: (id: string) => void;
  onSetStatus: (id: string, status: TicketStatus) => void;
  onChangeCategory: (id: string, category: string) => void;
  onReply: (ticket: Ticket) => void;
  onSaveInquiry: (ticket: Ticket) => void;
  onTriageAssign?: (id: string, category: string) => void;
}

export function TicketWorkbench({
  title = "פניות פעילות",
  subtitle,
  tickets,
  total,
  page,
  pageSize,
  isLoading,
  isRefreshing = false,
  selectedIds,
  activeTicket,
  onSetActiveTicket,
  onToggleSelect,
  onSelectPage,
  onPageChange,
  onEdit,
  onDelete,
  onSetStatus,
  onChangeCategory,
  onReply,
  onSaveInquiry,
  onTriageAssign
}: TicketWorkbenchProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = tickets.length > 0 && tickets.every((ticket) => selectedIds.has(ticket.id));
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const detailTicket = useTicketDetail(activeTicket);

  const selectTicket = useCallback(
    (ticket: Ticket) => {
      onSetActiveTicket(ticket);
      setMobileDetailOpen(true);
    },
    [onSetActiveTicket]
  );

  const activeTicketId = activeTicket?.id ?? null;

  useEffect(() => {
    if (!activeTicketId) {
      setMobileDetailOpen(false);
    }
  }, [activeTicketId]);

  const detailProps = detailTicket
    ? {
        ticket: detailTicket,
        onSetStatus,
        onReply,
        onSaveInquiry,
        onEdit,
        onDelete,
        onChangeCategory,
        onTriageAssign,
        onClose: () => setMobileDetailOpen(false)
      }
    : null;

  return (
    <section className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr),minmax(22rem,0.58fr)]">
      <div className="min-w-0 rounded-2xl border border-outline/70 bg-white/95 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline/70 px-3 py-2.5">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-on-surface">{title}</h2>
            <p className="text-[11px] text-on-surface-variant">
              {subtitle ?? `${total.toLocaleString("he-IL")} תוצאות · לחץ על פנייה לפרטים ופעולות`}
              {isRefreshing ? " · מעדכן…" : ""}
            </p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-full border border-outline bg-white px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => onSelectPage(event.target.checked)}
              className="size-3.5 accent-primary"
            />
            בחר עמוד
          </label>
        </div>

        <div className="crm-list-scroll max-h-[min(68dvh,68vh)] min-h-[16rem] overflow-y-auto overscroll-contain md:max-h-[72vh] md:min-h-[20rem]">
          {isLoading ? (
            <div className="space-y-1.5 p-1" aria-busy="true" aria-label="טוען פניות">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="crm-skeleton h-16 rounded-xl" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-xl bg-surface-container px-3 py-10 text-center text-sm text-on-surface-variant">
              אין פניות להצגה לפי המסננים.
            </div>
          ) : (
            <TicketListPanel
              tickets={tickets}
              activeTicketId={activeTicket?.id ?? null}
              selectedIds={selectedIds}
              onSelect={selectTicket}
              onToggleSelect={onToggleSelect}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline/70 px-3 py-2 text-[11px] text-on-surface-variant">
          <span>
            מציג {(page - 1) * pageSize + 1}-
            {Math.min(page * pageSize, total)} מתוך {total.toLocaleString("he-IL")}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-outline bg-white px-3 py-1 font-semibold disabled:opacity-45"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              הקודם
            </button>
            <span className="tabular-nums">{page}/{totalPages}</span>
            <button
              type="button"
              className="rounded-full border border-outline bg-white px-3 py-1 font-semibold disabled:opacity-45"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              הבא
            </button>
          </div>
        </div>
      </div>

      <aside className="hidden min-w-0 rounded-2xl border border-outline/70 bg-white/95 shadow-sm xl:block">
        {detailProps ? (
          <TicketDetailPanel {...detailProps} />
        ) : (
          <div className="px-4 py-16 text-center text-sm text-on-surface-variant">
            <p className="font-semibold text-on-surface">בחר פנייה מהרשימה</p>
            <p className="mt-1 text-xs">לחיצה על שורה תציג כאן את כרטיס הפנייה עם כל הפעולות.</p>
          </div>
        )}
      </aside>

      {detailProps && mobileDetailOpen ? (
        <div className="fixed inset-0 z-40 xl:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="סגור כרטיס פנייה"
            onClick={() => setMobileDetailOpen(false)}
          />
          <aside className="absolute inset-x-0 bottom-0 flex max-h-[min(92dvh,92vh)] flex-col overflow-hidden rounded-t-2xl border border-outline/70 bg-white shadow-2xl">
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-outline/60" aria-hidden />
            <TicketDetailPanel {...detailProps} compactHeader />
          </aside>
        </div>
      ) : null}
    </section>
  );
}
