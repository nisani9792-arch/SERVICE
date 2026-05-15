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
};

export type EmailDeliveryStatus = {
  hostedRuntime: boolean;
  resendKeyConfigured: boolean;
  replyProvider: string;
  effectiveProvider: "resend" | "smtp";
  fromAddress: string;
  smtpConfigured: boolean;
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
  return process.env.RESEND_API_KEY?.trim() || undefined;
}

function shouldUseResend(): boolean {
  const provider = replyProvider();
  const key = resendApiKey();
  if (provider === "resend") return true;
  if (provider === "smtp") return false;
  return Boolean(key);
}

export function getEmailDeliveryStatus(): EmailDeliveryStatus {
  const key = resendApiKey();
  const provider = replyProvider();
  const useResend = shouldUseResend();
  return {
    hostedRuntime: isHostedRuntime(),
    resendKeyConfigured: Boolean(key),
    replyProvider: provider,
    effectiveProvider: useResend ? "resend" : "smtp",
    fromAddress: replyFromAddress(),
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

function replyFromAddress(): string {
  return (
    firstNonEmpty(process.env.EMAIL_FROM, process.env.EMAIL_SMTP_USER, process.env.EMAIL_IMAP_USER) ??
    "noreply@jusic.co"
  );
}

/** Resend expects `Name <email@domain.com>` and a verified domain (or onboarding@resend.dev). */
function resendFromAddress(): string {
  const raw = replyFromAddress();
  if (raw.includes("<")) return raw;
  const email = raw.toLowerCase();
  if (email === "onboarding@resend.dev") return "Jusic <onboarding@resend.dev>";
  return `Jusic <${email}>`;
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

async function sendViaResend({
  to,
  subject,
  message,
  inReplyTo,
  references
}: SendCustomerReplyInput): Promise<void> {
  const apiKey = resendApiKey();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured on the server");
  }

  const headers: Record<string, string> = {};
  if (inReplyTo) headers["In-Reply-To"] = inReplyTo;
  if (references?.length) headers.References = references.join(" ");

  const timeoutMs = positiveInt(process.env.EMAIL_SMTP_TIMEOUT_MS, 25000);
  const response = await withTimeout(
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: resendFromAddress(),
        to: [to],
        subject: normalizeSubject(subject),
        text: message,
        headers: Object.keys(headers).length ? headers : undefined
      })
    }),
    timeoutMs,
    "Resend API"
  );

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      detail = body.message || body.error || detail;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(detail);
  }
}

async function sendViaSmtp(input: SendCustomerReplyInput): Promise<void> {
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
      await withTimeout(
        transporter.sendMail({
          from: config.user,
          to: input.to,
          subject: normalizeSubject(input.subject),
          text: input.message,
          inReplyTo: input.inReplyTo || undefined,
          references: input.references?.length ? input.references : undefined
        }),
        config.timeoutMs,
        `SMTP ${config.host}:${config.port}`
      );
      return;
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
      ? " השרת אמור להשתמש ב-Resend — ודא ש-EMAIL_REPLY_PROVIDER=resend ושהקוד האחרון נפרס."
      : " ב-Render חסום SMTP — הגדר RESEND_API_KEY ופרוס מחדש."
    : "";

  throw new Error(`${prefix} after ${attemptErrors.length} attempt(s). ${attemptErrors.join(" | ")}.${hint}`);
}

export async function sendCustomerReply(input: SendCustomerReplyInput): Promise<void> {
  const useResend = shouldUseResend();
  const key = resendApiKey();

  if (useResend) {
    if (!key) {
      throw new Error(
        "EMAIL_REPLY_PROVIDER=resend אבל RESEND_API_KEY חסר בשרת. הוסף ב-Render → Environment ועשה Deploy."
      );
    }
    try {
      await sendViaResend(input);
      return;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Resend failed: ${msg}. בדוק: (1) RESEND_API_KEY ב-Render, (2) EMAIL_FROM מדומיין מאומת ב-Resend, או זמנית onboarding@resend.dev לבדיקה.`
      );
    }
  }

  if (isHostedRuntime()) {
    throw new Error(
      "ב-Render אי אפשר לשלוח דרך Gmail SMTP. הגדר RESEND_API_KEY ו-EMAIL_REPLY_PROVIDER=resend, ופרוס את הקוד העדכני."
    );
  }

  await sendViaSmtp(input);
}
