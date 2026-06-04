import { formatTicketNumber } from "@/lib/ticket-sequence";
import type { Ticket } from "@/lib/types";

export function scoreTicketSearch(ticket: Ticket, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;

  const subject = (ticket.subject || "").toLowerCase();
  const email = (ticket.senderEmail || "").toLowerCase();
  const name = (ticket.senderName || "").toLowerCase();
  const body = (ticket.body || "").toLowerCase().slice(0, 800);
  const number =
    ticket.ticketNumber != null ? formatTicketNumber(ticket.ticketNumber).toLowerCase() : "";
  const category = (ticket.category || "").toLowerCase();

  let score = 0;
  if (number.includes(q) || q.includes(number.replace("#", ""))) score += 120;
  if (email.includes(q)) score += 90;
  if (subject.includes(q)) score += 70;
  if (name.includes(q)) score += 50;
  if (category.includes(q)) score += 40;
  if (body.includes(q)) score += 25;

  const tokens = q.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (subject.includes(token)) score += 12;
    if (email.includes(token)) score += 10;
    if (body.includes(token)) score += 4;
  }

  return score;
}

export function filterTicketsForPalette(tickets: Ticket[], query: string, limit = 12): Ticket[] {
  const q = query.trim();
  if (!q) return tickets.slice(0, limit);

  return tickets
    .map((ticket) => ({ ticket, score: scoreTicketSearch(ticket, q) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.ticket);
}
