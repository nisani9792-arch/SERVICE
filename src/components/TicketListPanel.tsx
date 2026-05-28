"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { TicketListRow, type TicketListMode } from "@/components/TicketListRow";
import { VirtualTicketList } from "@/components/VirtualTicketList";
import { dayGroupLabel } from "@/lib/ticket-list-utils";
import type { Ticket } from "@/lib/types";

function useDesktopVirtualList() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const apply = () => setEnabled(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return enabled;
}

export interface TicketListPanelProps {
  tickets: Ticket[];
  activeTicketId: string | null;
  selectedIds: Set<string>;
  listMode?: TicketListMode;
  onSelect: (ticket: Ticket) => void;
  onToggleSelect: (id: string) => void;
}

/** Stable grouped list — avoids virtualizer layout loops that freeze mobile browsers. */
function TicketListPanelInner({
  tickets,
  activeTicketId,
  selectedIds,
  listMode = "default",
  onSelect,
  onToggleSelect
}: TicketListPanelProps) {
  const useVirtual = useDesktopVirtualList();

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

  if (useVirtual && tickets.length > 30) {
    return (
      <VirtualTicketList
        tickets={tickets}
        activeTicketId={activeTicketId}
        selectedIds={selectedIds}
        onSelect={onSelect}
        onToggleSelect={onToggleSelect}
      />
    );
  }

  return (
    <div className="crm-inbox-list divide-y divide-slate-100">
      {groups.map(([label, groupTickets]) => (
        <section key={label}>
          <h3 className="sticky top-0 z-[1] bg-slate-50/95 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400 backdrop-blur-sm">
            {label}
          </h3>
          <div>
            {groupTickets.map((ticket) => (
              <TicketListRow
                key={ticket.id}
                ticket={ticket}
                listMode={listMode}
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
