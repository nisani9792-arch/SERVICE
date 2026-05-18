import type { gmail_v1 } from "googleapis";
import { getGmailApiClient, isGmailApiConfigured } from "@/lib/gmail-api";
import {
  ensureEmailIngestSchema,
  getIngestSettings,
  htmlToText,
  importKeyFor,
  normalizeMessageId,
  processInboundEmailMessage,
  recordProcessResult,
  type EmailIngestResult,
  type ParsedEmailMessage
} from "@/lib/email-ingest";

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function headerValue(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string {
  const match = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return String(match?.value ?? "").trim();
}

function parseReferences(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((ref) => normalizeMessageId(ref))
    .filter((ref): ref is string => Boolean(ref));
}

function parseFromHeader(raw: string): { email: string; name: string } {
  const trimmed = raw.trim();
  const named = trimmed.match(/^(.*)<([^>]+)>$/);
  if (named) {
    return {
      name: named[1].replace(/(^["']|["']$)/g, "").trim(),
      email: named[2].trim().toLowerCase()
    };
  }
  const emailOnly = trimmed.match(/([^\s<>]+@[^\s<>]+)/);
  return {
    name: "",
    email: (emailOnly?.[1] ?? trimmed).trim().toLowerCase()
  };
}

function extractBodyFromPart(part: gmail_v1.Schema$MessagePart): string {
  if (part.body?.data) {
    const decoded = decodeBase64Url(part.body.data);
    if (part.mimeType?.toLowerCase().includes("html")) {
      return htmlToText(decoded);
    }
    return decoded;
  }

  if (!part.parts?.length) return "";

  const plain = part.parts.find((p) => p.mimeType === "text/plain");
  if (plain) {
    const text = extractBodyFromPart(plain);
    if (text.trim()) return text;
  }

  const html = part.parts.find((p) => p.mimeType === "text/html");
  if (html) {
    const text = extractBodyFromPart(html);
    if (text.trim()) return text;
  }

  for (const child of part.parts) {
    const nested = extractBodyFromPart(child);
    if (nested.trim()) return nested;
  }

  return "";
}

function parseGmailApiMessage(
  gmailId: string,
  data: gmail_v1.Schema$Message
): ParsedEmailMessage | null {
  const headers = data.payload?.headers;
  const from = parseFromHeader(headerValue(headers, "From"));
  if (!from.email) return null;

  const subject = headerValue(headers, "Subject") || "(ללא נושא)";
  const messageId = normalizeMessageId(headerValue(headers, "Message-ID"));
  const inReplyTo = normalizeMessageId(headerValue(headers, "In-Reply-To"));
  const references = parseReferences(headerValue(headers, "References"));
  const body = extractBodyFromPart(data.payload ?? {}).slice(0, 30000);
  const internalMs = Number(data.internalDate);
  const messageAt = Number.isFinite(internalMs)
    ? new Date(internalMs).toISOString()
    : null;

  return {
    importKey: importKeyFor(messageId, `gmail:${gmailId}`),
    messageId,
    mailboxUid: `gmail:${gmailId}`,
    inReplyTo,
    references,
    senderEmail: from.email,
    senderName: from.name,
    subject,
    body,
    messageAt,
    attachments: []
  };
}

function isInsufficientScopeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /insufficient|scope|403|permission/i.test(message);
}

export function isGmailApiIngestConfigured(): boolean {
  return isGmailApiConfigured();
}

export async function ingestInboxViaGmailApi(): Promise<EmailIngestResult> {
  if (!isGmailApiIngestConfigured()) {
    throw new Error(
      "Gmail API לא מוגדר לייבוא. הוסף GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN."
    );
  }

  await ensureEmailIngestSchema();
  const settings = getIngestSettings();
  const gmail = getGmailApiClient();

  const result: EmailIngestResult = {
    ok: true,
    scanned: 0,
    imported: 0,
    reopened: 0,
    skipped: 0,
    archived: 0,
    archiveMailbox: "Gmail API (הסרת תווית INBOX)",
    errors: [],
    skipReasons: [],
    provider: "gmail_api"
  };

  const listResponse = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX"],
    q: `newer_than:${settings.lookbackDays}d`,
    maxResults: settings.maxMessages
  });

  const stubs = listResponse.data.messages ?? [];
  if (stubs.length === 0) {
    return result;
  }

  const toArchive: string[] = [];

  for (const stub of stubs) {
    const gmailId = stub.id;
    if (!gmailId) continue;

    result.scanned += 1;

    try {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: gmailId,
        format: "full"
      });

      const message = parseGmailApiMessage(gmailId, full.data);
      if (!message) {
        result.skipped += 1;
        continue;
      }

      const processed = await processInboundEmailMessage(message, {
        ownerEmail: settings.ownerEmail,
        sourceTag: settings.sourceTag
      });

      recordProcessResult(result, processed);
      if (processed.imported) result.imported += 1;
      if (processed.reopened) result.reopened += 1;
      if (processed.skipped) result.skipped += 1;
      if (processed.shouldArchive) toArchive.push(gmailId);
    } catch (error) {
      result.skipped += 1;
      result.errors.push(
        error instanceof Error ? error.message : "Gmail API message processing failed"
      );
      result.skipReasons?.push("error");
    }
  }

  for (const gmailId of toArchive) {
    try {
      await gmail.users.messages.modify({
        userId: "me",
        id: gmailId,
        requestBody: { removeLabelIds: ["INBOX"] }
      });
      result.archived += 1;
    } catch (error) {
      result.errors.push(
        `Archive failed for ${gmailId}: ${error instanceof Error ? error.message : "unknown"}`
      );
    }
  }

  return result;
}

export function gmailApiIngestScopeHint(): string {
  return "הרץ: python scripts/gmail_mailer.py auth-only — עם הרשאות gmail.readonly ו-gmail.modify, והעתק GMAIL_REFRESH_TOKEN חדש ל-Render.";
}

export { isInsufficientScopeError };
