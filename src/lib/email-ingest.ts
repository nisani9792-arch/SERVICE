import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import { classifyTicketContent } from "@/lib/gemini";
import { sql } from "@/lib/neon";

const DEFAULT_MAILBOX = "INBOX";
const DEFAULT_LOOKBACK_DAYS = 14;
const DEFAULT_MAX_MESSAGES = 25;

type GmailConfig = {
  user: string;
  appPassword: string;
  host: string;
  port: number;
  mailbox: string;
  lookbackDays: number;
  maxMessages: number;
};

type ParsedEmailMessage = {
  importKey: string;
  messageId: string | null;
  mailboxUid: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  body: string;
  messageAt: string | null;
};

export type EmailIngestResult = {
  ok: true;
  scanned: number;
  imported: number;
  skipped: number;
  errors: string[];
};

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getGmailConfig(): GmailConfig {
  const user = process.env.GMAIL_USER?.trim();
  const appPassword = process.env.GMAIL_APP_PASSWORD?.trim();

  if (!user || !appPassword) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be configured");
  }

  return {
    user,
    appPassword,
    host: process.env.GMAIL_IMAP_HOST?.trim() || "imap.gmail.com",
    port: positiveInt(process.env.GMAIL_IMAP_PORT, 993),
    mailbox: process.env.GMAIL_MAILBOX?.trim() || DEFAULT_MAILBOX,
    lookbackDays: positiveInt(process.env.EMAIL_INGEST_LOOKBACK_DAYS, DEFAULT_LOOKBACK_DAYS),
    maxMessages: positiveInt(process.env.EMAIL_INGEST_MAX_MESSAGES, DEFAULT_MAX_MESSAGES)
  };
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

async function alreadyImported(importKey: string): Promise<boolean> {
  const rows = await sql()`
    SELECT id
    FROM tickets
    WHERE email_import_key = ${importKey}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function insertEmailTicket(message: ParsedEmailMessage): Promise<boolean> {
  const classification = await classifyTicketContent(
    message.senderEmail,
    message.subject,
    message.body
  );

  const rows = await sql()`
    INSERT INTO tickets (
      sender_email,
      sender_name,
      subject,
      body,
      category,
      priority,
      ai_summary,
      status,
      source,
      message_at,
      email_import_key,
      email_message_id,
      email_mailbox_uid,
      email_ingested_at
    )
    VALUES (
      ${message.senderEmail},
      ${message.senderName},
      ${message.subject},
      ${message.body},
      ${classification.category},
      ${classification.priority},
      ${classification.summary},
      ${"open"},
      ${"email"},
      ${message.messageAt},
      ${message.importKey},
      ${message.messageId},
      ${message.mailboxUid},
      now()
    )
    ON CONFLICT (email_import_key) WHERE email_import_key IS NOT NULL DO NOTHING
    RETURNING id
  `;

  return rows.length > 0;
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

  return {
    importKey: importKeyFor(messageId, mailboxUid),
    messageId,
    mailboxUid,
    senderEmail: sender.email,
    senderName: sender.name,
    subject,
    body: bodyFromParsedMail(parsed),
    messageAt: parsed.date instanceof Date ? parsed.date.toISOString() : null
  };
}

export async function ingestGmailInbox(): Promise<EmailIngestResult> {
  const config = getGmailConfig();
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
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
    errors: []
  };

  await client.connect();

  const lock = await client.getMailboxLock(config.mailbox);
  try {
    const since = new Date(Date.now() - config.lookbackDays * 24 * 60 * 60 * 1000);
    const foundUids = await client.search({ since });
    const uidsToFetch = (Array.isArray(foundUids) ? foundUids : [])
      .sort((a, b) => a - b)
      .slice(-config.maxMessages);

    if (uidsToFetch.length === 0) {
      return result;
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
        if (!message || (await alreadyImported(message.importKey))) {
          result.skipped += 1;
          continue;
        }

        const inserted = await insertEmailTicket(message);
        if (inserted) {
          result.imported += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : "Unknown email parsing error");
      }
    }
  } finally {
    lock.release();
    await client.logout();
  }

  return result;
}
