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

  if (isFollowUp) return "bg-warning ring-2 ring-warning/30";

  if (status === "open") return "bg-primary";

  if (status === "in_progress") return "bg-warning";

  return "bg-on-surface-variant/40";

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

        "crm-inbox-row group flex min-h-[48px] w-full items-center gap-1.5 border-b border-outline/20 px-1.5 text-right transition-colors md:h-9 md:max-h-9 md:min-h-9",

        isFollowUp && "crm-inbox-row-followup",

        active && "crm-inbox-row-active bg-primary-soft/60",

        selected && !active && "bg-surface-high/80"

      )}

    >

      <label

        className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center md:min-h-0 md:min-w-0"

        onClick={(event) => event.stopPropagation()}

      >

        <input

          type="checkbox"

          checked={selected}

          onChange={() => onToggleSelect(ticket.id)}

          className={cn(

            "size-4 accent-primary transition group-hover:opacity-100 focus:opacity-100 md:size-3",

            selected ? "opacity-100" : "opacity-0"

          )}

          aria-label="בחר פנייה"

        />

      </label>



      <span

        className={cn("size-2 shrink-0 rounded-full", readDotClass(ticket.status, isFollowUp))}

        aria-hidden

        title={isFollowUp ? "תשובת לקוח" : ticket.status}

      />



      {isFollowUp ? (

        <Reply className="size-3 shrink-0 text-warning opacity-90" aria-hidden />

      ) : null}



      <span

        className={cn(

          "min-w-0 flex-1 truncate text-[12px] leading-none",

          ticket.status === "open" || isFollowUp

            ? "font-semibold text-on-surface"

            : "font-medium text-on-surface-variant"

        )}

        title={subject}

      >

        {subject}

      </span>



      <CompactCategoryChip category={ticket.category} />



      <time

        className="w-[4.25rem] shrink-0 truncate text-left text-[10px] tabular-nums leading-none text-on-surface-variant/70"

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

    prev.ticket.subject === next.ticket.subject &&

    prev.ticket.aiSummary === next.ticket.aiSummary

  );

});



TicketListRow.displayName = "TicketListRow";

