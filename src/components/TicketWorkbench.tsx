"use client";

import Link from "next/link";
import {
  CheckCheck,
  CircleDot,
  ExternalLink,
  Pencil,
  Save,
  Send,
  Tag,
  Trash2
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

function StatusChip({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
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
  const focusedTicket = activeTicket ?? tickets[0] ?? null;

  return (
    <section className="grid min-h-0 gap-2 xl:grid-cols-[minmax(0,1fr),minmax(22rem,0.62fr)]">
      <div className="min-w-0 rounded-2xl border border-outline/70 bg-white/95">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline/70 px-3 py-2">
          <div>
            <h2 className="text-sm font-bold text-on-surface">{title}</h2>
            <p className="text-[11px] text-on-surface-variant">
              {subtitle ?? `${total.toLocaleString("he-IL")} תוצאות מסודרות לעבודה`}
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
            <div className="space-y-1.5">
              {tickets.map((ticket) => {
                const active = focusedTicket?.id === ticket.id;
                const selected = selectedIds.has(ticket.id);
                return (
                  <article
                    key={ticket.id}
                    className={`rounded-xl border p-2 transition ${
                      active
                        ? "border-primary/60 bg-primary-soft/35"
                        : selected
                          ? "border-primary/30 bg-primary-soft/20"
                          : "border-outline/70 bg-white hover:border-primary/35"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggleSelect(ticket.id)}
                        className="mt-1 size-4 shrink-0 accent-primary"
                        aria-label="בחר פנייה"
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-right"
                        onClick={() => onSetActiveTicket(ticket)}
                      >
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
                      </button>
                    </div>
                  </article>
                );
              })}
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

      <aside className="min-w-0 rounded-2xl border border-outline/70 bg-white/95">
        {focusedTicket ? (
          <div className="flex max-h-[72vh] min-h-[20rem] flex-col">
            <div className="border-b border-outline/70 px-3 py-2">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <CategoryBadge category={focusedTicket.category} />
                  <StatusChip status={focusedTicket.status} />
                </div>
                <span className="text-[11px] text-on-surface-variant">{formatWhen(focusedTicket)}</span>
              </div>
              <h2 className="text-base font-bold leading-snug text-on-surface">
                {focusedTicket.subject}
              </h2>
              <p className="mt-1 text-xs text-on-surface-variant">
                {focusedTicket.senderName || "ללא שם"} ·{" "}
                {focusedTicket.senderEmail ? (
                  <Link
                    href={`/customer/${encodeURIComponent(focusedTicket.senderEmail)}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {focusedTicket.senderEmail}
                  </Link>
                ) : (
                  "ללא אימייל"
                )}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              <div className="rounded-xl bg-surface-container/70 p-3">
                <p className="text-xs font-semibold leading-snug text-on-surface">
                  {focusedTicket.aiSummary || focusedTicket.subject}
                </p>
              </div>
              <div className="mt-2 whitespace-pre-wrap rounded-xl border border-outline/70 bg-white p-3 text-sm leading-relaxed text-on-surface">
                {focusedTicket.body || "אין תוכן להצגה"}
              </div>
              {focusedTicket.closureNote ? (
                <div className="mt-2 rounded-xl bg-success/10 p-3 text-xs leading-relaxed text-success">
                  הערת סגירה: {focusedTicket.closureNote}
                </div>
              ) : null}
            </div>

            <div className="space-y-2 border-t border-outline/70 p-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-xs font-bold text-amber-950"
                  onClick={() => onSetStatus(focusedTicket.id, "in_progress")}
                >
                  <CircleDot className="size-3.5" />
                  העבר לטיפול
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-primary/25 bg-primary-soft px-2 py-2 text-xs font-bold text-primary"
                  onClick={() => onReply(focusedTicket)}
                >
                  <Send className="size-3.5" />
                  מענה ללקוח
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-outline bg-white px-2 py-2 text-xs font-bold text-on-surface"
                  onClick={() => onSaveInquiry(focusedTicket)}
                >
                  <Save className="size-3.5" />
                  שמירת הפנייה
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-success/30 bg-success/10 px-2 py-2 text-xs font-bold text-success"
                  onClick={() => onMarkClosed(focusedTicket.id)}
                >
                  <CheckCheck className="size-3.5" />
                  טיפול וסגירה
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-outline bg-white px-2 py-2 text-xs font-bold text-on-surface"
                  onClick={() => onEdit(focusedTicket)}
                >
                  <Pencil className="size-3.5" />
                  עריכה מלאה
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-danger/30 bg-danger/10 px-2 py-2 text-xs font-bold text-danger"
                  onClick={() => onDelete(focusedTicket.id)}
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
                    value={focusedTicket.category}
                    onChange={(event) => onChangeCategory(focusedTicket.id, event.target.value)}
                  >
                    {ACTIVE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {categoryLabel(category)}
                      </option>
                    ))}
                  </select>
                </label>
                <Link
                  href={`/customer/${encodeURIComponent(focusedTicket.senderEmail)}`}
                  className="inline-flex items-end justify-center gap-1 rounded-xl border border-outline bg-white px-3 py-2 text-xs font-bold text-on-surface hover:bg-surface-container"
                >
                  <ExternalLink className="size-3.5" />
                  היסטוריה
                </Link>
              </div>

              {focusedTicket.tags.length > 0 ? (
                <p className="inline-flex flex-wrap items-center gap-1 text-[11px] text-on-surface-variant">
                  <Tag className="size-3" />
                  {focusedTicket.tags.join(", ")}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="px-4 py-12 text-center text-sm text-on-surface-variant">
            בחר פנייה מהרשימה כדי לראות פרטים ופעולות.
          </div>
        )}
      </aside>
    </section>
  );
}
