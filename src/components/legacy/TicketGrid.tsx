import { TicketCard } from "./TicketCard";
import { Ticket } from "@/lib/types";

interface TicketGridProps {
  tickets: Ticket[];
  selectedIds: Set<string>;
  onToggleSelect: (ticketId: string) => void;
  onMarkHandled: (ticketId: string) => void;
  onEdit: (ticket: Ticket) => void;
  onDelete: (ticketId: string) => void;
  isLoading: boolean;
}

export function TicketGrid({
  tickets,
  selectedIds,
  onToggleSelect,
  onMarkHandled,
  onEdit,
  onDelete,
  isLoading
}: TicketGridProps) {
  const selectionActive = selectedIds.size > 0;

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="lux-card h-52 animate-pulse bg-surface-container" />
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="lux-card p-6 text-center text-sm text-on-surface-variant">
        לא נמצאו פניות לפי הסינון הנוכחי.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {tickets.map((ticket) => (
        <TicketCard
          key={ticket.id}
          ticket={ticket}
          selected={selectedIds.has(ticket.id)}
          selectionActive={selectionActive}
          onToggleSelect={onToggleSelect}
          onMarkHandled={onMarkHandled}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
