import { sql } from "@/lib/neon";

let tableReady = false;

function normalizeMessageId(value: string | null | undefined): string | null {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/^<|>$/g, "")
    .toLowerCase();
  return cleaned || null;
}

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await sql()`
    CREATE TABLE IF NOT EXISTS outbound_email_message_ids (
      message_id   TEXT PRIMARY KEY,
      ticket_id    TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql()`
    CREATE INDEX IF NOT EXISTS idx_outbound_email_message_ids_created
    ON outbound_email_message_ids (created_at DESC)
  `;
  tableReady = true;
}

export function createOutboundMessageId(fromAddress: string): string {
  const domain = fromAddress.split("@")[1]?.toLowerCase() || "service.local";
  return `${crypto.randomUUID()}@${domain}`;
}

export async function recordOutboundMessageId(
  messageId: string,
  ticketId?: string | null
): Promise<void> {
  const normalized = normalizeMessageId(messageId);
  if (!normalized) return;

  await ensureTable();
  await sql()`
    INSERT INTO outbound_email_message_ids (message_id, ticket_id)
    VALUES (${normalized}, ${ticketId ?? null})
    ON CONFLICT (message_id) DO NOTHING
  `;
}

export function collectThreadMessageIds(
  inReplyTo: string | null,
  references: string[]
): string[] {
  const candidates = new Set<string>();
  const replyTo = normalizeMessageId(inReplyTo);
  if (replyTo) candidates.add(replyTo);
  for (const ref of references) {
    const normalized = normalizeMessageId(ref);
    if (normalized) candidates.add(normalized);
  }
  return Array.from(candidates);
}

/** True when headers reference a message we sent (customer follow-up candidate). */
export async function isReplyToOurOutbound(
  inReplyTo: string | null,
  references: string[]
): Promise<boolean> {
  const ids = collectThreadMessageIds(inReplyTo, references);
  if (ids.length === 0) return false;

  await ensureTable();
  const rows = await sql()`
    SELECT message_id
    FROM outbound_email_message_ids
    WHERE message_id = ANY(${ids})
    LIMIT 1
  `;
  return rows.length > 0;
}

/** Resolve parent ticket from In-Reply-To / References (outbound ids or original inbound Message-ID). */
export async function findTicketIdForInboundThread(messageIds: string[]): Promise<string | null> {
  if (messageIds.length === 0) return null;

  await ensureTable();
  const outboundRows = await sql()`
    SELECT ticket_id
    FROM outbound_email_message_ids
    WHERE message_id = ANY(${messageIds})
      AND ticket_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (outboundRows.length > 0) {
    const ticketId = (outboundRows[0] as { ticket_id: string | null }).ticket_id;
    if (ticketId) return String(ticketId);
  }

  const ticketRows = await sql()`
    SELECT id
    FROM tickets
    WHERE email_message_id IS NOT NULL
      AND lower(replace(replace(trim(email_message_id), '<', ''), '>', '')) = ANY(${messageIds})
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  if (ticketRows.length > 0) {
    return String((ticketRows[0] as { id: string }).id);
  }

  return null;
}

