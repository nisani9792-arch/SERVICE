import nodemailer from "nodemailer";

type EmailSendConfig = {
  user: string;
  appPassword: string;
  host: string;
  port: number;
  secure: boolean;
  timeoutMs: number;
};

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
  hostedRuntime: boolean;
  resendKeyConfigured: boolean;
  resendKeyFormatValid: boolean;
  resendApiKeyValid: boolean | null;
  replyProvider: string;
  effectiveProvider: "resend" | "smtp";
  fromAddress: string;
  resendFromFormatted: string;
  smtpConfigured: boolean;
  resendDomains?: Array<{ name: string; status: string }>;
  resendDomainsError?: string;
};

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find(Boolean);
}

function isHostedRuntime(): boolean {
  return Boolean(
    process.env.RENDER_SERVICE_ID ||
      process.env.RENDER_EXTERNAL_URL ||
      process.env.RENDER === "true" ||
      process.env.VERCEL ||
      process.env.FLY_APP_NAME
  );
}

function replyProvider(): "resend" | "smtp" | "auto" {
  const raw = (process.env.EMAIL_REPLY_PROVIDER ?? "auto").trim().toLowerCase();
  if (raw === "resend" || raw === "smtp") return raw;
  return "auto";
}

function resendApiKey(): string | undefined {
  const raw = process.env.RESEND_API_KEY;
  if (!raw) return undefined;
  const cleaned = raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, "");
  return cleaned || undefined;
}

function resendKeyFormatValid(key: string | undefined): boolean {
  return Boolean(key && key.startsWith("re_") && key.length >= 20);
}

function hintForResendError(detail: string): string {
  if (/401|unauthorized|invalid.*api.*key/i.test(detail)) {
    return (
      " מפתח Resend לא תקין ב-Render: צור API Key חדש ב-resend.com → API Keys, העתק את המפתח המלא (מתחיל ב-re_), " +
      "הדבק ב-RESEND_API_KEY בלי מרכאות וללא רווחים, שמור ועשה Manual Deploy."
    );
  }
  if (/403|domain.*not verified/i.test(detail)) {
    return " אמת את הדומיין jusic.co ב-Resend → Domains (כל רשומות DNS ירוקות).";
  }
  return "";
}

function shouldUseResend(): boolean {
  const provider = replyProvider();
  const key = resendApiKey();
  if (provider === "resend") return true;
  if (provider === "smtp") return false;
  return Boolean(key);
}

/** Lowercase domain part — Resend matches verified domains case-insensitively but this avoids quirks. */
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
    firstNonEmpty(process.env.EMAIL_FROM, process.env.EMAIL_SMTP_USER, process.env.EMAIL_IMAP_USER) ??
    "editor@jusic.co";
  return normalizeEmailAddress(raw);
}

function replyFromDisplayName(): string {
  return (
    firstNonEmpty(process.env.EMAIL_FROM_NAME, process.env.RESEND_FROM_NAME)?.trim() || "Jusic"
  );
}

/** Resend expects `Name <email@domain.com>` and a verified sending domain. */
export function resendFromAddress(): string {
  const raw = replyFromAddress();
  if (raw.includes("<")) return raw;
  const email = normalizeEmailAddress(raw);
  const name = replyFromDisplayName();
  if (email === "onboarding@resend.dev") return `${name} <onboarding@resend.dev>`;
  return `${name} <${email}>`;
}

export function formatMessageIdHeader(value: string | null | undefined): string | undefined {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/^<|>$/g, "");
  if (!cleaned || !cleaned.includes("@")) return undefined;
  return `<${cleaned}>`;
}

async function fetchResendDomains(): Promise<{
  domains?: Array<{ name: string; status: string }>;
  error?: string;
}> {
  const apiKey = resendApiKey();
  if (!apiKey) return { error: "RESEND_API_KEY not set" };

  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store"
    });
    const body = (await response.json()) as {
      data?: Array<{ name: string; status: string }>;
      message?: string;
    };
    if (!response.ok) {
      return { error: body.message || `${response.status} ${response.statusText}` };
    }
    return {
      domains: (body.data ?? []).map((d) => ({
        name: d.name,
        status: d.status
      }))
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to list domains" };
  }
}

export async function getEmailDeliveryStatus(): Promise<EmailDeliveryStatus> {
  const key = resendApiKey();
  const provider = replyProvider();
  const useResend = shouldUseResend();
  const fromAddress = replyFromAddress();
  const formatValid = resendKeyFormatValid(key);
  const base: EmailDeliveryStatus = {
    hostedRuntime: isHostedRuntime(),
    resendKeyConfigured: Boolean(key),
    resendKeyFormatValid: formatValid,
    resendApiKeyValid: null,
    replyProvider: provider,
    effectiveProvider: useResend ? "resend" : "smtp",
    fromAddress,
    resendFromFormatted: resendFromAddress(),
    smtpConfigured: Boolean(
      firstNonEmpty(
        process.env.EMAIL_SMTP_USER,
        process.env.EMAIL_IMAP_USER,
        process.env.GMAIL_USER
      ) &&
        firstNonEmpty(
          process.env.EMAIL_SMTP_APP_PASSWORD,
          process.env.EMAIL_IMAP_APP_PASSWORD,
          process.env.GMAIL_APP_PASSWORD
        )
    )
  };

  if (key) {
    const { domains, error } = await fetchResendDomains();
    if (domains) {
      base.resendDomains = domains;
      base.resendApiKeyValid = true;
    }
    if (error) {
      base.resendDomainsError = error;
      base.resendApiKeyValid = !/401|unauthorized|invalid/i.test(error);
    }
  }

  return base;
}

function getEmailSendConfig(): EmailSendConfig {
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
    throw new Error("EMAIL_SMTP_USER/EMAIL_IMAP_USER and app password must be configured");
  }

  const port = positiveInt(process.env.EMAIL_SMTP_PORT, 587);
  return {
    user,
    appPassword,
    host: process.env.EMAIL_SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    secure: (process.env.EMAIL_SMTP_SECURE ?? "false") === "true",
    timeoutMs: positiveInt(process.env.EMAIL_SMTP_TIMEOUT_MS, 25000)
  };
}

function emailSendConfigs(): EmailSendConfig[] {
  const configured = getEmailSendConfig();
  const candidates: EmailSendConfig[] = [];
  const try465Explicit =
    (process.env.EMAIL_SMTP_TRY_465 ?? "false").trim().toLowerCase() === "true";
  const onRender = isHostedRuntime();

  if (configured.host === "smtp.gmail.com") {
    candidates.push({ ...configured, port: 587, secure: false });
    if (try465Explicit || onRender) {
      candidates.push({ ...configured, port: 465, secure: true });
    }
  } else {
    candidates.push(configured);
    if (try465Explicit && configured.port === 587) {
      candidates.push({ ...configured, port: 465, secure: true });
    }
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.host}:${candidate.port}:${candidate.secure}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeSubject(subject: string): string {
  const cleaned = subject.trim() || "פנייה ל-Jusic";
  return /^re\s*:/i.test(cleaned) ? cleaned : `Re: ${cleaned}`;
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

async function parseResendError(response: Response): Promise<string> {
  const status = `${response.status} ${response.statusText}`;
  try {
    const body = (await response.json()) as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof body.message === "string") parts.push(body.message);
    if (typeof body.error === "string") parts.push(body.error);
    if (typeof body.name === "string") parts.push(`[${body.name}]`);
    if (Array.isArray(body.errors)) {
      for (const item of body.errors) {
        if (item && typeof item === "object" && "message" in item) {
          parts.push(String((item as { message: unknown }).message));
        }
      }
    }
    if (parts.length) return `${status}: ${parts.join(" — ")}`;
    return `${status}: ${JSON.stringify(body)}`;
  } catch {
    return status;
  }
}

function buildResendPayload(
  input: SendCustomerReplyInput,
  includeThreadHeaders: boolean
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    from: resendFromAddress(),
    to: [normalizeEmailAddress(input.to)],
    subject: normalizeSubject(input.subject),
    text: input.message,
    reply_to: replyFromAddress()
  };

  const outboundId = formatMessageIdHeader(input.messageId);
  if (outboundId) {
    payload.headers = {
      ...(typeof payload.headers === "object" && payload.headers !== null
        ? (payload.headers as Record<string, string>)
        : {}),
      "Message-ID": outboundId
    };
  }

  if (includeThreadHeaders) {
    const inReplyTo = formatMessageIdHeader(input.inReplyTo);
    const refs = (input.references ?? [])
      .map((r) => formatMessageIdHeader(r))
      .filter((r): r is string => Boolean(r));
    const headers: Record<string, string> = {
      ...(typeof payload.headers === "object" && payload.headers !== null
        ? (payload.headers as Record<string, string>)
        : {})
    };
    if (inReplyTo) headers["In-Reply-To"] = inReplyTo;
    if (refs.length) headers.References = refs.join(" ");
    if (Object.keys(headers).length) payload.headers = headers;
  }

  return payload;
}

async function sendViaResend(input: SendCustomerReplyInput): Promise<SendCustomerReplyResult> {
  const apiKey = resendApiKey();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured on the server");
  }

  const timeoutMs = positiveInt(process.env.EMAIL_SMTP_TIMEOUT_MS, 25000);

  const attempts: Array<{ label: string; includeThreadHeaders: boolean }> = [
    { label: "with thread headers", includeThreadHeaders: true },
    { label: "without thread headers", includeThreadHeaders: false }
  ];

  let lastError = "Unknown Resend error";

  for (const attempt of attempts) {
    const response = await withTimeout(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildResendPayload(input, attempt.includeThreadHeaders))
      }),
      timeoutMs,
      "Resend API"
    );

    if (response.ok) {
      let resendId: string | undefined;
      try {
        const body = (await response.json()) as { id?: string };
        if (typeof body.id === "string" && body.id.trim()) {
          resendId = body.id.trim();
        }
      } catch {
        /* use Message-ID fallback */
      }
      return {
        messageId:
          normalizeMessageIdForResult(input.messageId) ??
          (resendId
            ? `resend.${resendId}@${replyFromAddress().split("@")[1] ?? "resend.dev"}`
            : `resend-${Date.now()}@${replyFromAddress().split("@")[1] ?? "service.local"}`)
      };
    }

    lastError = await parseResendError(response);
    const retryable =
      attempt.includeThreadHeaders &&
      (response.status === 422 || /invalid|header|from|domain/i.test(lastError));
    if (!retryable) break;
  }

  throw new Error(`${lastError}${hintForResendError(lastError)}`);
}

function normalizeMessageIdForResult(value: string | null | undefined): string | null {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/^<|>$/g, "");
  return cleaned || null;
}

async function sendViaSmtp(input: SendCustomerReplyInput): Promise<SendCustomerReplyResult> {
  const attemptErrors: string[] = [];
  const configs = emailSendConfigs();
  const isGmail = configs.some((c) => c.host === "smtp.gmail.com");

  for (const config of configs) {
    const connectMs = Math.min(20000, Math.max(8000, Math.floor(config.timeoutMs * 0.45)));
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.port === 587,
      connectionTimeout: connectMs,
      greetingTimeout: connectMs,
      socketTimeout: config.timeoutMs,
      auth: {
        user: config.user,
        pass: config.appPassword
      },
      tls: {
        servername: config.host
      }
    } as nodemailer.TransportOptions);

    try {
      const sent = await withTimeout(
        transporter.sendMail({
          from: config.user,
          to: input.to,
          subject: normalizeSubject(input.subject),
          text: input.message,
          messageId: formatMessageIdHeader(input.messageId),
          inReplyTo: formatMessageIdHeader(input.inReplyTo),
          references: (input.references ?? [])
            .map((r) => formatMessageIdHeader(r))
            .filter(Boolean)
            .join(" ") || undefined
        }),
        config.timeoutMs,
        `SMTP ${config.host}:${config.port}`
      );
      const messageId =
        normalizeMessageIdForResult(sent.messageId) ??
        normalizeMessageIdForResult(input.messageId) ??
        `smtp-${Date.now()}@${config.host}`;
      return { messageId };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      attemptErrors.push(`${config.host}:${config.port} (${config.secure ? "SSL" : "STARTTLS"}) — ${msg}`);
    } finally {
      transporter.close();
    }
  }

  const hasResend = Boolean(resendApiKey());
  const prefix = isGmail ? "Gmail SMTP failed" : "SMTP failed";
  const hint = isHostedRuntime()
    ? hasResend
      ? " ודא EMAIL_REPLY_PROVIDER=resend ב-Render."
      : " ב-Render חסום SMTP — הגדר RESEND_API_KEY."
    : "";

  throw new Error(`${prefix} after ${attemptErrors.length} attempt(s). ${attemptErrors.join(" | ")}.${hint}`);
}

export async function sendCustomerReply(input: SendCustomerReplyInput): Promise<SendCustomerReplyResult> {
  const useResend = shouldUseResend();
  const key = resendApiKey();

  if (useResend) {
    if (!key) {
      throw new Error(
        "RESEND_API_KEY חסר בשרת (Render → Environment). הוסף את המפתח ועשה Deploy מחדש."
      );
    }
    return sendViaResend(input);
  }

  if (isHostedRuntime()) {
    throw new Error(
      "ב-Render חסום SMTP. הגדר RESEND_API_KEY ו-EMAIL_REPLY_PROVIDER=resend ב-Environment."
    );
  }

  return sendViaSmtp(input);
}
