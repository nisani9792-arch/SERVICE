import { cleanMessageForAi } from "@/lib/message-filter";
import { sql } from "@/lib/neon";
import { saveTicketAttachments, type EmailAttachmentCandidate } from "@/lib/ticket-attachments";
import { CUSTOMER_FOLLOWUP_CATEGORY, PENDING_TRIAGE_CATEGORY } from "@/lib/triage";
import { collectThreadMessageIds, findTicketIdForInboundThread } from "@/lib/outbound-message-ids";
import { extractTicketNumbersFromText } from "@/lib/ticket-sequence";

export type InboundEmailForThread = {
  importKey: string;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  senderEmail: string;
  senderName: string;
  subject: string;
  body: string;
  messageAt: string | null;
  attachments: EmailAttachmentCandidate[];
};

export const CUSTOMER_FOLLOWUP_TAG = "CUSTOMER_FOLLOWUP";
export { CUSTOMER_FOLLOWUP_CATEGORY };

let schemaReady: Promise<void> | null = null;

export async function ensureTicketEmailThreadSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS ticket_email_messages (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          ticket_id TEXT NOT NULL,
          email_import_key TEXT NOT NULL,
          email_message_id TEXT,
          direction TEXT NOT NULL DEFAULT 'inbound_followup',
          body TEXT NOT NULL DEFAULT '',
          subject TEXT NOT NULL DEFAULT '',
          sender_email TEXT NOT NULL DEFAULT '',
          message_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql()`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_email_messages_import_key
        ON ticket_email_messages (email_import_key)
      `;
      await sql()`
        CREATE INDEX IF NOT EXISTS idx_ticket_email_messages_ticket
        ON ticket_email_messages (ticket_id, created_at DESC)
      `;
      await sql()`
        CREATE INDEX IF NOT EXISTS idx_ticket_email_messages_message_id
        ON ticket_email_messages (email_message_id)
        WHERE email_message_id IS NOT NULL
      `;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

export async function isInboundEmailAlreadyStored(importKey: string): Promise<boolean> {
  await ensureTicketEmailThreadSchema();

  const ticketRows = await sql()`
    SELECT id FROM tickets WHERE email_import_key = ${importKey} LIMIT 1
  `;
  if (ticketRows.length > 0) return true;

  const msgRows = await sql()`
    SELECT id FROM ticket_email_messages WHERE email_import_key = ${importKey} LIMIT 1
  `;
  return msgRows.length > 0;
}

export type AttachFollowUpResult = {
  attached: boolean;
  reopened: boolean;
  duplicate: boolean;
};

function formatFollowUpBlock(message: InboundEmailForThread): string {
  const when = message.messageAt
    ? new Date(message.messageAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })
    : new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
  const header = `---\n[תשובת לקוח · ${when}]\n`;
  return `${header}${message.body.trim()}\n`;
}

export async function attachInboundFollowUpToTicket(
  ticketId: string,
  message: InboundEmailForThread
): Promise<AttachFollowUpResult> {
  await ensureTicketEmailThreadSchema();

  const threadRows = await sql()`
    INSERT INTO ticket_email_messages (
      ticket_id,
      email_import_key,
      email_message_id,
      direction,
      body,
      subject,
      sender_email,
      message_at
    )
    VALUES (
      ${ticketId},
      ${message.importKey},
      ${message.messageId},
      ${"inbound_followup"},
      ${message.body},
      ${message.subject},
      ${message.senderEmail},
      ${message.messageAt},
      now()
    )
    ON CONFLICT (email_import_key) DO NOTHING
    RETURNING id
  `;

  if (threadRows.length === 0) {
    return { attached: false, reopened: false, duplicate: true };
  }

  const priorRows = await sql()`
    SELECT status FROM tickets WHERE id = ${ticketId} LIMIT 1
  `;
  const priorStatus = String((priorRows[0] as { status?: string } | undefined)?.status ?? "");
  const wasClosed = priorStatus === "closed" || priorStatus === "handled";

  const block = formatFollowUpBlock(message);
  const bodyCleaned = cleanMessageForAi(message.body);
  const followupTag = [CUSTOMER_FOLLOWUP_TAG];

  const updated = await sql()`
    UPDATE tickets
    SET
      body = COALESCE(body, '') || ${"\n\n" + block},
      body_cleaned = CASE
        WHEN ${bodyCleaned} = '' THEN COALESCE(body_cleaned, '')
        ELSE trim(COALESCE(body_cleaned, '') || E'\n\n' || ${bodyCleaned})
      END,
      category = CASE
        WHEN category = ${PENDING_TRIAGE_CATEGORY} THEN category
        ELSE ${CUSTOMER_FOLLOWUP_CATEGORY}
      END,
      status = CASE
        WHEN status IN ('closed', 'handled') THEN 'open'
        ELSE status
      END,
      message_at = GREATEST(
        COALESCE(message_at, created_at),
        COALESCE(${message.messageAt}::timestamptz, now())
      ),
      tags = COALESCE(
        (
          SELECT array_agg(DISTINCT e)
          FROM unnest(COALESCE(tags, '{}'::text[]) || ${followupTag}::text[]) AS e
        ),
        ${followupTag}::text[]
      ),
      ai_summary = CASE
        WHEN ai_summary IS NULL OR trim(ai_summary) = '' THEN ${"תשובת לקוח חדשה בשרשור."}
        ELSE left(ai_summary || E' · תשובת לקוח חדשה', 500)
      END,
      updated_at = now()
    WHERE id = ${ticketId}
    RETURNING id
  `;

  if (updated.length === 0) {
    return { attached: false, reopened: false, duplicate: false };
  }

  if (message.attachments.length > 0) {
    try {
      await saveTicketAttachments(ticketId, message.attachments);
    } catch (error) {
      console.error("[ticket-email-thread] attachment save failed", error);
    }
  }

  return { attached: true, reopened: wasClosed, duplicate: false };
}

/** Strip Re:/Fwd: and auto-reply prefixes (e.g. Google "צורפתם בהצלחה"). */
export function normalizeReplySubject(subject: string): string {
  let s = subject.trim();
  for (let i = 0; i < 6; i += 1) {
    const next = s
      .replace(/^(re|fwd|fw|השב|העבר)\s*:\s*/i, "")
      .replace(/^צורפתם בהצלחה\s*/i, "")
      .replace(/^you(?:'ve| have) been added successfully\s*/i, "")
      .replace(/^added successfully\s*/i, "")
      .trim();
    if (next === s) break;
    s = next;
  }
  return s.toLowerCase();
}

export function isLikelyThreadReply(subject: string, inReplyTo: string | null): boolean {
  if (inReplyTo?.trim()) return true;
  const s = subject.trim();
  if (/^\s*(re|fwd|fw|השב|העבר)\s*:/i.test(s)) return true;
  if (/צורפתם בהצלחה/i.test(s)) return true;
  if (/\b(re|השב)\s*:/i.test(s)) return true;
  return false;
}

async function findTicketIdByNumber(ticketNumber: number): Promise<string | null> {
  const rows = await sql()`
    SELECT id FROM tickets WHERE ticket_number = ${ticketNumber} LIMIT 1
  `;
  if (rows.length === 0) return null;
  return String((rows[0] as { id: string }).id);
}

async function findTicketIdBySenderReplySubject(
  message: InboundEmailForThread
): Promise<string | null> {
  if (!isLikelyThreadReply(message.subject, message.inReplyTo)) return null;

  const normalizedIncoming = normalizeReplySubject(message.subject);
  if (normalizedIncoming.length < 4) return null;

  const senderEmail = message.senderEmail.trim().toLowerCase();
  if (!senderEmail.includes("@")) return null;

  const rows = await sql()`
    SELECT id, subject
    FROM tickets
    WHERE lower(trim(sender_email)) = ${senderEmail}
    ORDER BY COALESCE(message_at, updated_at) DESC
    LIMIT 40
  `;

  for (const row of rows) {
    const ticketSubject = String((row as { subject: string }).subject ?? "");
    const normalizedTicket = normalizeReplySubject(ticketSubject);
    if (!normalizedTicket) continue;

    if (normalizedTicket === normalizedIncoming) {
      return String((row as { id: string }).id);
    }

    const minLen = Math.min(normalizedTicket.length, normalizedIncoming.length);
    if (minLen >= 8) {
      if (
        normalizedTicket.includes(normalizedIncoming) ||
        normalizedIncoming.includes(normalizedTicket)
      ) {
        return String((row as { id: string }).id);
      }
    }
  }

  return null;
}

async function resolveTicketFromEmailHeaders(
  message: InboundEmailForThread
): Promise<string | null> {
  const headerIds = collectThreadMessageIds(message.inReplyTo, message.references);
  if (headerIds.length === 0) return null;

  const fromOutbound = await findTicketIdForInboundThread(headerIds);
  if (fromOutbound) return fromOutbound;

  await ensureTicketEmailThreadSchema();
  const fromThread = await sql()`
    SELECT ticket_id
    FROM ticket_email_messages
    WHERE email_message_id IS NOT NULL
      AND lower(replace(replace(trim(email_message_id), '<', ''), '>', '')) = ANY(${headerIds})
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (fromThread.length > 0) {
    return String((fromThread[0] as { ticket_id: string }).ticket_id);
  }

  return null;
}

export async function resolveTicketForInboundThread(
  message: InboundEmailForThread
): Promise<string | null> {
  const searchText = `${message.subject}\n${message.body.slice(0, 2000)}`;
  const ticketNumbers = extractTicketNumbersFromText(searchText);
  for (const num of ticketNumbers) {
    const byNumber = await findTicketIdByNumber(num);
    if (byNumber) return byNumber;
  }

  const fromHeaders = await resolveTicketFromEmailHeaders(message);
  if (fromHeaders) return fromHeaders;

  const fromSubject = await findTicketIdBySenderReplySubject(message);
  if (fromSubject) return fromSubject;

  return null;
}

export async function tryAttachInboundThreadMessage(
  message: InboundEmailForThread
): Promise<AttachFollowUpResult & { ticketId: string | null }> {
  const ticketId = await resolveTicketForInboundThread(message);
  if (!ticketId) {
    return { ticketId: null, attached: false, reopened: false, duplicate: false };
  }

  const result = await attachInboundFollowUpToTicket(ticketId, message);
  return { ticketId, ...result };
}
