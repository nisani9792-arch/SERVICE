import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import { repairEmailAddress } from "@/lib/email-address-repair";
import { PENDING_TRIAGE_CATEGORY } from "@/lib/triage";
import {
  extractAttachmentsFromParsedMail,
  saveTicketAttachments,
  type EmailAttachmentCandidate
} from "@/lib/ticket-attachments";
import { cleanMessageForAi } from "@/lib/message-filter";
import { classifyHybrid } from "@/lib/classification";
import {
  extractContactFormMessage,
  isWebsiteContactRelay,
  unwrapWebsiteContactRelay
} from "@/lib/contact-form-inquiry";
import { sql } from "@/lib/neon";
import { allocateNextTicketNumber } from "@/lib/ticket-sequence";
import { ensureTicketListColumns } from "@/lib/ticket-schema";
import { isGmailApiConfigured } from "@/lib/gmail-api";
import { ImapSession, isImapSessionConnectFailure } from "@/lib/imap-session";
import { runIngestExclusive } from "@/lib/email-ingest-lock";import {
  ensureTicketEmailThreadSchema,
  isInboundEmailAlreadyStored,
  tryAttachInboundThreadMessage
} from "@/lib/ticket-email-thread";
import { isTicketOperatorResolved } from "@/lib/ticket-resolution";

const DEFAULT_MAILBOX = "INBOX";
const DEFAULT_GMAIL_ARCHIVE_MAILBOX = "[Gmail]/All Mail";
const DEFAULT_LOOKBACK_DAYS = 14;
const DEFAULT_MAX_MESSAGES = 50;
const DEFAULT_SOURCE_TAG = "EDITOR";
const DEFAULT_INGEST_TIMEOUT_MS = 90000;

const SYSTEM_SENDER_DOMAINS = [
  "instagram.com",
  "mail.instagram.com",
  "facebook.com",
  "facebookmail.com",
  "google.com",
  "accounts.google.com",
  "workspace.google.com"
];

const SYSTEM_MESSAGE_PATTERNS = [
  /google workspace/i,
  /admin alert/i,
  /monthly security/i,
  /data protection insights/i,
  /jusic_2025/i,
  /instagram/i,
  /אינסטגרם/i,
  /חשבון google/i,
  /unsubscribe/i,
  /newsletter/i,
  /mailing list/i
];

type GmailConfig = {
  user: string;
  appPassword: string;
  host: string;
  port: number;
  mailbox: string;
  archiveMailbox: string;
  lookbackDays: number;
  maxMessages: number;
  sourceTag: string;
  timeoutMs: number;
};

export type ParsedEmailMessage = {
  importKey: string;
  messageId: string | null;
  mailboxUid: string;
  inReplyTo: string | null;
  references: string[];
  senderEmail: string;
  senderName: string;
  subject: string;
  body: string;
  messageAt: string | null;
  attachments: EmailAttachmentCandidate[];
  ingestTags?: string[];
};

type ForcedClassification = {
  category: string;
  priority: number;
  summary: string;
  status: "open" | "closed";
  aiSuggestedCategory?: string | null;
  classificationConfidence?: number | null;
  extraTags?: string[];
};

export type EmailIngestResult = {
  ok: true;
  scanned: number;
  imported: number;
  followupsAttached: number;
  reopened: number;
  skipped: number;
  archived: number;
  archiveMailbox: string;
  errors: string[];
  skipReasons?: string[];
  provider?: "gmail_api" | "imap";
};

export type IngestSettings = {
  ownerEmail: string;
  lookbackDays: number;
  maxMessages: number;
  sourceTag: string;
  timeoutMs: number;
};

import type { InboundSkipReason } from "@/lib/email-ingest-labels";
export type { InboundSkipReason } from "@/lib/email-ingest-labels";

export type InboundProcessResult = {
  imported: boolean;
  followupAttached: boolean;
  reopened: boolean;
  skipped: boolean;
  shouldArchive: boolean;
  skipReason?: InboundSkipReason;
  error?: string;
};

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function isImapConfigured(): boolean {
  const user = (process.env.EMAIL_IMAP_USER ?? process.env.GMAIL_USER)?.trim();
  const appPassword = (
    process.env.EMAIL_IMAP_APP_PASSWORD ?? process.env.GMAIL_APP_PASSWORD
  )
    ?.replace(/\s+/g, "")
    .trim();
  return Boolean(user && appPassword);
}

function getGmailConfig(): GmailConfig {
  const user = (process.env.EMAIL_IMAP_USER ?? process.env.GMAIL_USER)?.trim();
  const appPassword = (
    process.env.EMAIL_IMAP_APP_PASSWORD ?? process.env.GMAIL_APP_PASSWORD
  )
    ?.replace(/\s+/g, "")
    .trim();

  if (!user || !appPassword) {
    throw new Error("EMAIL_IMAP_USER and EMAIL_IMAP_APP_PASSWORD must be configured");
  }

  return {
    user,
    appPassword,
    host: (process.env.EMAIL_IMAP_HOST ?? process.env.GMAIL_IMAP_HOST)?.trim() || "imap.gmail.com",
    port: positiveInt(process.env.EMAIL_IMAP_PORT ?? process.env.GMAIL_IMAP_PORT, 993),
    mailbox: (process.env.EMAIL_IMAP_MAILBOX ?? process.env.GMAIL_MAILBOX)?.trim() || DEFAULT_MAILBOX,
    archiveMailbox:
      (process.env.EMAIL_IMAP_ARCHIVE_MAILBOX ?? process.env.GMAIL_ARCHIVE_MAILBOX)?.trim() || "",
    lookbackDays: positiveInt(process.env.EMAIL_INGEST_LOOKBACK_DAYS, DEFAULT_LOOKBACK_DAYS),
    maxMessages: positiveInt(process.env.EMAIL_INGEST_MAX_MESSAGES, DEFAULT_MAX_MESSAGES),
    sourceTag: process.env.EMAIL_INGEST_SOURCE_TAG?.trim() || DEFAULT_SOURCE_TAG,
    timeoutMs: positiveInt(process.env.EMAIL_INGEST_TIMEOUT_MS, DEFAULT_INGEST_TIMEOUT_MS)
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs / 1000}s`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function normalizeMessageId(value: string | null | undefined): string | null {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/^<|>$/g, "")
    .toLowerCase();
  return cleaned || null;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function bodyFromParsedMail(parsed: ParsedMail): string {
  const text = parsed.text?.trim();
  if (text) return text.slice(0, 30000);

  const html = typeof parsed.html === "string" ? htmlToText(parsed.html) : "";
  return html.slice(0, 30000);
}

function firstAddress(address: AddressObject | undefined): { email: string; name: string } {
  const first = address?.value?.[0];
  return {
    email: String(first?.address ?? "").trim().toLowerCase(),
    name: String(first?.name ?? "").trim()
  };
}

function senderFromParsedMail(parsed: ParsedMail): { email: string; name: string } {
  const from = firstAddress(parsed.from);
  if (from.email) return from;

  const replyTo = firstAddress(parsed.replyTo);
  if (replyTo.email) return replyTo;

  const headerFrom = String(parsed.headers.get("from") ?? "").trim();
  const match = headerFrom.match(/<?([^\s<>]+@[^\s<>]+)>?/);
  if (match?.[1]) {
    return { email: match[1].trim().toLowerCase(), name: from.name || replyTo.name };
  }

  return { email: "", name: from.name || replyTo.name };
}

export function importKeyFor(messageId: string | null, mailboxUid: string): string {
  return messageId ? `message-id:${messageId}` : `uid:${mailboxUid}`;
}

export function getIngestSettings(): IngestSettings {
  const ownerEmail = (
    process.env.EMAIL_IMAP_USER ??
    process.env.GMAIL_USER ??
    process.env.EMAIL_FROM
  )
    ?.trim()
    .toLowerCase();

  return {
    ownerEmail: ownerEmail ?? "",
    lookbackDays: positiveInt(process.env.EMAIL_INGEST_LOOKBACK_DAYS, DEFAULT_LOOKBACK_DAYS),
    maxMessages: positiveInt(process.env.EMAIL_INGEST_MAX_MESSAGES, DEFAULT_MAX_MESSAGES),
    sourceTag: process.env.EMAIL_INGEST_SOURCE_TAG?.trim() || DEFAULT_SOURCE_TAG,
    timeoutMs: positiveInt(process.env.EMAIL_INGEST_TIMEOUT_MS, DEFAULT_INGEST_TIMEOUT_MS)
  };
}

export async function processInboundEmailMessage(
  message: ParsedEmailMessage,
  ctx: { ownerEmail: string; sourceTag: string }
): Promise<InboundProcessResult> {
  message = applyWebsiteContactRelayUnwrap(message, ctx.ownerEmail);

  if (isSystemOrListMessage(message)) {
    return {
      imported: false,
      followupAttached: false,
      reopened: false,
      skipped: true,
      shouldArchive: true,
      skipReason: "system"
    };
  }

  if (isOwnOutgoingMessage(message, ctx.ownerEmail)) {
    return {
      imported: false,
      followupAttached: false,
      reopened: false,
      skipped: true,
      shouldArchive: true,
      skipReason: "own_outgoing"
    };
  }

  if (await isInboundEmailAlreadyStored(message.importKey)) {
    return {
      imported: false,
      followupAttached: false,
      reopened: false,
      skipped: true,
      shouldArchive: true,
      skipReason: "duplicate"
    };
  }

  const threadResult = await tryAttachInboundThreadMessage(message);
  if (threadResult.attached) {
    return {
      imported: false,
      followupAttached: true,
      reopened: threadResult.reopened,
      skipped: false,
      shouldArchive: true
    };
  }
  if (threadResult.duplicate) {
    return {
      imported: false,
      followupAttached: false,
      reopened: false,
      skipped: true,
      shouldArchive: true,
      skipReason: "duplicate"
    };
  }

  const existing = await findImportedTicket(message.importKey);
  if (existing) {
    const reopened = await reopenEmailTicketIfHidden(existing);
    return {
      imported: false,
      followupAttached: false,
      reopened,
      skipped: !reopened,
      shouldArchive: true,
      skipReason: reopened ? undefined : "duplicate"
    };
  }

  try {
    const { isSenderBlocked } = await import("@/lib/spam-sender");
    let classification = await resolveClassificationForMessage(message);
    if (await isSenderBlocked(message.senderEmail)) {
      classification = {
        category: "spam",
        priority: 1,
        summary: "שולח חסום — פנייה נסגרה אוטומטית.",
        status: "closed",
        aiSuggestedCategory: null,
        classificationConfidence: 1,
        extraTags: ["blocked_sender"]
      };
    }
    const insertResult = await insertEmailTicket(message, ctx.sourceTag, classification);

    if (insertResult.inserted) {
      return {
        imported: true,
        followupAttached: false,
        reopened: false,
        skipped: false,
        shouldArchive: true
      };
    }

    return {
      imported: false,
      followupAttached: false,
      reopened: false,
      skipped: true,
      shouldArchive: false,
      skipReason: "insert_conflict"
    };
  } catch (error) {
    return {
      imported: false,
      followupAttached: false,
      reopened: false,
      skipped: true,
      shouldArchive: false,
      skipReason: "error",
      error: error instanceof Error ? error.message : "Insert failed"
    };
  }
}

function senderDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

function isSystemOrListMessage(message: ParsedEmailMessage): boolean {
  const domain = senderDomain(message.senderEmail);
  if (SYSTEM_SENDER_DOMAINS.some((systemDomain) => domain === systemDomain || domain.endsWith(`.${systemDomain}`))) {
    return true;
  }

  if (/no-?reply|noreply|notification|workspace|accounts/i.test(message.senderEmail)) {
    return true;
  }

  const text = `${message.senderName} ${message.subject} ${message.body}`;
  return SYSTEM_MESSAGE_PATTERNS.some((pattern) => pattern.test(text));
}

function isOwnOutgoingMessage(message: ParsedEmailMessage, ownEmail: string): boolean {
  if (isWebsiteContactRelay(message.senderEmail, message.subject, message.body, ownEmail)) {
    return false;
  }
  return message.senderEmail.toLowerCase() === ownEmail.toLowerCase();
}

function applyWebsiteContactRelayUnwrap(
  message: ParsedEmailMessage,
  ownerEmail: string
): ParsedEmailMessage {
  const unwrapped = unwrapWebsiteContactRelay(
    message.senderEmail,
    message.senderName,
    message.subject,
    message.body,
    ownerEmail
  );
  if (!unwrapped) return message;

  return {
    ...message,
    senderEmail: unwrapped.senderEmail,
    senderName: unwrapped.senderName,
    subject: unwrapped.subject,
    body: unwrapped.body,
    ingestTags: [...(message.ingestTags ?? []), "WEBSITE_FORM"]
  };
}

function forcedClassificationFor(message: ParsedEmailMessage): ForcedClassification | null {
  const emptyBody = message.body.trim().length === 0;
  const emptySubject = message.subject === "(ללא נושא)" || message.subject.trim().length === 0;

  if (emptyBody && emptySubject) {
    return {
      category: "spam",
      priority: 1,
      summary: "מייל ריק שנכנס אוטומטית לספאם.",
      status: "closed"
    };
  }

  return null;
}

async function resolveClassificationForMessage(
  message: ParsedEmailMessage
): Promise<ForcedClassification> {
  const forced = forcedClassificationFor(message);
  if (forced) return forced;

  const bodyCleaned =
    extractContactFormMessage(message.body) || cleanMessageForAi(message.body);
  const hybrid = await classifyHybrid(message.senderEmail, message.subject, bodyCleaned);

  return {
    category: hybrid.category,
    priority: hybrid.priority,
    summary: hybrid.summary,
    status: hybrid.status,
    aiSuggestedCategory: hybrid.aiSuggestedCategory,
    classificationConfidence: hybrid.classificationConfidence,
    extraTags: hybrid.extraTags
  };
}

async function findImportedTicket(
  importKey: string
): Promise<{
  id: string;
  status: string;
  category: string;
  closure_note: string;
  tags: string[];
} | null> {
  const rows = await sql()`
    SELECT id, status, category, closure_note, tags
    FROM tickets
    WHERE email_import_key = ${importKey}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const row = rows[0] as {
    id: string;
    status: string;
    category: string;
    closure_note: string;
    tags: string[] | null;
  };
  return {
    id: String(row.id),
    status: String(row.status ?? ""),
    category: String(row.category ?? ""),
    closure_note: String(row.closure_note ?? ""),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : []
  };
}

/** Re-surface only hidden imports never handled by an operator. */
async function reopenEmailTicketIfHidden(
  ticket: NonNullable<Awaited<ReturnType<typeof findImportedTicket>>>
): Promise<boolean> {
  if (isTicketOperatorResolved(ticket)) return false;

  const rows = await sql()`
    UPDATE tickets
    SET status = 'open',
        updated_at = now()
    WHERE id = ${ticket.id}
      AND category = 'pending_triage'
      AND status IN ('closed', 'handled')
      AND (closure_note IS NULL OR trim(closure_note) = '')
      AND NOT (COALESCE(tags, '{}'::text[]) && ${["REPLIED"]}::text[])
    RETURNING id
  `;
  return rows.length > 0;
}

export async function ensureEmailIngestSchema(): Promise<void> {
  await ensureTicketListColumns();
  await ensureTicketEmailThreadSchema();
  await sql()`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_import_key TEXT`;
  await sql()`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_message_id TEXT`;
  await sql()`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_mailbox_uid TEXT`;
  await sql()`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_ingested_at TIMESTAMPTZ`;
  await sql()`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'`;
  await sql()`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_to TEXT NOT NULL DEFAULT ''`;
  await sql()`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closure_note TEXT NOT NULL DEFAULT ''`;
  await sql()`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_email_import_key
    ON tickets (email_import_key)
    WHERE email_import_key IS NOT NULL
  `;
}

export function recordProcessResult(
  result: EmailIngestResult,
  processed: InboundProcessResult
): void {
  if (processed.error) {
    result.errors.push(processed.error);
  }
  if (processed.skipReason) {
    result.skipReasons = result.skipReasons ?? [];
    result.skipReasons.push(processed.skipReason);
  }
}

async function insertEmailTicket(
  message: ParsedEmailMessage,
  sourceTag: string,
  forcedClassification?: ForcedClassification | null
): Promise<{ inserted: boolean; ticketId: string | null }> {
  const classification = forcedClassification ?? {
    category: PENDING_TRIAGE_CATEGORY,
    priority: 3,
    summary: "פנייה חדשה ממתינה לסינון ידני.",
    status: "open" as const,
    aiSuggestedCategory: null,
    classificationConfidence: null,
    extraTags: [] as string[]
  };

  const bodyCleaned = cleanMessageForAi(message.body);
  const ticketNumber = await allocateNextTicketNumber();
  const tags = [sourceTag, ...(classification.extraTags ?? []), ...(message.ingestTags ?? [])];

  const rows = await sql()`
    INSERT INTO tickets (
      ticket_number,
      sender_email,
      sender_name,
      subject,
      body,
      body_cleaned,
      category,
      priority,
      ai_summary,
      ai_suggested_category,
      classification_confidence,
      status,
      source,
      message_at,
      tags,
      email_import_key,
      email_message_id,
      email_mailbox_uid,
      email_ingested_at
    )
    VALUES (
      ${ticketNumber},
      ${message.senderEmail},
      ${message.senderName},
      ${message.subject},
      ${message.body},
      ${bodyCleaned},
      ${classification.category},
      ${classification.priority},
      ${classification.summary},
      ${classification.aiSuggestedCategory ?? null},
      ${classification.classificationConfidence ?? null},
      ${classification.status},
      ${"email"},
      ${message.messageAt},
      ${tags},
      ${message.importKey},
      ${message.messageId},
      ${message.mailboxUid},
      now()
    )
    ON CONFLICT (email_import_key) WHERE (email_import_key IS NOT NULL) DO NOTHING
    RETURNING id
  `;

  if (rows.length === 0) {
    return { inserted: false, ticketId: null };
  }

  const ticketId = String((rows[0] as { id: string }).id);
  if (message.attachments.length > 0) {
    try {
      await saveTicketAttachments(ticketId, message.attachments);
    } catch (error) {
      console.error("[email-ingest] attachment save failed", error);
    }
  }

  return { inserted: true, ticketId };
}

function isGmailHost(host: string): boolean {
  return host.toLowerCase().includes("gmail.com");
}

async function resolveArchiveMailbox(session: ImapSession, config: GmailConfig): Promise<string> {
  if (config.archiveMailbox) {
    return config.archiveMailbox;
  }

  const listed = await session.raw.list();
  const bySpecialUse = listed.find((box) => {
    const use = box.specialUse?.replace(/\\/g, "").toLowerCase();
    return use === "archive";
  });
  if (bySpecialUse?.path) {
    return bySpecialUse.path;
  }

  const byName = listed.find((box) => {
    const name = `${box.name} ${box.path}`.toLowerCase();
    return name.includes("archive") || name.includes("ארכיון");
  });
  if (byName?.path) {
    return byName.path;
  }

  if (isGmailHost(config.host)) {
    return DEFAULT_GMAIL_ARCHIVE_MAILBOX;
  }

  throw new Error(
    "Could not resolve archive mailbox. Set EMAIL_IMAP_ARCHIVE_MAILBOX to the IMAP folder path."
  );
}

type FetchedInboxItem = {
  uid: number;
  message: ParsedEmailMessage | null;
};

async function fetchInboxMessages(
  session: ImapSession,
  config: GmailConfig,
  result: EmailIngestResult
): Promise<FetchedInboxItem[]> {
  const items: FetchedInboxItem[] = [];

  await session.withMailbox(config.mailbox, async (client) => {
    const since = new Date(Date.now() - config.lookbackDays * 24 * 60 * 60 * 1000);
    const [sinceUids, unseenUids] = await Promise.all([
      withTimeout(client.search({ since }, { uid: true }), config.timeoutMs, "IMAP search since"),
      withTimeout(client.search({ seen: false }, { uid: true }), config.timeoutMs, "IMAP search unseen").catch(
        () => [] as number[]
      )
    ]);

    const uidSet = new Set<number>();
    for (const uid of [...(Array.isArray(sinceUids) ? sinceUids : []), ...(Array.isArray(unseenUids) ? unseenUids : [])]) {
      if (Number.isFinite(uid) && uid > 0) uidSet.add(uid);
    }

    const uidsToFetch = Array.from(uidSet)
      .sort((a, b) => a - b)
      .slice(-config.maxMessages);

    if (uidsToFetch.length === 0) {
      return;
    }

    for await (const fetched of client.fetch(
      uidsToFetch,
      { uid: true, source: true },
      { uid: true }
    )) {
      result.scanned += 1;

      try {
        const uid = Number(fetched.uid);
        const source = Buffer.isBuffer(fetched.source)
          ? fetched.source
          : Buffer.from(fetched.source ?? "");

        if (!uid || source.length === 0) {
          result.skipped += 1;
          continue;
        }

        const message = await parseFetchedMessage(config.mailbox, uid, source);
        source.fill(0);
        if (!message) {
          result.skipped += 1;
          continue;
        }

        items.push({ uid, message });
      } catch (error) {
        result.skipped += 1;
        result.errors.push(error instanceof Error ? error.message : "Unknown email parsing error");
        result.skipReasons = result.skipReasons ?? [];
        result.skipReasons.push("error");
      }
    }
  });

  return items;
}

async function ingestGmailInboxInternal(config: GmailConfig): Promise<EmailIngestResult> {
  await ensureEmailIngestSchema();

  const session = new ImapSession({
    host: config.host,
    port: config.port,
    user: config.user,
    pass: config.appPassword,
    connectTimeoutMs: Math.min(30_000, config.timeoutMs),
    socketTimeoutMs: config.timeoutMs
  });

  const result: EmailIngestResult = {
    ok: true,
    scanned: 0,
    imported: 0,
    followupsAttached: 0,
    reopened: 0,
    skipped: 0,
    archived: 0,
    archiveMailbox: config.archiveMailbox || DEFAULT_GMAIL_ARCHIVE_MAILBOX,
    errors: [],
    skipReasons: [],
    provider: "imap"
  };

  try {
    await withTimeout(session.connect(), Math.min(25_000, config.timeoutMs), "IMAP connect");
    result.archiveMailbox = await withTimeout(
      resolveArchiveMailbox(session, config),
      config.timeoutMs,
      "IMAP list mailboxes"
    );

    const fetchedItems = await fetchInboxMessages(session, config, result);
    // Close IMAP before slow Gemini work — idle sockets were failing archive with "Command failed".
    await session.disconnect();
    const processedUids: number[] = [];

    for (const { uid, message } of fetchedItems) {
      if (!message) {
        result.skipped += 1;
        continue;
      }

      try {
        const processed = await processInboundEmailMessage(message, {
          ownerEmail: config.user,
          sourceTag: config.sourceTag
        });

        recordProcessResult(result, processed);
        if (processed.imported) result.imported += 1;
        if (processed.followupAttached) result.followupsAttached += 1;
        if (processed.reopened) result.reopened += 1;
        if (processed.skipped) result.skipped += 1;
        if (processed.shouldArchive) processedUids.push(uid);
      } catch (error) {
        result.skipped += 1;
        result.errors.push(error instanceof Error ? error.message : "Unknown email processing error");
        result.skipReasons = result.skipReasons ?? [];
        result.skipReasons.push("error");
      }
    }

    if (processedUids.length > 0) {
      try {
        const archivedCount = await session.archiveUids(
          config.mailbox,
          result.archiveMailbox,
          processedUids
        );
        result.archived += archivedCount;
        if (archivedCount !== processedUids.length) {
          result.errors.push("Some processed emails could not be archived in the mailbox");
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : "IMAP archive failed";
        result.errors.push(detail);
        console.error("[email-ingest] archive failed after processing:", error);
      }
    }
  } finally {
    await session.disconnect().catch(() => undefined);
  }

  return result;
}

async function parseFetchedMessage(
  mailbox: string,
  uid: number,
  source: Buffer
): Promise<ParsedEmailMessage | null> {
  const parsed = await simpleParser(source);
  const sender = senderFromParsedMail(parsed);
  const subject = String(parsed.subject ?? "").trim() || "(ללא נושא)";

  if (!sender.email) {
    return null;
  }

  const messageId = normalizeMessageId(parsed.messageId);
  const mailboxUid = `${mailbox}:${uid}`;
  const rawReferences = Array.isArray(parsed.references)
    ? parsed.references
    : parsed.references
      ? [parsed.references]
      : [];
  const references = rawReferences
    .map((ref) => normalizeMessageId(ref))
    .filter((ref): ref is string => Boolean(ref));

  return {
    importKey: importKeyFor(messageId, mailboxUid),
    messageId,
    mailboxUid,
    inReplyTo: normalizeMessageId(parsed.inReplyTo),
    references,
    senderEmail: repairEmailAddress(sender.email),
    senderName: sender.name,
    subject,
    body: bodyFromParsedMail(parsed),
    messageAt: parsed.date instanceof Date ? parsed.date.toISOString() : null,
    attachments: extractAttachmentsFromParsedMail(parsed.attachments)
  };
}

function resolveIngestProvider(): "gmail_api" | "imap" {
  const raw = process.env.EMAIL_INGEST_PROVIDER?.trim().toLowerCase();
  const imapReady = isImapConfigured();
  const gmailReady = isGmailApiConfigured();

  if (raw === "imap") return imapReady ? "imap" : gmailReady ? "gmail_api" : "imap";
  if (raw === "gmail_api") return gmailReady ? "gmail_api" : imapReady ? "imap" : "gmail_api";

  // Default: IMAP (App Password) — worked reliably before Gmail API ingest switch.
  if (imapReady) return "imap";
  if (gmailReady) return "gmail_api";
  return "imap";
}

function isImapConnectFailure(error: unknown): boolean {
  return isImapSessionConnectFailure(error);
}

async function ingestViaGmailApiOrThrow(): Promise<EmailIngestResult> {
  const { ingestInboxViaGmailApi, isGmailApiIngestConfigured, gmailApiIngestScopeHint, isInsufficientScopeError } =
    await import("@/lib/gmail-inbox-ingest");

  if (!isGmailApiIngestConfigured()) {
    throw new Error(
      "Gmail API לא מוגדר. הגדר GMAIL_* או EMAIL_IMAP_APP_PASSWORD ב-Render."
    );
  }

  try {
    return await ingestInboxViaGmailApi();
  } catch (error) {
    if (isInsufficientScopeError(error)) {
      throw new Error(`הרשאות Gmail API חסרות. ${gmailApiIngestScopeHint()}`);
    }
    throw error;
  }
}

export async function ingestGmailInbox(): Promise<EmailIngestResult> {
  return runIngestExclusive(async () => {
    const provider = resolveIngestProvider();

    if (provider === "gmail_api") {
      return ingestViaGmailApiOrThrow();
    }

    if (!isImapConfigured()) {
      if (isGmailApiConfigured()) {
        return ingestViaGmailApiOrThrow();
      }
      throw new Error("EMAIL_IMAP_USER and EMAIL_IMAP_APP_PASSWORD must be configured");
    }

    const config = getGmailConfig();

    try {
      return await withTimeout(
        ingestGmailInboxInternal(config),
        config.timeoutMs + 20_000,
        "Email ingest"
      );
    } catch (error) {
      if (isGmailApiConfigured() && isImapConnectFailure(error)) {
        console.error("[email-ingest] IMAP failed, falling back to Gmail API:", error);
        return ingestViaGmailApiOrThrow();
      }
      throw error;
    }
  });
}
