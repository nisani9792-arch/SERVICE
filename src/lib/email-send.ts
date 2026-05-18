import nodemailer from "nodemailer";
import { isGmailApiConfigured, sendViaGmailApi } from "@/lib/gmail-api";

export type SendCustomerReplyInput = {
  to: string;
  subject: string;
  message: string;
  inReplyTo?: string | null;
  references?: string[];
  messageId?: string | null;
};

export type SendCustomerReplyResult = {
  messageId: string;
};

export type EmailDeliveryStatus = {
  gmailApiConfigured: boolean;
  smtpConfigured: boolean;
  fromAddress: string;
  fromFormatted: string;
  replyProvider: string;
  hint?: string;
};

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find(Boolean);
}

function replyProvider(): "gmail_api" | "smtp" {
  const raw = (process.env.EMAIL_REPLY_PROVIDER ?? "gmail_api").trim().toLowerCase();
  if (raw === "smtp") return "smtp";
  return "gmail_api";
}

export function normalizeEmailAddress(raw: string): string {
  const trimmed = raw.trim();
  const angleMatch = trimmed.match(/^([^<]*<)([^>]+)(>)$/);
  if (angleMatch) {
    const [, prefix, email, suffix] = angleMatch;
    return `${prefix}${normalizeEmailAddress(email)}${suffix}`;
  }
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return trimmed.toLowerCase();
  return `${trimmed.slice(0, at)}@${trimmed.slice(at + 1).toLowerCase()}`;
}

export function replyFromAddress(): string {
  const raw =
    firstNonEmpty(process.env.EMAIL_FROM, process.env.EMAIL_IMAP_USER, process.env.EMAIL_SMTP_USER) ??
    "editor@jusic.co";
  return normalizeEmailAddress(raw);
}

function replyFromDisplayName(): string {
  return firstNonEmpty(process.env.EMAIL_FROM_NAME)?.trim() || "Jusic";
}

export function replyFromFormatted(): string {
  const email = replyFromAddress();
  if (email.includes("<")) return email;
  return `${replyFromDisplayName()} <${email}>`;
}

export function formatMessageIdHeader(value: string | null | undefined): string | undefined {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/^<|>$/g, "");
  if (!cleaned || !cleaned.includes("@")) return undefined;
  return `<${cleaned}>`;
}

function normalizeSubject(subject: string): string {
  const cleaned = subject.trim() || "פנייה ל-Jusic";
  return /^re\s*:/i.test(cleaned) ? cleaned : `Re: ${cleaned}`;
}

function normalizeMessageIdForResult(value: string | null | undefined): string | null {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/^<|>$/g, "");
  return cleaned || null;
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

export async function getEmailDeliveryStatus(): Promise<EmailDeliveryStatus> {
  const gmailOk = isGmailApiConfigured();
  const smtpConfigured = Boolean(
    firstNonEmpty(process.env.EMAIL_SMTP_USER, process.env.EMAIL_IMAP_USER) &&
      firstNonEmpty(process.env.EMAIL_SMTP_APP_PASSWORD, process.env.EMAIL_IMAP_APP_PASSWORD)
  );
  const provider = replyProvider();

  let hint: string | undefined;
  if (!gmailOk && provider === "gmail_api") {
    hint =
      "הגדר GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET ו-GMAIL_REFRESH_TOKEN (הרץ scripts/gmail_mailer.py לאימות ראשוני)";
  } else if (gmailOk) {
    hint = "מוכן לשליחה דרך Gmail API";
  }

  return {
    gmailApiConfigured: gmailOk,
    smtpConfigured,
    fromAddress: replyFromAddress(),
    fromFormatted: replyFromFormatted(),
    replyProvider: provider,
    hint
  };
}

type EmailSendConfig = {
  user: string;
  appPassword: string;
  host: string;
  port: number;
  secure: boolean;
  timeoutMs: number;
};

function getSmtpConfig(): EmailSendConfig {
  const user = firstNonEmpty(
    process.env.EMAIL_SMTP_USER,
    process.env.EMAIL_IMAP_USER,
    process.env.GMAIL_USER
  );
  const appPassword = firstNonEmpty(
    process.env.EMAIL_SMTP_APP_PASSWORD,
    process.env.EMAIL_IMAP_APP_PASSWORD,
    process.env.GMAIL_APP_PASSWORD
  )?.replace(/\s+/g, "");

  if (!user || !appPassword) {
    throw new Error("EMAIL_SMTP_USER and app password must be configured for SMTP");
  }

  return {
    user,
    appPassword,
    host: process.env.EMAIL_SMTP_HOST?.trim() || "smtp.gmail.com",
    port: positiveInt(process.env.EMAIL_SMTP_PORT, 587),
    secure: (process.env.EMAIL_SMTP_SECURE ?? "false") === "true",
    timeoutMs: positiveInt(process.env.EMAIL_SMTP_TIMEOUT_MS, 25000)
  };
}

async function sendViaSmtp(input: SendCustomerReplyInput): Promise<SendCustomerReplyResult> {
  const config = getSmtpConfig();
  const connectMs = Math.min(20000, Math.max(8000, Math.floor(config.timeoutMs * 0.45)));
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.port === 587,
    connectionTimeout: connectMs,
    greetingTimeout: connectMs,
    socketTimeout: config.timeoutMs,
    auth: { user: config.user, pass: config.appPassword },
    tls: { servername: config.host }
  } as nodemailer.TransportOptions);

  try {
    const sent = await withTimeout(
      transporter.sendMail({
        from: replyFromFormatted(),
        to: input.to,
        subject: normalizeSubject(input.subject),
        text: input.message,
        messageId: formatMessageIdHeader(input.messageId),
        inReplyTo: formatMessageIdHeader(input.inReplyTo),
        references:
          (input.references ?? [])
            .map((r) => formatMessageIdHeader(r))
            .filter(Boolean)
            .join(" ") || undefined
      }),
      config.timeoutMs,
      `SMTP ${config.host}:${config.port}`
    );
    return {
      messageId:
        normalizeMessageIdForResult(sent.messageId) ??
        normalizeMessageIdForResult(input.messageId) ??
        `smtp-${Date.now()}@${config.host}`
    };
  } finally {
    transporter.close();
  }
}

async function sendViaGmail(input: SendCustomerReplyInput): Promise<SendCustomerReplyResult> {
  const timeoutMs = positiveInt(process.env.EMAIL_SMTP_TIMEOUT_MS, 30000);
  const result = await withTimeout(
    sendViaGmailApi({
      to: input.to,
      subject: normalizeSubject(input.subject),
      text: input.message,
      fromEmail: replyFromAddress(),
      fromName: replyFromDisplayName(),
      messageId: input.messageId,
      inReplyTo: input.inReplyTo,
      references: input.references
    }),
    timeoutMs,
    "Gmail API"
  );
  return { messageId: result.messageId };
}

export async function sendCustomerReply(input: SendCustomerReplyInput): Promise<SendCustomerReplyResult> {
  const provider = replyProvider();

  if (provider === "gmail_api") {
    if (!isGmailApiConfigured()) {
      throw new Error(
        "Gmail API לא מוגדר. הוסף GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN ב-Environment."
      );
    }
    return sendViaGmail(input);
  }

  return sendViaSmtp(input);
}
