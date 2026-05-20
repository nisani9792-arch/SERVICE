"use client";

import { memo } from "react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { listInquiryPreview } from "@/lib/inquiry-preview";
import { displayTicketDate } from "@/lib/ticket-row";
import { formatTicketNumber } from "@/lib/ticket-sequence";
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

function formatWhen(ticket: Ticket): string {
  return displayTicketDate(ticket).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

export interface TicketListRowProps {
  ticket: Ticket;
  active: boolean;
  selected: boolean;
  onSelect: (ticket: Ticket) => void;
  onToggleSelect: (id: string) => void;
}

function TicketListRowInner({
  ticket,
  active,
  selected,
  onSelect,
  onToggleSelect
}: TicketListRowProps) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(ticket)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(ticket);
        }
      }}
      className={`relative cursor-pointer rounded-xl2 border p-2.5 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        active
          ? "border-primary/40 bg-primary-soft/50 shadow-glow-sm ring-1 ring-primary/20"
          : selected
            ? "border-primary/30 bg-primary-soft/30 shadow-glow-sm"
            : "border-outline/80 bg-white/60 backdrop-blur-md hover:border-primary/35 hover:bg-white/85 hover:shadow-glow-sm"
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
        <RowContent ticket={ticket} />
      </div>
    </article>
  );
}

function RowContent({ ticket }: { ticket: Ticket }) {
  return (
    <div className="min-w-0 flex-1 text-right">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-on-surface-variant">
          {ticket.ticketNumber != null ? (
            <span className="rounded-md bg-surface-container px-1.5 py-0.5 font-mono text-[10px] text-primary">
              {formatTicketNumber(ticket.ticketNumber)}
            </span>
          ) : null}
          {formatWhen(ticket)}
        </span>
        <span className="inline-flex items-center gap-1">
          <CategoryBadge category={ticket.category} />
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[ticket.status]}`}
          >
            {STATUS_LABELS[ticket.status]}
          </span>
        </span>
      </div>
      <h3 className="line-clamp-1 text-[13px] font-bold leading-snug text-on-surface">{ticket.subject}</h3>
      <p className="mt-0.5 line-clamp-1 text-[11px] text-on-surface-variant">
        {ticket.senderName || "ללא שם"} · {ticket.senderEmail || "ללא אימייל"}
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-snug text-on-surface-variant">
        {listInquiryPreview(ticket)}
      </p>
    </div>
  );
}

export const TicketListRow = memo(TicketListRowInner, (prev, next) => {
  return (
    prev.active === next.active &&
    prev.selected === next.selected &&
    prev.ticket.id === next.ticket.id &&
    prev.ticket.updatedAt === next.ticket.updatedAt &&
    prev.ticket.status === next.ticket.status &&
    prev.ticket.category === next.ticket.category &&
    prev.ticket.subject === next.ticket.subject &&
    prev.ticket.body === next.ticket.body
  );
});

TicketListRow.displayName = "TicketListRow";
