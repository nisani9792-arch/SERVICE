import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import { PENDING_TRIAGE_CATEGORY } from "@/lib/triage";
import {
  extractAttachmentsFromParsedMail,
  saveTicketAttachments,
  type EmailAttachmentCandidate
} from "@/lib/ticket-attachments";
import { cleanMessageForAi } from "@/lib/message-filter";
import { sql } from "@/lib/neon";
import { allocateNextTicketNumber } from "@/lib/ticket-sequence";
import { ensureTicketListColumns } from "@/lib/ticket-schema";
import {
  isReplyToOurOutbound,
  isThreadReplyMessage
} from "@/lib/outbound-message-ids";

const DEFAULT_MAILBOX = "INBOX";
const DEFAULT_GMAIL_ARCHIVE_MAILBOX = "[Gmail]/All Mail";
const DEFAULT_LOOKBACK_DAYS = 14;
const DEFAULT_MAX_MESSAGES = 25;
const DEFAULT_SOURCE_TAG = "EDITOR";
const DEFAULT_INGEST_TIMEOUT_MS = 45000;

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

type ParsedEmailMessage = {
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
};

type ForcedClassification = {
  category: string;
  priority: number;
  summary: string;
  status: "open" | "closed";
};

export type EmailIngestResult = {
  ok: true;
  scanned: number;
  imported: number;
  skipped: number;
  archived: number;
  archiveMailbox: string;
  errors: string[];
};

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
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

function normalizeMessageId(value: string | null | undefined): string | null {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/^<|>$/g, "")
    .toLowerCase();
  return cleaned || null;
}

function htmlToText(html: string): string {
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

function importKeyFor(messageId: string | null, mailboxUid: string): string {
  return messageId ? `message-id:${messageId}` : `uid:${mailboxUid}`;
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
  return message.senderEmail.toLowerCase() === ownEmail.toLowerCase();
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

async function alreadyImported(importKey: string): Promise<boolean> {
  const rows = await sql()`
    SELECT id
    FROM tickets
    WHERE email_import_key = ${importKey}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function ensureEmailIngestSchema(): Promise<void> {
  await ensureTicketListColumns();
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

async function insertEmailTicket(
  message: ParsedEmailMessage,
  sourceTag: string,
  forcedClassification?: ForcedClassification | null
): Promise<{ inserted: boolean; ticketId: string | null }> {
  const classification = forcedClassification ?? {
    category: PENDING_TRIAGE_CATEGORY,
    priority: 3,
    summary: "פנייה חדשה ממתינה לסינון ידני.",
    status: "open" as const
  };

  const bodyCleaned = cleanMessageForAi(message.body);
  const ticketNumber = await allocateNextTicketNumber();

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
      ${forcedClassification?.status ?? "open"},
      ${"email"},
      ${message.messageAt},
      ARRAY[${sourceTag}]::text[],
      ${message.importKey},
      ${message.messageId},
      ${message.mailboxUid},
      now()
    )
    ON CONFLICT (email_import_key) WHERE email_import_key IS NOT NULL DO NOTHING
    RETURNING id
  `;

  if (rows.length === 0) {
    return { inserted: false, ticketId: null };
  }

  const ticketId = String((rows[0] as { id: string }).id);
  if (message.attachments.length > 0) {
    await saveTicketAttachments(ticketId, message.attachments);
  }

  return { inserted: true, ticketId };
}

function isGmailHost(host: string): boolean {
  return host.toLowerCase().includes("gmail.com");
}

async function resolveArchiveMailbox(client: ImapFlow, config: GmailConfig): Promise<string> {
  if (config.archiveMailbox) {
    return config.archiveMailbox;
  }

  const listed = await client.list();
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

async function archiveProcessedMessages(
  client: ImapFlow,
  archiveMailbox: string,
  uids: number[]
): Promise<number> {
  if (uids.length === 0) return 0;
  const moved = await client.messageMove(uids, archiveMailbox, { uid: true });
  return moved ? uids.length : 0;
}

async function parseFetchedMessage(
  mailbox: string,
  uid: number,
  source: Buffer
): Promise<ParsedEmailMessage | null> {
  const parsed = await simpleParser(source);
  const sender = firstAddress(parsed.from);
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
    senderEmail: sender.email,
    senderName: sender.name,
    subject,
    body: bodyFromParsedMail(parsed),
    messageAt: parsed.date instanceof Date ? parsed.date.toISOString() : null,
    attachments: extractAttachmentsFromParsedMail(parsed.attachments)
  };
}

async function ingestGmailInboxInternal(config: GmailConfig): Promise<EmailIngestResult> {
  await ensureEmailIngestSchema();

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    connectionTimeout: config.timeoutMs,
    greetingTimeout: config.timeoutMs,
    socketTimeout: config.timeoutMs,
    auth: {
      user: config.user,
      pass: config.appPassword
    },
    logger: false
  });

  const result: EmailIngestResult = {
    ok: true,
    scanned: 0,
    imported: 0,
    skipped: 0,
    archived: 0,
    archiveMailbox: config.archiveMailbox || DEFAULT_GMAIL_ARCHIVE_MAILBOX,
    errors: []
  };

  await withTimeout(client.connect(), config.timeoutMs, "IMAP connect");
  result.archiveMailbox = await withTimeout(
    resolveArchiveMailbox(client, config),
    config.timeoutMs,
    "IMAP list mailboxes"
  );

  const lock = await client.getMailboxLock(config.mailbox);
  try {
    const since = new Date(Date.now() - config.lookbackDays * 24 * 60 * 60 * 1000);
    const foundUids = await withTimeout(
      client.search({ since }, { uid: true }),
      config.timeoutMs,
      "IMAP search"
    );
    const uidsToFetch = (Array.isArray(foundUids) ? foundUids : [])
      .sort((a, b) => a - b)
      .slice(-config.maxMessages);

    if (uidsToFetch.length === 0) {
      return result;
    }

    const processedUids: number[] = [];

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
        if (!message) {
          result.skipped += 1;
          continue;
        }

        if (isSystemOrListMessage(message) || isOwnOutgoingMessage(message, config.user)) {
          result.skipped += 1;
          processedUids.push(uid);
          continue;
        }

        if (isThreadReplyMessage(message.inReplyTo, message.references)) {
          result.skipped += 1;
          processedUids.push(uid);
          continue;
        }

        if (await isReplyToOurOutbound(message.inReplyTo, message.references)) {
          result.skipped += 1;
          processedUids.push(uid);
          continue;
        }

        const duplicate = await alreadyImported(message.importKey);
        const forcedClassification = forcedClassificationFor(message);
        const insertResult = duplicate
          ? { inserted: false, ticketId: null }
          : await insertEmailTicket(message, config.sourceTag, forcedClassification);

        if (insertResult.inserted || duplicate) {
          processedUids.push(uid);
        }

        if (insertResult.inserted) {
          result.imported += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : "Unknown email parsing error");
      }
    }

    const archivedCount = await archiveProcessedMessages(
      client,
      result.archiveMailbox,
      processedUids
    );
    result.archived += archivedCount;
    if (archivedCount !== processedUids.length) {
      result.errors.push("Some processed emails could not be archived in the mailbox");
    }
  } finally {
    lock.release();
    await withTimeout(client.logout(), 8000, "IMAP logout").catch(() => undefined);
  }

  return result;
}

export async function ingestGmailInbox(): Promise<EmailIngestResult> {
  const config = getGmailConfig();
  return withTimeout(
    ingestGmailInboxInternal(config),
    config.timeoutMs + 10000,
    "Email ingest"
  );
}
