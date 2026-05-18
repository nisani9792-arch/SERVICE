"use client";

import { memo, useMemo } from "react";
import { TicketListRow } from "@/components/TicketListRow";
import { dayGroupLabel } from "@/lib/ticket-list-utils";
import type { Ticket } from "@/lib/types";

export interface TicketListPanelProps {
  tickets: Ticket[];
  activeTicketId: string | null;
  selectedIds: Set<string>;
  onSelect: (ticket: Ticket) => void;
  onToggleSelect: (id: string) => void;
}

/** Stable grouped list — avoids virtualizer layout loops that freeze mobile browsers. */
function TicketListPanelInner({
  tickets,
  activeTicketId,
  selectedIds,
  onSelect,
  onToggleSelect
}: TicketListPanelProps) {
  const groups = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    for (const ticket of tickets) {
      const label = dayGroupLabel(ticket);
      const bucket = map.get(label) ?? [];
      bucket.push(ticket);
      map.set(label, bucket);
    }
    return Array.from(map.entries());
  }, [tickets]);

  return (
    <div className="space-y-3 p-1">
      {groups.map(([label, groupTickets]) => (
        <section key={label}>
          <h3 className="sticky top-0 z-[1] mb-1.5 rounded-lg bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
            {label}
          </h3>
          <div className="space-y-1.5">
            {groupTickets.map((ticket) => (
              <TicketListRow
                key={ticket.id}
                ticket={ticket}
                active={activeTicketId === ticket.id}
                selected={selectedIds.has(ticket.id)}
                onSelect={onSelect}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export const TicketListPanel = memo(TicketListPanelInner);
