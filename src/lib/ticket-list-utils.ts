import { displayTicketDate } from "@/lib/ticket-row";
import type { Ticket } from "@/lib/types";

export function dayGroupLabel(ticket: Ticket): string {
  const date = displayTicketDate(ticket);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);

  if (diffDays === 0) return "היום";
  if (diffDays === 1) return "אתמול";
  if (diffDays < 7) return "השבוע";
  return date.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

export type VirtualListRow =
  | { kind: "group"; key: string; label: string }
  | { kind: "ticket"; key: string; ticket: Ticket };

export function buildVirtualListRows(tickets: Ticket[]): VirtualListRow[] {
  const rows: VirtualListRow[] = [];
  let lastGroup = "";

  for (const ticket of tickets) {
    const label = dayGroupLabel(ticket);
    if (label !== lastGroup) {
      rows.push({ kind: "group", key: `g-${label}`, label });
      lastGroup = label;
    }
    rows.push({ kind: "ticket", key: ticket.id, ticket });
  }

  return rows;
}
