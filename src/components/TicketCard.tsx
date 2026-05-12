"use client";

import { CheckCheck, Pencil, Trash2 } from "lucide-react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Ticket } from "@/lib/types";

interface TicketCardProps {
  ticket: Ticket;
  selected: boolean;
  selectionActive: boolean;
  onToggleSelect: (ticketId: string) => void;
  onMarkHandled: (ticketId: string) => void;
  onEdit: (ticket: Ticket) => void;
  onDelete: (ticketId: string) => void;
}

const PriorityDots = ({ priority }: { priority: Ticket["priority"] }) => {
  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((dot) => (
        <span
          key={dot}
          className={`size-1.5 rounded-full ${
            dot <= priority ? "bg-primary" : "bg-outline"
          }`}
        />
      ))}
    </div>
  );
};

export function TicketCard({
  ticket,
  selected,
  selectionActive,
  onToggleSelect,
  onMarkHandled,
  onEdit,
  onDelete
}: TicketCardProps) {
  const createdAt = new Date(ticket.createdAt).toLocaleDateString("he-IL");

  return (
    <article
      className={`lux-card flex min-h-52 flex-col p-4 transition ${
        selected ? "ring-2 ring-primary ring-offset-2" : ""
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(ticket.id)}
            className={`mt-1 size-4 shrink-0 cursor-pointer accent-primary ${
              selectionActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
            style={selectionActive ? undefined : { opacity: undefined }}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{ticket.senderEmail}</p>
            <p className="mt-1 truncate text-sm text-on-surface-variant">
              {ticket.subject}
            </p>
          </div>
        </div>
        <CategoryBadge category={ticket.category} />
      </div>

      <p className="mb-3 max-h-10 overflow-hidden text-sm text-on-surface-variant">
        {ticket.aiSummary}
      </p>

      <div className="mb-4 flex items-center justify-between text-xs text-on-surface-variant">
        <PriorityDots priority={ticket.priority} />
        <span>{createdAt}</span>
      </div>

      <div className="mt-auto grid grid-cols-3 gap-2">
        <button
          onClick={() => onMarkHandled(ticket.id)}
          className="lux-button px-2 py-1.5 text-xs"
        >
          <CheckCheck className="ml-1 size-3.5" />
          טופל
        </button>
        <button
          onClick={() => onEdit(ticket)}
          className="lux-button px-2 py-1.5 text-xs"
        >
          <Pencil className="ml-1 size-3.5" />
          עריכה
        </button>
        <button
          onClick={() => onDelete(ticket.id)}
          className="inline-flex items-center justify-center rounded-lg border border-rose-200 px-2 py-1.5 text-xs text-rose-700 transition hover:bg-rose-50"
        >
          <Trash2 className="ml-1 size-3.5" />
          מחיקה
        </button>
      </div>
    </article>
  );
}
