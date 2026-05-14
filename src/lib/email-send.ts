import nodemailer from "nodemailer";

type EmailSendConfig = {
  user: string;
  appPassword: string;
  host: string;
  port: number;
  secure: boolean;
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

function getEmailSendConfig(): EmailSendConfig {
  const user = (
    process.env.EMAIL_SMTP_USER ??
    process.env.EMAIL_IMAP_USER ??
    process.env.GMAIL_USER
  )?.trim();
  const appPassword = (
    process.env.EMAIL_SMTP_APP_PASSWORD ??
    process.env.EMAIL_IMAP_APP_PASSWORD ??
    process.env.GMAIL_APP_PASSWORD
  )
    ?.replace(/\s+/g, "")
    .trim();

  if (!user || !appPassword) {
    throw new Error("EMAIL_SMTP_USER/EMAIL_IMAP_USER and app password must be configured");
  }

  const port = positiveInt(process.env.EMAIL_SMTP_PORT, 465);
  return {
    user,
    appPassword,
    host: process.env.EMAIL_SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    secure: (process.env.EMAIL_SMTP_SECURE ?? "true") !== "false"
  };
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
  const config = getEmailSendConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.appPassword
    }
  });

  await transporter.sendMail({
    from: config.user,
    to,
    subject: normalizeSubject(subject),
    text: message,
    inReplyTo: inReplyTo || undefined,
    references: references?.length ? references : undefined
  });
}
