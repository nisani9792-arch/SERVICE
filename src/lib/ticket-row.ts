import { Ticket, TicketPriority, TicketSource, TicketStatus } from "@/lib/types";

function normalizeStatus(raw: string | null | undefined): TicketStatus {
  const s = String(raw ?? "open").toLowerCase();
  if (s === "handled" || s === "closed") return "closed";
  if (s === "in_progress" || s === "in progress") return "in_progress";
  return "open";
}

function coercePriority(p: unknown): TicketPriority {
  const n = Number(p);
  if (Number.isInteger(n) && n >= 1 && n <= 5) return n as TicketPriority;
  return 3;
}

function parseTags(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim()).filter(Boolean);
  }
  return [];
}

export function rowToTicket(r: Record<string, unknown>): Ticket {
  return {
    id: String(r.id),
    senderEmail: String(r.sender_email ?? ""),
    senderName: String(r.sender_name ?? ""),
    subject: String(r.subject ?? ""),
    body: String(r.body ?? ""),
    category: String(r.category ?? "suggestions"),
    priority: coercePriority(r.priority),
    aiSummary: String(r.ai_summary ?? ""),
    status: normalizeStatus(r.status as string),
    source: (String(r.source ?? "manual") as TicketSource) || "manual",
    tags: parseTags(r.tags),
    assignedTo: String(r.assigned_to ?? ""),
    closureNote: String(r.closure_note ?? ""),
    messageAt: r.message_at ? String(r.message_at) : null,
    emailMessageId: r.email_message_id ? String(r.email_message_id) : undefined,
    emailMailboxUid: r.email_mailbox_uid ? String(r.email_mailbox_uid) : undefined,
    emailIngestedAt: r.email_ingested_at ? String(r.email_ingested_at) : null,
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? "")
  };
}

export function displayTicketDate(ticket: Ticket): Date {
  const primary = ticket.messageAt ?? ticket.createdAt;
  return new Date(primary);
}
