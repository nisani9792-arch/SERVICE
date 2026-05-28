"use client";

import { memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TicketListRow } from "@/components/TicketListRow";
import { buildVirtualListRows, type VirtualListRow } from "@/lib/ticket-list-utils";
import type { Ticket } from "@/lib/types";

const GROUP_ROW_HEIGHT = 22;
const TICKET_ROW_HEIGHT = 36;

function rowHeight(row: VirtualListRow): number {
  return row.kind === "group" ? GROUP_ROW_HEIGHT : TICKET_ROW_HEIGHT;
}

export interface VirtualTicketListProps {
  tickets: Ticket[];
  activeTicketId: string | null;
  selectedIds: Set<string>;
  onSelect: (ticket: Ticket) => void;
  onToggleSelect: (id: string) => void;
}

function VirtualTicketListInner({
  tickets,
  activeTicketId,
  selectedIds,
  onSelect,
  onToggleSelect
}: VirtualTicketListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rows = buildVirtualListRows(tickets);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => rowHeight(rows[index]),
    overscan: 6
  });

  return (
    <div
      ref={parentRef}
      className="crm-virtual-list h-full min-h-0 overflow-y-auto overscroll-contain p-1"
    >
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={row.key}
              className="absolute left-0 right-0 px-0.5"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              {row.kind === "group" ? (
                <h3 className="sticky top-0 z-[1] mb-1 rounded-lg bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant backdrop-blur-sm">
                  {row.label}
                </h3>
              ) : (
                <TicketListRow
                  ticket={row.ticket}
                  listMode="default"
                  active={activeTicketId === row.ticket.id}
                  selected={selectedIds.has(row.ticket.id)}
                  onSelect={onSelect}
                  onToggleSelect={onToggleSelect}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const VirtualTicketList = memo(VirtualTicketListInner);
