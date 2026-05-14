"use client";

import { useMemo, useState } from "react";
import { GripVertical, Pencil, RefreshCw } from "lucide-react";
import { ACTIVE_CATEGORIES, categoryLabel } from "@/lib/categories";
import { displayTicketDate } from "@/lib/ticket-row";
import type { Ticket } from "@/lib/types";

const SORTABLE_CATEGORIES = ACTIVE_CATEGORIES.filter(
  (category) => category !== "spam" && category !== "Spam"
);

function preview(ticket: Ticket): string {
  return (ticket.body || ticket.aiSummary || ticket.subject)
    .replace(/\s+/g, " ")
    .trim();
}

interface TriageInboxProps {
  tickets: Ticket[];
  isLoading: boolean;
  total: number;
  onEdit: (ticket: Ticket) => void;
  onMoveToCategory: (ticketId: string, category: string) => Promise<void>;
  onRefresh: () => void;
}

export function TriageInbox({
  tickets,
  isLoading,
  total,
  onEdit,
  onMoveToCategory,
  onRefresh
}: TriageInboxProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropCategory, setDropCategory] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const visibleTickets = useMemo(() => tickets.slice(0, 18), [tickets]);

  const move = async (ticketId: string, category: string) => {
    setMovingId(ticketId);
    try {
      await onMoveToCategory(ticketId, category);
    } finally {
      setMovingId(null);
      setDraggedId(null);
      setDropCategory(null);
    }
  };

  return (
    <aside className="lux-card flex max-h-[78vh] min-h-[18rem] flex-col overflow-hidden rounded-2xl border border-outline/70 bg-white/95 p-0">
      <div className="border-b border-outline/70 bg-surface-high/95 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-on-surface">פניות חדשות למיון</h2>
            <p className="text-[11px] text-on-surface-variant">
              {total.toLocaleString("he-IL")} פתוחות בקטגוריה כללית
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-outline bg-white px-2 py-1 text-[11px] font-semibold text-on-surface-variant hover:bg-surface-container"
          >
            <RefreshCw className="size-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 border-b border-outline/70 bg-surface-container/40 p-2">
        {SORTABLE_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onDragOver={(event) => {
              event.preventDefault();
              setDropCategory(category);
            }}
            onDragLeave={() => setDropCategory(null)}
            onDrop={(event) => {
              event.preventDefault();
              if (draggedId) void move(draggedId, category);
            }}
            className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${
              dropCategory === category
                ? "border-primary bg-primary-soft text-primary"
                : "border-outline bg-white text-on-surface-variant hover:border-primary/40"
            }`}
            title={`גרור לכאן כדי לסווג כ${categoryLabel(category)}`}
          >
            {categoryLabel(category)}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {isLoading ? (
          <p className="rounded-xl bg-surface-container px-3 py-6 text-center text-xs text-on-surface-variant">
            טוען פניות למיון…
          </p>
        ) : visibleTickets.length === 0 ? (
          <p className="rounded-xl bg-success/10 px-3 py-6 text-center text-xs font-semibold text-success">
            אין פניות חדשות למיון.
          </p>
        ) : (
          visibleTickets.map((ticket) => {
            const when = displayTicketDate(ticket).toLocaleDateString("he-IL", {
              day: "2-digit",
              month: "2-digit"
            });
            return (
              <article
                key={ticket.id}
                draggable
                onDragStart={() => setDraggedId(ticket.id)}
                onDragEnd={() => {
                  setDraggedId(null);
                  setDropCategory(null);
                }}
                className={`rounded-xl border bg-white p-2 text-right transition ${
                  draggedId === ticket.id
                    ? "border-primary bg-primary-soft/40"
                    : "border-outline/70 hover:border-primary/40"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-on-surface-variant">
                    <GripVertical className="size-3" />
                    {when}
                  </span>
                  <button
                    type="button"
                    onClick={() => onEdit(ticket)}
                    className="rounded-md border border-outline px-1.5 py-1 text-[10px] font-semibold text-on-surface-variant hover:bg-surface-container"
                  >
                    <Pencil className="size-3" />
                  </button>
                </div>
                <h3 className="line-clamp-1 text-[12px] font-bold leading-snug text-on-surface">
                  {ticket.subject}
                </h3>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-on-surface-variant">
                  {preview(ticket)}
                </p>
                <select
                  className="mt-2 w-full rounded-lg border border-outline bg-white px-2 py-1 text-[11px] outline-none focus:border-primary"
                  value=""
                  disabled={movingId === ticket.id}
                  onChange={(event) => {
                    if (event.target.value) void move(ticket.id, event.target.value);
                  }}
                >
                  <option value="">סווג במהירות…</option>
                  {SORTABLE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {categoryLabel(category)}
                    </option>
                  ))}
                </select>
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}
