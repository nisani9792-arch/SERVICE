import { formatTicketNumber } from "@/lib/ticket-sequence";
import { bodyForAiPrompt } from "@/lib/message-filter";

export type TicketReplyContextInput = {
  ticketNumber?: number | null;
  subject: string;
  body?: string | null;
  bodyCleaned?: string | null;
  aiSummary?: string | null;
  messageAt?: string | null;
  createdAt?: string | null;
};

function inquiryExcerpt(ticket: TicketReplyContextInput): string {
  const body = bodyForAiPrompt(String(ticket.body ?? ""), ticket.bodyCleaned);
  const summary = String(ticket.aiSummary ?? "").trim();
  const subject = String(ticket.subject ?? "").trim();
  const raw = body || summary || subject;
  return raw.replace(/\s+/g, " ").trim().slice(0, 140);
}

function formatInquiryDate(ticket: TicketReplyContextInput): string {
  const iso = ticket.messageAt || ticket.createdAt;
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

/** Block inserted into outbound reply so the customer sees which ticket is answered. */
export function buildInquiryContextBlock(ticket: TicketReplyContextInput): string {
  const num = ticket.ticketNumber;
  const numLabel = num != null && Number.isInteger(num) ? formatTicketNumber(num) : "ללא מספר";
  const subject = String(ticket.subject ?? "").trim() || "ללא נושא";
  const excerpt = inquiryExcerpt(ticket) || subject;
  const dateLabel = formatInquiryDate(ticket);
  const datePart = dateLabel ? ` · ${dateLabel}` : "";

  return `-----\nפנייה ${numLabel}${datePart} בנושא ${subject} — ${excerpt}\n-----`;
}

export function defaultReplyEmailSubject(): string {
  return "בהמשך לפנייתך";
}
