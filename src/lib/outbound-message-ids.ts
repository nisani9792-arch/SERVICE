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

export async function isReplyToOurOutbound(
  inReplyTo: string | null,
  references: string[]
): Promise<boolean> {
  const candidates = new Set<string>();
  const replyTo = normalizeMessageId(inReplyTo);
  if (replyTo) candidates.add(replyTo);
  for (const ref of references) {
    const normalized = normalizeMessageId(ref);
    if (normalized) candidates.add(normalized);
  }
  if (candidates.size === 0) return false;

  await ensureTable();
  const ids = Array.from(candidates);
  const rows = await sql()`
    SELECT message_id
    FROM outbound_email_message_ids
    WHERE message_id = ANY(${ids}::text[])
    LIMIT 1
  `;
  return rows.length > 0;
}

/** Skip threaded replies — only brand-new inbound messages become tickets. */
export function isThreadReplyMessage(inReplyTo: string | null, references: string[]): boolean {
  return Boolean(inReplyTo) || references.length > 0;
}
