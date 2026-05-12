import { TicketCard } from "@/components/TicketCard";
import { Ticket } from "@/lib/types";

interface TicketGridProps {
  tickets: Ticket[];
  onMarkHandled: (ticketId: string) => void;
  onEdit: (ticket: Ticket) => void;
  onDelete: (ticketId: string) => void;
  isLoading: boolean;
}

export function TicketGrid({
  tickets,
  onMarkHandled,
  onEdit,
  onDelete,
  isLoading
}: TicketGridProps) {
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
          onMarkHandled={onMarkHandled}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
