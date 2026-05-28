import { latestCustomerFollowUp } from "@/lib/customer-followup-text";
import type { Ticket } from "@/lib/types";

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Short list-row preview: real inquiry text first, not AI classification labels. */
export function listInquiryPreview(ticket: Ticket, maxLen = 160): string {
  const rawBody = ticket.bodyCleaned || ticket.body || "";
  const followUp = latestCustomerFollowUp(rawBody);
  if (followUp && followUp.text.length >= 4) {
    const preview = collapse(followUp.text);
    const prefix = "תשובת לקוח: ";
    return (prefix + preview).slice(0, maxLen);
  }

  const body = collapse(rawBody);
  const subject = collapse(ticket.subject || "");
  const summary = collapse(ticket.aiSummary || "");

  if (body.length >= 8) return body.slice(0, maxLen);
  if (subject.length >= 4) return subject.slice(0, maxLen);
  if (summary.length >= 8 && !/^פנייה (חדשה|כללית)/i.test(summary)) {
    return summary.slice(0, maxLen);
  }
  return subject || summary || "פנייה ללא תוכן";
}

/** Outbox row: show operator resolution note when available. */
export function listOutboxPreview(ticket: Ticket, maxLen = 180): string {
  const note = (ticket.closureNote || "").replace(/\s+/g, " ").trim();
  if (note.length >= 12) {
    const prefix = ticket.tags.includes("REPLIED") ? "נענה: " : "נסגר: ";
    return (prefix + note).slice(0, maxLen);
  }
  return listInquiryPreview(ticket, maxLen);
}
