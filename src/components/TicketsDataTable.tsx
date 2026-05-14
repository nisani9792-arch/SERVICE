"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CheckCheck, Pencil, Trash2 } from "lucide-react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { displayTicketDate } from "@/lib/ticket-row";
import type { Ticket, TicketStatus } from "@/lib/types";

function StatusChip({ status }: { status: TicketStatus }) {
  const styles: Record<TicketStatus, string> = {
    open: "border border-blue-200 bg-blue-50/90 text-blue-950",
    in_progress: "border border-amber-200 bg-amber-50/90 text-amber-950",
    closed: "border border-outline bg-surface-container text-on-surface-variant"
  };
  const labels: Record<TicketStatus, string> = {
    open: "פתוח",
    in_progress: "בטיפול",
    closed: "סגור"
  };
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function contentPreview(ticket: Ticket): string {
  return (ticket.body || ticket.aiSummary || "אין תוכן להצגה")
    .replace(/\s+/g, " ")
    .trim();
}

function MobileTicketCard({
  ticket,
  selected,
  onToggleSelect,
  onEdit,
  onMarkClosed,
  onDelete
}: {
  ticket: Ticket;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (ticket: Ticket) => void;
  onMarkClosed: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const when = displayTicketDate(ticket).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short"
  });
  const preview = contentPreview(ticket);

  return (
    <article
      className={`rounded-2xl border p-3 shadow-sm transition ${
        selected
          ? "border-primary/50 bg-primary-soft/45"
          : "border-outline/70 bg-white/95"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-xs font-medium text-on-surface-variant">
          <input
            type="checkbox"
            className="size-4 cursor-pointer accent-primary"
            checked={selected}
            onChange={() => onToggleSelect(ticket.id)}
          />
          בחר
        </label>
        <span className="text-[11px] text-on-surface-variant">{when}</span>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={ticket.category} />
          <StatusChip status={ticket.status} />
        </div>

        <div>
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-on-surface">
            {ticket.subject}
          </h3>
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

        <div className="rounded-xl bg-surface-container/70 p-3">
          <p className="line-clamp-2 text-xs font-semibold leading-snug text-on-surface">
            {ticket.aiSummary || ticket.subject}
          </p>
          <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-on-surface-variant">
            {preview}
          </p>
          {ticket.closureNote ? (
            <p className="mt-2 line-clamp-2 rounded-lg bg-white/70 px-2 py-1 text-[11px] leading-snug text-on-surface-variant">
              הערת סגירה: {ticket.closureNote}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          className="rounded-xl border border-success/30 bg-success/10 px-2 py-2 text-xs font-semibold text-success"
          onClick={() => onMarkClosed(ticket.id)}
        >
          טופל
        </button>
        <button
          type="button"
          className="rounded-xl border border-outline bg-white px-2 py-2 text-xs font-semibold text-on-surface"
          onClick={() => onEdit(ticket)}
        >
          עריכה
        </button>
        <button
          type="button"
          className="rounded-xl border border-danger/30 bg-danger/10 px-2 py-2 text-xs font-semibold text-danger"
          onClick={() => onDelete(ticket.id)}
        >
          מחיקה
        </button>
      </div>
    </article>
  );
}

export interface TicketsDataTableProps {
  tickets: Ticket[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectPage: (select: boolean) => void;
  onPageChange: (page: number) => void;
  onEdit: (ticket: Ticket) => void;
  onMarkClosed: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TicketsDataTable({
  tickets,
  total,
  page,
  pageSize,
  isLoading,
  selectedIds,
  onToggleSelect,
  onSelectPage,
  onPageChange,
  onEdit,
  onMarkClosed,
  onDelete
}: TicketsDataTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allOnPageSelected =
    tickets.length > 0 && tickets.every((t) => selectedIds.has(t.id));
  const someOnPageSelected = tickets.some((t) => selectedIds.has(t.id));

  const headerCbRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = headerCbRef.current;
    if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
  }, [someOnPageSelected, allOnPageSelected, tickets.length]);

  return (
    <div className="md3-table-shell lux-card overflow-hidden p-0">
      <div className="space-y-3 p-3 md:hidden">
        {isLoading ? (
          <div className="rounded-2xl bg-white/80 px-4 py-8 text-center text-sm text-on-surface-variant">
            טוען נתונים…
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-2xl bg-white/80 px-4 py-8 text-center text-sm text-on-surface-variant">
            אין פניות להצגה לפי המסננים שנבחרו.
          </div>
        ) : (
          tickets.map((ticket) => (
            <MobileTicketCard
              key={ticket.id}
              ticket={ticket}
              selected={selectedIds.has(ticket.id)}
              onToggleSelect={onToggleSelect}
              onEdit={onEdit}
              onMarkClosed={onMarkClosed}
              onDelete={onDelete}
            />
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="md3-table w-full min-w-[1180px] border-collapse text-right text-sm">
          <thead>
            <tr className="border-b border-outline bg-surface-high/95 text-xs font-semibold text-on-surface-variant">
              <th className="sticky top-0 z-10 w-10 bg-surface-high/95 px-3 py-3">
                <input
                  ref={headerCbRef}
                  type="checkbox"
                  className="size-4 cursor-pointer accent-primary"
                  checked={allOnPageSelected}
                  onChange={(e) => onSelectPage(e.target.checked)}
                  aria-label="בחר את כל השורות בעמוד"
                />
              </th>
              <th className="sticky top-0 z-10 bg-surface-high/95 px-3 py-3">תאריך</th>
              <th className="sticky top-0 z-10 bg-surface-high/95 px-3 py-3">שולח</th>
              <th className="sticky top-0 z-10 bg-surface-high/95 px-3 py-3">אימייל</th>
              <th className="sticky top-0 z-10 bg-surface-high/95 px-3 py-3">נושא</th>
              <th className="sticky top-0 z-10 bg-surface-high/95 px-3 py-3">תוכן הפנייה</th>
              <th className="sticky top-0 z-10 bg-surface-high/95 px-3 py-3">קטגוריה</th>
              <th className="sticky top-0 z-10 bg-surface-high/95 px-3 py-3">סטטוס</th>
              <th className="sticky top-0 z-10 bg-surface-high/95 px-3 py-3">תגיות</th>
              <th className="sticky top-0 z-10 bg-surface-high/95 px-3 py-3">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-on-surface-variant">
                  טוען נתונים…
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-on-surface-variant">
                  אין פניות להצגה לפי המסננים שנבחרו.
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => {
                const when = displayTicketDate(ticket).toLocaleString("he-IL", {
                  dateStyle: "short",
                  timeStyle: "short"
                });
                const tagLine = ticket.tags.length ? ticket.tags.join(", ") : "—";
                const preview = contentPreview(ticket);
                return (
                  <tr
                    key={ticket.id}
                    className="md3-table-row border-b border-outline/70 transition-colors hover:bg-primary-soft/40"
                  >
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="checkbox"
                        className="size-4 cursor-pointer accent-primary"
                        checked={selectedIds.has(ticket.id)}
                        onChange={() => onToggleSelect(ticket.id)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-middle text-xs text-on-surface-variant">
                      {when}
                    </td>
                    <td className="max-w-[8rem] truncate px-3 py-2 align-middle text-xs">
                      {ticket.senderName || "—"}
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-2 align-middle">
                      <Link
                        href={`/customer/${encodeURIComponent(ticket.senderEmail)}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {ticket.senderEmail}
                      </Link>
                    </td>
                    <td className="max-w-[14rem] px-3 py-2 align-middle">
                      <span className="line-clamp-2 text-xs leading-snug">{ticket.subject}</span>
                    </td>
                    <td className="max-w-[24rem] px-3 py-2 align-middle" title={preview}>
                      <div className="space-y-1">
                        <p className="line-clamp-2 text-xs font-medium leading-snug text-on-surface">
                          {ticket.aiSummary || ticket.subject}
                        </p>
                        <p className="line-clamp-3 text-xs leading-snug text-on-surface-variant">
                          {preview}
                        </p>
                        {ticket.closureNote ? (
                          <p className="line-clamp-2 text-[11px] leading-snug text-on-surface-variant">
                            הערת סגירה: {ticket.closureNote}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <CategoryBadge category={ticket.category} />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <StatusChip status={ticket.status} />
                    </td>
                    <td
                      className="max-w-[9rem] truncate px-3 py-2 align-middle text-xs text-on-surface-variant"
                      title={tagLine}
                    >
                      {tagLine}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <button
                          type="button"
                          className="md3-icon-btn"
                          title="סמן כטופל"
                          onClick={() => onMarkClosed(ticket.id)}
                        >
                          <CheckCheck className="size-4" />
                        </button>
                        <button
                          type="button"
                          className="md3-icon-btn"
                          title="עריכה"
                          onClick={() => onEdit(ticket)}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          className="md3-icon-btn text-danger"
                          title="מחיקה"
                          onClick={() => onDelete(ticket.id)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline bg-surface-high/90 px-4 py-3 text-xs text-on-surface-variant">
        <span>
          מציג {(page - 1) * pageSize + 1}–
          {Math.min(page * pageSize, total)} מתוך {total.toLocaleString("he-IL")}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="md3-pager-btn"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            הקודם
          </button>
          <span className="tabular-nums">
            עמוד {page}/{totalPages}
          </span>
          <button
            type="button"
            className="md3-pager-btn"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            הבא
          </button>
        </div>
      </div>
    </div>
  );
}
