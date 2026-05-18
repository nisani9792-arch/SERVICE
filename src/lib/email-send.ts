import nodemailer from "nodemailer";
import {
  formatGmailConfigError,
  getMissingGmailEnvKeys,
  isGmailApiConfigured,
  sendViaGmailApi
} from "@/lib/gmail-api";

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
  ingestProvider: string;
  missingGmailEnv?: string[];
  replyViaSmtpFallback?: boolean;
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

function isSmtpConfigured(): boolean {
  return Boolean(
    firstNonEmpty(process.env.EMAIL_SMTP_USER, process.env.EMAIL_IMAP_USER) &&
      firstNonEmpty(process.env.EMAIL_SMTP_APP_PASSWORD, process.env.EMAIL_IMAP_APP_PASSWORD)
  );
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
  const smtpConfigured = isSmtpConfigured();
  const provider = replyProvider();
  const missingGmailEnv = getMissingGmailEnvKeys();
  const replyViaSmtpFallback = provider === "gmail_api" && !gmailOk && smtpConfigured;

  let hint: string | undefined;
  if (replyViaSmtpFallback) {
    hint = `Gmail API חסר (${missingGmailEnv.join(", ")}). שליחה תעבור דרך SMTP/App Password.`;
  } else if (!gmailOk && provider === "gmail_api") {
    hint = formatGmailConfigError();
  } else if (gmailOk) {
    hint = "מוכן לשליחה דרך Gmail API";
  } else if (provider === "smtp" && smtpConfigured) {
    hint = "מוכן לשליחה דרך SMTP";
  }

  const ingestRaw = process.env.EMAIL_INGEST_PROVIDER?.trim().toLowerCase();
  const imapReady = Boolean(
    firstNonEmpty(process.env.EMAIL_IMAP_USER, process.env.GMAIL_USER) &&
      firstNonEmpty(process.env.EMAIL_IMAP_APP_PASSWORD, process.env.GMAIL_APP_PASSWORD)
  );
  const ingestProvider =
    ingestRaw === "imap" || ingestRaw === "gmail_api"
      ? ingestRaw
      : imapReady
        ? "imap"
        : gmailOk
          ? "gmail_api"
          : "imap";

  if (ingestProvider === "gmail_api" && !gmailOk) {
    hint =
      hint ??
      "ייבוא מייל דורש GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN עם הרשאות readonly+modify";
  } else if (ingestProvider === "gmail_api") {
    hint = hint ? `${hint}; ייבוא דרך Gmail API` : "ייבוא ושליחה דרך Gmail API";
  }

  return {
    gmailApiConfigured: gmailOk,
    smtpConfigured,
    fromAddress: replyFromAddress(),
    fromFormatted: replyFromFormatted(),
    replyProvider: provider,
    ingestProvider,
    missingGmailEnv: missingGmailEnv.length ? missingGmailEnv : undefined,
    replyViaSmtpFallback,
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
      if (isSmtpConfigured()) {
        console.warn(
          "[email-send] Gmail API env missing; falling back to SMTP:",
          getMissingGmailEnvKeys().join(", ")
        );
        return sendViaSmtp(input);
      }
      throw new Error(formatGmailConfigError());
    }
    return sendViaGmail(input);
  }

  return sendViaSmtp(input);
}
