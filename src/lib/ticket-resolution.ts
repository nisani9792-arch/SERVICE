/** Ticket was closed by an operator (reply sent, closure note, etc.). */
export function isTicketOperatorResolved(ticket: {
  status?: string;
  closureNote?: string;
  closure_note?: string;
  tags?: string[] | null;
  category?: string;
}): boolean {
  const note = String(ticket.closureNote ?? ticket.closure_note ?? "").trim();
  if (note.length > 0) return true;

  const tags = ticket.tags ?? [];
  if (tags.includes("REPLIED")) return true;

  const category = String(ticket.category ?? "").trim().toLowerCase();
  if (category === "handled") return true;

  return false;
}

export function isTicketClosedStatus(status: string | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return s === "closed" || s === "handled";
}
