"use client";

import { memo } from "react";
import { Reply } from "lucide-react";
import { CompactCategoryChip } from "@/components/crm/CompactCategoryChip";
import { displayTicketDate } from "@/lib/ticket-row";
import { CUSTOMER_FOLLOWUP_CATEGORY } from "@/lib/triage";
import { cn } from "@/lib/cn";
import type { Ticket, TicketStatus } from "@/lib/types";

export type TicketListMode = "default" | "outbox";

export interface TicketListRowProps {
  ticket: Ticket;
  active: boolean;
  selected: boolean;
  listMode?: TicketListMode;
  onSelect: (ticket: Ticket) => void;
  onToggleSelect: (id: string) => void;
}

function formatRowDate(ticket: Ticket): string {
  return displayTicketDate(ticket).toLocaleString("he-IL", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function readDotClass(status: TicketStatus, isFollowUp: boolean): string {
  if (isFollowUp) return "bg-amber-500 ring-2 ring-amber-200";
  if (status === "open") return "bg-indigo-600";
  if (status === "in_progress") return "bg-amber-500";
  return "bg-slate-300";
}

function TicketListRowInner({
  ticket,
  active,
  selected,
  onSelect,
  onToggleSelect
}: TicketListRowProps) {
  const isFollowUp = ticket.category === CUSTOMER_FOLLOWUP_CATEGORY;
  const subject = (ticket.subject || ticket.aiSummary || "ללא נושא").trim();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(ticket)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(ticket);
        }
      }}
      className={cn(
        "crm-inbox-row group flex h-9 max-h-9 min-h-9 w-full items-center gap-1.5 border-b border-slate-100 px-1.5 text-right transition-colors",
        isFollowUp && "crm-inbox-row-followup",
        active && "crm-inbox-row-active",
        selected && !active && "bg-indigo-50/80"
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(ticket.id)}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "size-3 shrink-0 accent-indigo-600 transition group-hover:opacity-100 focus:opacity-100",
          selected ? "opacity-100" : "opacity-0"
        )}
        aria-label="בחר פנייה"
      />

      <span
        className={cn("size-2 shrink-0 rounded-full", readDotClass(ticket.status, isFollowUp))}
        aria-hidden
        title={isFollowUp ? "תשובת לקוח" : ticket.status}
      />

      {isFollowUp ? (
        <Reply className="size-3 shrink-0 text-amber-600 opacity-90" aria-hidden />
      ) : null}

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[12px] leading-none",
          ticket.status === "open" || isFollowUp ? "font-bold text-slate-900" : "font-medium text-slate-700"
        )}
        title={subject}
      >
        {subject}
      </span>

      <CompactCategoryChip category={ticket.category} />

      <time
        className="w-[4.25rem] shrink-0 truncate text-left text-[10px] tabular-nums leading-none text-slate-400"
        dateTime={displayTicketDate(ticket).toISOString()}
      >
        {formatRowDate(ticket)}
      </time>
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
    prev.ticket.subject === next.ticket.subject
  );
});

TicketListRow.displayName = "TicketListRow";
