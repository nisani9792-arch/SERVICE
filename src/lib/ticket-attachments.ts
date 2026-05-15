import type { Attachment } from "mailparser";
import { getEmailAttachmentConfig, isAllowedAttachmentMime } from "@/lib/email-attachment-config";
import { sql } from "@/lib/neon";
import type { TicketAttachmentMeta } from "@/lib/types";

export type EmailAttachmentCandidate = {
  filename: string;
  contentType: string;
  sizeBytes: number;
  content: Buffer;
};

const MIN_ATTACHMENT_BYTES = 400;

export async function ensureTicketAttachmentsSchema(): Promise<void> {
  await sql()`
    CREATE TABLE IF NOT EXISTS ticket_attachments (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      ticket_id     TEXT NOT NULL,
      filename      TEXT NOT NULL DEFAULT 'attachment',
      content_type  TEXT NOT NULL DEFAULT 'application/octet-stream',
      size_bytes    INTEGER NOT NULL DEFAULT 0,
      content_base64 TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql()`CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON ticket_attachments (ticket_id)`;
}

export function extractAttachmentsFromParsedMail(
  attachments: Attachment[] | undefined
): EmailAttachmentCandidate[] {
  const config = getEmailAttachmentConfig();
  if (!config.enabled || !attachments?.length) return [];

  const accepted: EmailAttachmentCandidate[] = [];

  for (const attachment of attachments) {
    if (accepted.length >= config.maxFilesPerEmail) break;

    const content = Buffer.isBuffer(attachment.content)
      ? attachment.content
      : attachment.content
        ? Buffer.from(attachment.content)
        : Buffer.alloc(0);

    const sizeBytes = content.length || Number(attachment.size ?? 0);
    if (sizeBytes < MIN_ATTACHMENT_BYTES) continue;
    if (sizeBytes > config.maxBytesPerFile) continue;

    const contentType = String(attachment.contentType ?? "application/octet-stream").trim();
    if (!isAllowedAttachmentMime(contentType, config)) continue;

    const filename =
      String(attachment.filename ?? "").trim() ||
      (contentType.startsWith("image/") ? "image" : "video");

    accepted.push({
      filename,
      contentType,
      sizeBytes,
      content
    });
  }

  return accepted;
}

export async function saveTicketAttachments(
  ticketId: string,
  attachments: EmailAttachmentCandidate[]
): Promise<number> {
  if (attachments.length === 0) return 0;
  await ensureTicketAttachmentsSchema();

  let saved = 0;
  for (const attachment of attachments) {
    const rows = await sql()`
      INSERT INTO ticket_attachments (
        ticket_id,
        filename,
        content_type,
        size_bytes,
        content_base64
      )
      VALUES (
        ${ticketId},
        ${attachment.filename},
        ${attachment.contentType},
        ${attachment.sizeBytes},
        ${attachment.content.toString("base64")}
      )
      RETURNING id
    `;
    if (rows.length > 0) saved += 1;
  }

  return saved;
}

export async function listTicketAttachments(ticketId: string): Promise<TicketAttachmentMeta[]> {
  await ensureTicketAttachmentsSchema();
  const rows = await sql()`
    SELECT id, ticket_id, filename, content_type, size_bytes, created_at
    FROM ticket_attachments
    WHERE ticket_id = ${ticketId}
    ORDER BY created_at ASC
  `;

  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    const id = String(r.id);
    const tid = String(r.ticket_id);
    return {
      id,
      ticketId: tid,
      filename: String(r.filename ?? "attachment"),
      contentType: String(r.content_type ?? "application/octet-stream"),
      sizeBytes: Number(r.size_bytes ?? 0),
      url: `/api/tickets/${tid}/attachments/${id}`
    };
  });
}

export async function getTicketAttachmentContent(
  ticketId: string,
  attachmentId: string
): Promise<{ filename: string; contentType: string; buffer: Buffer } | null> {
  await ensureTicketAttachmentsSchema();
  const rows = await sql()`
    SELECT filename, content_type, content_base64
    FROM ticket_attachments
    WHERE ticket_id = ${ticketId}
      AND id = ${attachmentId}
    LIMIT 1
  `;

  const row = rows[0] as
    | { filename: string; content_type: string; content_base64: string }
    | undefined;
  if (!row?.content_base64) return null;

  return {
    filename: String(row.filename ?? "attachment"),
    contentType: String(row.content_type ?? "application/octet-stream"),
    buffer: Buffer.from(row.content_base64, "base64")
  };
}
