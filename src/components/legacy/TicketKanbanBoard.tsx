"use client";

import { CheckCheck, CircleDot, Pencil, Trash2 } from "lucide-react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { categoryLabel } from "@/lib/categories";
import { displayTicketDate } from "@/lib/ticket-row";
import type { Ticket, TicketStatus } from "@/lib/types";

type KanbanColumn = {
  id: string;
  label: string;
  tickets: Ticket[];
};

interface TicketKanbanBoardProps {
  tickets: Ticket[];
  isLoading: boolean;
  onEdit: (ticket: Ticket) => void;
  onDelete: (id: string) => void;
  onSetStatus: (id: string, status: TicketStatus) => void;
  onMarkClosed: (id: string) => void;
}

function ticketPreview(ticket: Ticket): string {
  return (ticket.body || ticket.aiSummary || "אין תוכן להצגה")
    .replace(/\s+/g, " ")
    .trim();
}

function statusLabel(status: TicketStatus): string {
  if (status === "in_progress") return "בטיפול";
  if (status === "closed") return "סגור";
  return "פתוח";
}

function buildColumns(tickets: Ticket[]): KanbanColumn[] {
  const order = ["bugs", "premium", "suggestions", "artist", "copyright", "spam"];
  const map = new Map<string, Ticket[]>();

  for (const ticket of tickets) {
    const key = ticket.category || "uncategorized";
    if (!map.has(key)) map.set(key, []);
    map.get(key)?.push(ticket);
  }

  const keys = [
    ...order.filter((key) => map.has(key)),
    ...Array.from(map.keys())
      .filter((key) => !order.includes(key))
      .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b), "he"))
  ];

  return keys.map((key) => ({
    id: key,
    label: categoryLabel(key),
    tickets: map.get(key) ?? []
  }));
}

function KanbanCard({
  ticket,
  onEdit,
  onDelete,
  onSetStatus,
  onMarkClosed
}: {
  ticket: Ticket;
  onEdit: (ticket: Ticket) => void;
  onDelete: (id: string) => void;
  onSetStatus: (id: string, status: TicketStatus) => void;
  onMarkClosed: (id: string) => void;
}) {
  const when = displayTicketDate(ticket).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short"
  });
  const preview = ticketPreview(ticket);

  return (
    <article className="rounded-lg border border-outline/70 bg-white p-2 transition hover:border-primary/30">
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="text-[10px] text-on-surface-variant">{when}</span>
        <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-medium text-on-surface-variant">
          {statusLabel(ticket.status)}
        </span>
      </div>

      <h3 className="line-clamp-1 text-[12px] font-bold leading-snug text-on-surface">
        {ticket.subject}
      </h3>
      <p className="mt-0.5 line-clamp-1 text-[11px] text-on-surface-variant">
        {ticket.senderName || "ללא שם"} · {ticket.senderEmail || "ללא אימייל"}
      </p>

      <div className="mt-1.5 rounded-lg bg-surface-container/70 p-1.5">
        <p className="line-clamp-1 text-[11px] font-semibold leading-snug text-on-surface">
          {ticket.aiSummary || ticket.subject}
        </p>
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-on-surface-variant">
          {preview}
        </p>
        {ticket.closureNote ? (
          <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-on-surface-variant">
            הערת סגירה: {ticket.closureNote}
          </p>
        ) : null}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <CategoryBadge category={ticket.category} />
      </div>

      <div className="mt-1.5 grid grid-cols-4 gap-1">
        <button
          type="button"
          className="inline-flex min-h-7 items-center justify-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-1 py-1 text-[10px] font-semibold text-amber-950"
          onClick={() => onSetStatus(ticket.id, "in_progress")}
        >
          <CircleDot className="size-3" />
          בטיפול
        </button>
        <button
          type="button"
          className="inline-flex min-h-7 items-center justify-center gap-1 rounded-lg border border-success/30 bg-success/10 px-1 py-1 text-[10px] font-semibold text-success"
          onClick={() => onMarkClosed(ticket.id)}
        >
          <CheckCheck className="size-3" />
          טופל
        </button>
        <button
          type="button"
          className="inline-flex min-h-7 items-center justify-center gap-1 rounded-lg border border-outline bg-white px-1 py-1 text-[10px] font-semibold text-on-surface"
          onClick={() => onEdit(ticket)}
        >
          <Pencil className="size-3" />
          עריכה
        </button>
        <button
          type="button"
          className="inline-flex min-h-7 items-center justify-center gap-1 rounded-lg border border-danger/30 bg-danger/10 px-1 py-1 text-[10px] font-semibold text-danger"
          onClick={() => onDelete(ticket.id)}
        >
          <Trash2 className="size-3" />
          מחיקה
        </button>
      </div>
    </article>
  );
}

export function TicketKanbanBoard({
  tickets,
  isLoading,
  onEdit,
  onDelete,
  onSetStatus,
  onMarkClosed
}: TicketKanbanBoardProps) {
  const columns = buildColumns(tickets);

  if (isLoading) {
    return (
      <div className="lux-card rounded-2xl px-4 py-12 text-center text-sm text-on-surface-variant">
        טוען פניות…
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="lux-card rounded-2xl px-4 py-12 text-center text-sm text-on-surface-variant">
        אין פניות להצגה לפי המסננים שנבחרו.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid min-w-full gap-1.5 lg:auto-cols-[minmax(12.5rem,1fr)] lg:grid-flow-col lg:grid-cols-none">
        {columns.map((column) => (
          <section
            key={column.id}
            className="flex max-h-[78vh] min-h-[12rem] flex-col rounded-xl border border-outline/70 bg-surface-high/90"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-xl border-b border-outline/70 bg-surface-high/95 px-2.5 py-1.5 backdrop-blur">
              <h3 className="text-xs font-bold text-on-surface">{column.label}</h3>
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">
                {column.tickets.length.toLocaleString("he-IL")}
              </span>
            </div>
            <div className="space-y-1.5 overflow-y-auto p-1.5">
              {column.tickets.map((ticket) => (
                <KanbanCard
                  key={ticket.id}
                  ticket={ticket}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onSetStatus={onSetStatus}
                  onMarkClosed={onMarkClosed}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
