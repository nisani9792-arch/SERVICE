import type { Attachment } from "mailparser";
import type { gmail_v1 } from "googleapis";
import { getEmailAttachmentConfig, isAllowedAttachmentMime } from "@/lib/email-attachment-config";
import { getGmailApiClient } from "@/lib/gmail-api";
import { sql } from "@/lib/neon";
import type { TicketAttachmentMeta } from "@/lib/types";

export type EmailAttachmentCandidate = {
  filename: string;
  contentType: string;
  sizeBytes: number;
  content: Buffer;
};

const MIN_ATTACHMENT_BYTES = 400;
const BASE64_CHUNK_BYTES = 24_576;

/** Encode buffer to base64 in chunks to reduce peak memory during large attachments. */
export function bufferToBase64Chunked(buffer: Buffer): string {
  if (buffer.length <= BASE64_CHUNK_BYTES) {
    return buffer.toString("base64");
  }
  const parts: string[] = [];
  for (let offset = 0; offset < buffer.length; offset += BASE64_CHUNK_BYTES) {
    parts.push(buffer.subarray(offset, offset + BASE64_CHUNK_BYTES).toString("base64"));
  }
  return parts.join("");
}

function decodeBase64Url(data: string): Buffer {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}

function filenameFromPart(part: gmail_v1.Schema$MessagePart, contentType: string): string {
  if (part.filename?.trim()) return part.filename.trim();
  return contentType.startsWith("image/") ? "image" : "video";
}

function collectGmailMimeParts(
  part: gmail_v1.Schema$MessagePart | undefined,
  out: gmail_v1.Schema$MessagePart[]
): void {
  if (!part) return;
  if (part.body?.attachmentId || (part.filename && part.body?.data)) {
    out.push(part);
  }
  for (const child of part.parts ?? []) {
    collectGmailMimeParts(child, out);
  }
}

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

    const sizeHint = Number(attachment.size ?? 0);
    if (sizeHint > 0 && sizeHint < MIN_ATTACHMENT_BYTES) continue;
    if (sizeHint > config.maxBytesPerFile) continue;

    const contentType = String(attachment.contentType ?? "application/octet-stream").trim();
    if (!isAllowedAttachmentMime(contentType, config)) continue;

    const content = Buffer.isBuffer(attachment.content)
      ? attachment.content
      : attachment.content
        ? Buffer.from(attachment.content)
        : Buffer.alloc(0);

    const sizeBytes = content.length || sizeHint;
    if (sizeBytes < MIN_ATTACHMENT_BYTES) continue;
    if (sizeBytes > config.maxBytesPerFile) continue;

    const filename =
      String(attachment.filename ?? "").trim() ||
      (contentType.startsWith("image/") ? "image" : "video");

    accepted.push({ filename, contentType, sizeBytes, content });
  }

  return accepted;
}

/** Fetch image/video attachment bodies from a Gmail API message. */
export async function fetchGmailAttachmentBodies(
  messageId: string,
  payload: gmail_v1.Schema$MessagePart | undefined
): Promise<EmailAttachmentCandidate[]> {
  const config = getEmailAttachmentConfig();
  if (!config.enabled || !payload) return [];

  const gmail = getGmailApiClient();
  const parts: gmail_v1.Schema$MessagePart[] = [];
  collectGmailMimeParts(payload, parts);

  const accepted: EmailAttachmentCandidate[] = [];

  for (const part of parts) {
    if (accepted.length >= config.maxFilesPerEmail) break;

    const contentType = String(part.mimeType ?? "application/octet-stream").trim();
    if (!isAllowedAttachmentMime(contentType, config)) continue;

    let content = Buffer.alloc(0);
    if (part.body?.data) {
      content = decodeBase64Url(part.body.data);
    } else if (part.body?.attachmentId) {
      try {
        const res = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId,
          id: part.body.attachmentId
        });
        if (res.data.data) {
          content = decodeBase64Url(res.data.data);
        }
      } catch {
        continue;
      }
    }

    const sizeBytes = content.length;
    if (sizeBytes < MIN_ATTACHMENT_BYTES) continue;
    if (sizeBytes > config.maxBytesPerFile) continue;

    accepted.push({
      filename: filenameFromPart(part, contentType),
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
    const base64 = bufferToBase64Chunked(attachment.content);
    attachment.content = Buffer.alloc(0);

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
        ${base64}
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
