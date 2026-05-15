"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCheck,
  CircleDot,
  ExternalLink,
  Pencil,
  Save,
  Send,
  Tag,
  Trash2,
  X
} from "lucide-react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { ACTIVE_CATEGORIES, categoryLabel } from "@/lib/categories";
import { displayTicketDate } from "@/lib/ticket-row";
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

const STATUS_ACCENT: Record<TicketStatus, string> = {
  open: "bg-blue-500",
  in_progress: "bg-amber-500",
  closed: "bg-outline"
};

function normalizePreview(ticket: Ticket): string {
  return (ticket.body || ticket.aiSummary || ticket.subject || "אין תוכן להצגה")
    .replace(/\s+/g, " ")
    .trim();
}

function formatWhen(ticket: Ticket): string {
  return displayTicketDate(ticket).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function dayGroupLabel(ticket: Ticket): string {
  const date = displayTicketDate(ticket);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);

  if (diffDays === 0) return "היום";
  if (diffDays === 1) return "אתמול";
  if (diffDays < 7) return "השבוע";
  return date.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
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
  onMarkClosed: (id: string) => void;
  onEdit: (ticket: Ticket) => void;
  onDelete: (id: string) => void;
  onChangeCategory: (id: string, category: string) => void;
  onClose?: () => void;
  compactHeader?: boolean;
}

function TicketDetailPanel({
  ticket,
  onSetStatus,
  onReply,
  onSaveInquiry,
  onMarkClosed,
  onEdit,
  onDelete,
  onChangeCategory,
  onClose,
  compactHeader
}: TicketDetailPanelProps) {
  return (
    <div className="flex max-h-[72vh] min-h-[20rem] flex-col">
      <div className="border-b border-outline/70 px-3 py-2">
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
        <h2 className={`font-bold leading-snug text-on-surface ${compactHeader ? "text-sm" : "text-base"}`}>
          {ticket.subject}
        </h2>
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
        <div className="mt-2 whitespace-pre-wrap rounded-xl border border-outline/70 bg-white p-3 text-sm leading-relaxed text-on-surface">
          {ticket.body || "אין תוכן להצגה"}
        </div>
        {ticket.closureNote ? (
          <div className="mt-2 rounded-xl bg-success/10 p-3 text-xs leading-relaxed text-success">
            הערת סגירה: {ticket.closureNote}
          </div>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-outline/70 p-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-xs font-bold text-amber-950"
            onClick={() => onSetStatus(ticket.id, "in_progress")}
          >
            <CircleDot className="size-3.5" />
            העבר לטיפול
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-primary/25 bg-primary-soft px-2 py-2 text-xs font-bold text-primary"
            onClick={() => onReply(ticket)}
          >
            <Send className="size-3.5" />
            מענה ללקוח
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-outline bg-white px-2 py-2 text-xs font-bold text-on-surface"
            onClick={() => onSaveInquiry(ticket)}
          >
            <Save className="size-3.5" />
            שמירת הפנייה
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-success/30 bg-success/10 px-2 py-2 text-xs font-bold text-success"
            onClick={() => onMarkClosed(ticket.id)}
          >
            <CheckCheck className="size-3.5" />
            טיפול וסגירה
          </button>
        </div>

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
  selectedIds: Set<string>;
  activeTicket: Ticket | null;
  onSetActiveTicket: (ticket: Ticket) => void;
  onToggleSelect: (id: string) => void;
  onSelectPage: (select: boolean) => void;
  onPageChange: (page: number) => void;
  onEdit: (ticket: Ticket) => void;
  onMarkClosed: (id: string) => void;
  onDelete: (id: string) => void;
  onSetStatus: (id: string, status: TicketStatus) => void;
  onChangeCategory: (id: string, category: string) => void;
  onReply: (ticket: Ticket) => void;
  onSaveInquiry: (ticket: Ticket) => void;
}

export function TicketWorkbench({
  title = "פניות פעילות",
  subtitle,
  tickets,
  total,
  page,
  pageSize,
  isLoading,
  selectedIds,
  activeTicket,
  onSetActiveTicket,
  onToggleSelect,
  onSelectPage,
  onPageChange,
  onEdit,
  onMarkClosed,
  onDelete,
  onSetStatus,
  onChangeCategory,
  onReply,
  onSaveInquiry
}: TicketWorkbenchProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = tickets.length > 0 && tickets.every((ticket) => selectedIds.has(ticket.id));
  const detailRef = useRef<HTMLElement>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const groupedTickets = useMemo(() => {
    const groups = new Map<string, Ticket[]>();
    for (const ticket of tickets) {
      const label = dayGroupLabel(ticket);
      const bucket = groups.get(label) ?? [];
      bucket.push(ticket);
      groups.set(label, bucket);
    }
    return Array.from(groups.entries());
  }, [tickets]);

  const selectTicket = (ticket: Ticket) => {
    onSetActiveTicket(ticket);
    setMobileDetailOpen(true);
  };

  useEffect(() => {
    if (!activeTicket) {
      setMobileDetailOpen(false);
      return;
    }
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeTicket]);

  const detailProps = activeTicket
    ? {
        ticket: activeTicket,
        onSetStatus,
        onReply,
        onSaveInquiry,
        onMarkClosed,
        onEdit,
        onDelete,
        onChangeCategory,
        onClose: () => setMobileDetailOpen(false)
      }
    : null;

  return (
    <section className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr),minmax(22rem,0.58fr)]">
      <div className="min-w-0 rounded-2xl border border-outline/70 bg-white/95 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline/70 px-3 py-2.5">
          <div>
            <h2 className="text-sm font-bold text-on-surface">{title}</h2>
            <p className="text-[11px] text-on-surface-variant">
              {subtitle ?? `${total.toLocaleString("he-IL")} תוצאות · לחץ על פנייה לפרטים ופעולות`}
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

        <div className="max-h-[72vh] min-h-[20rem] overflow-y-auto p-2">
          {isLoading ? (
            <div className="rounded-xl bg-surface-container px-3 py-10 text-center text-sm text-on-surface-variant">
              טוען פניות…
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-xl bg-surface-container px-3 py-10 text-center text-sm text-on-surface-variant">
              אין פניות להצגה לפי המסננים.
            </div>
          ) : (
            <div className="space-y-3">
              {groupedTickets.map(([groupLabel, groupTickets]) => (
                <section key={groupLabel}>
                  <h3 className="sticky top-0 z-[1] mb-1.5 rounded-lg bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant backdrop-blur-sm">
                    {groupLabel}
                  </h3>
                  <div className="space-y-1.5">
                    {groupTickets.map((ticket) => {
                      const active = activeTicket?.id === ticket.id;
                      const selected = selectedIds.has(ticket.id);
                      return (
                        <article
                          key={ticket.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => selectTicket(ticket)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              selectTicket(ticket);
                            }
                          }}
                          className={`relative cursor-pointer rounded-xl border p-2.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                            active
                              ? "border-primary bg-primary-soft/40 shadow-sm ring-1 ring-primary/25"
                              : selected
                                ? "border-primary/35 bg-primary-soft/25"
                                : "border-outline/70 bg-white hover:border-primary/40 hover:bg-primary-soft/15"
                          }`}
                        >
                          <span
                            className={`absolute inset-y-2 right-0 w-1 rounded-full ${STATUS_ACCENT[ticket.status]}`}
                            aria-hidden
                          />
                          <div className="flex items-start gap-2 pr-2">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => onToggleSelect(ticket.id)}
                              onClick={(event) => event.stopPropagation()}
                              className="mt-1 size-4 shrink-0 accent-primary"
                              aria-label="בחר פנייה"
                            />
                            <div className="min-w-0 flex-1 text-right">
                              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold text-on-surface-variant">
                                  {formatWhen(ticket)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <CategoryBadge category={ticket.category} />
                                  <StatusChip status={ticket.status} />
                                </span>
                              </div>
                              <h3 className="line-clamp-1 text-[13px] font-bold leading-snug text-on-surface">
                                {ticket.subject}
                              </h3>
                              <p className="mt-0.5 line-clamp-1 text-[11px] text-on-surface-variant">
                                {ticket.senderName || "ללא שם"} · {ticket.senderEmail || "ללא אימייל"}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs leading-snug text-on-surface-variant">
                                {normalizePreview(ticket)}
                              </p>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
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

      <aside
        ref={detailRef}
        className="hidden min-w-0 rounded-2xl border border-outline/70 bg-white/95 shadow-sm xl:block"
      >
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
          <aside className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-2xl border border-outline/70 bg-white shadow-2xl">
            <TicketDetailPanel {...detailProps} compactHeader />
          </aside>
        </div>
      ) : null}
    </section>
  );
}
