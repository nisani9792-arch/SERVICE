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

  const port = positiveInt(process.env.EMAIL_SMTP_PORT, 465);
  return {
    user,
    appPassword,
    host: process.env.EMAIL_SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    secure: (process.env.EMAIL_SMTP_SECURE ?? "true") !== "false",
    timeoutMs: positiveInt(process.env.EMAIL_SMTP_TIMEOUT_MS, 15000)
  };
}

function emailSendConfigs(): EmailSendConfig[] {
  const configured = getEmailSendConfig();
  const candidates: EmailSendConfig[] = [configured];

  if (configured.host === "smtp.gmail.com") {
    candidates.push(
      { ...configured, port: 587, secure: false },
      { ...configured, port: 465, secure: true }
    );
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

export async function sendCustomerReply({
  to,
  subject,
  message,
  inReplyTo,
  references
}: SendCustomerReplyInput): Promise<void> {
  let lastError: unknown = null;

  for (const config of emailSendConfigs()) {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.port === 587,
      connectionTimeout: config.timeoutMs,
      greetingTimeout: config.timeoutMs,
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
      await transporter.sendMail({
        from: config.user,
        to,
        subject: normalizeSubject(subject),
        text: message,
        inReplyTo: inReplyTo || undefined,
        references: references?.length ? references : undefined
      });
      return;
    } catch (error) {
      lastError = error;
    } finally {
      transporter.close();
    }
  }

  throw new Error(
    lastError instanceof Error
      ? `Gmail SMTP failed: ${lastError.message}`
      : "Gmail SMTP failed"
  );
}
