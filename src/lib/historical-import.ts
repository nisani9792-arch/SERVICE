import type { HistoricalTicketJson } from "@/lib/types";
import type { TicketStatus } from "@/lib/types";

/**
 * Spam-like categories are archived/closed on import (incl. PR/Media style labels).
 */
export function isSpamLikeCategory(category: string): boolean {
  const c = category.trim().toLowerCase().replace(/\s+/g, "_");
  if (c === "spam") return true;
  if (c.includes("pr/media") || c.includes("pr_media")) return true;
  if (c.includes("media_request")) return true;
  return false;
}

export function statusForImportedCategory(category: string): TicketStatus {
  return isSpamLikeCategory(category) ? "closed" : "open";
}

export interface PreparedHistoricalRow {
  senderEmail: string;
  senderName: string;
  subject: string;
  body: string;
  category: string;
  priority: number;
  summary: string;
  status: TicketStatus;
  messageAt: string | null;
}

export function prepareHistoricalRecord(raw: HistoricalTicketJson): PreparedHistoricalRow | null {
  const senderEmail = String(raw.email ?? "").trim();
  const subject = String(raw.subject ?? "").trim();
  const summary = String(raw.summary ?? "").trim();
  const body = summary || "(ללא תוכן)";
  if (!senderEmail || !subject) return null;

  const senderName = String(raw.sender_name ?? "").trim();
  const category = String(raw.category ?? "Customer_Support").trim() || "Customer_Support";

  let messageAt: string | null = null;
  if (raw.date) {
    const ms = Date.parse(raw.date);
    if (Number.isNaN(ms)) return null;
    messageAt = new Date(ms).toISOString();
  }

  return {
    senderEmail,
    senderName,
    subject,
    body,
    category,
    priority: 3,
    summary: summary || subject,
    status: statusForImportedCategory(category),
    messageAt
  };
}

export function prepareHistoricalBatch(records: HistoricalTicketJson[]): PreparedHistoricalRow[] {
  const out: PreparedHistoricalRow[] = [];
  for (const r of records) {
    const row = prepareHistoricalRecord(r);
    if (row) out.push(row);
  }
  return out;
}
