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

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find(Boolean);
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
    /** Overall budget for a single send attempt (connect + auth + send). */
    timeoutMs: positiveInt(process.env.EMAIL_SMTP_TIMEOUT_MS, 25000)
  };
}

function emailSendConfigs(): EmailSendConfig[] {
  const configured = getEmailSendConfig();
  const candidates: EmailSendConfig[] = [];
  const try465 =
    (process.env.EMAIL_SMTP_TRY_465 ?? "false").trim().toLowerCase() === "true";

  if (configured.host === "smtp.gmail.com") {
    // Gmail: STARTTLS on 587 is the reliable path from cloud hosts. 465 often hangs or is blocked.
    candidates.push({ ...configured, port: 587, secure: false });
    if (try465) {
      candidates.push({ ...configured, port: 465, secure: true });
    }
  } else {
    candidates.push(configured);
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

export async function sendCustomerReply({
  to,
  subject,
  message,
  inReplyTo,
  references
}: SendCustomerReplyInput): Promise<void> {
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
    });

    try {
      await withTimeout(
        transporter.sendMail({
          from: config.user,
          to,
          subject: normalizeSubject(subject),
          text: message,
          inReplyTo: inReplyTo || undefined,
          references: references?.length ? references : undefined
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

  const hint =
    process.env.RENDER === "true"
      ? isGmail
        ? " אם זה נמשך: בדוק ב-Render ש־Outbound SMTP לא חסום, וש־App Password של Gmail תקף (2FA). אפשר גם להגדיר EMAIL_SMTP_TRY_465=true רק אם 587 לא זמין."
        : " אם זה נמשך: בדוק ב-Render ש־Outbound SMTP לא חסום ושפרטי SMTP ב-env תקינים."
      : isGmail
        ? " בדוק App Password של Gmail (2FA), וש־EMAIL_SMTP_APP_PASSWORD או EMAIL_IMAP_APP_PASSWORD מוגדרים בשרת."
        : " בדוק host/port/secure וסיסמת SMTP בשרת.";

  const prefix = isGmail ? "Gmail SMTP failed" : "SMTP failed";
  throw new Error(`${prefix} after ${attemptErrors.length} attempt(s). ${attemptErrors.join(" | ")}.${hint}`);
}
