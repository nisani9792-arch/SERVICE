import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";

/** Scopes for send + inbox read/archive (HTTPS — works on Render; IMAP often times out). */
export const GMAIL_API_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify"
] as const;

export type GmailSendInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  fromEmail?: string;
  fromName?: string;
  messageId?: string | null;
  inReplyTo?: string | null;
  references?: string[];
};

export type GmailSendResult = {
  gmailId: string;
  messageId: string;
};

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.map((v) => v?.trim()).find(Boolean);
}

function encodeRawMessage(raw: string): string {
  return Buffer.from(raw, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function formatHeaderMessageId(value: string | null | undefined): string | undefined {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/^<|>$/g, "");
  if (!cleaned || !cleaned.includes("@")) return undefined;
  return `<${cleaned}>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildMimeMessage(input: GmailSendInput): string {
  const fromEmail =
    firstNonEmpty(input.fromEmail, process.env.EMAIL_FROM, process.env.EMAIL_IMAP_USER) ??
    "editor@jusic.co";
  const fromName = firstNonEmpty(input.fromName, process.env.EMAIL_FROM_NAME) ?? "Jusic";
  const from = `${fromName} <${fromEmail}>`;
  const subject = input.subject.trim() || "פנייה ל-Jusic";
  const to = input.to.trim();

  const headers: string[] = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`,
    "MIME-Version: 1.0"
  ];

  const outboundId = formatHeaderMessageId(input.messageId);
  if (outboundId) headers.push(`Message-ID: ${outboundId}`);

  const inReplyTo = formatHeaderMessageId(input.inReplyTo);
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`);

  const refs = (input.references ?? [])
    .map((r) => formatHeaderMessageId(r))
    .filter((r): r is string => Boolean(r));
  if (refs.length) headers.push(`References: ${refs.join(" ")}`);

  const textBody = input.text.trim();
  const htmlBody =
    input.html?.trim() ||
    `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6"><p>${escapeHtml(textBody).replace(/\n/g, "<br>")}</p></div>`;

  const boundary = `service_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  const parts = [
    headers.join("\r\n"),
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(textBody, "utf-8").toString("base64"),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(htmlBody, "utf-8").toString("base64"),
    `--${boundary}--`,
    ""
  ];

  return parts.join("\r\n");
}

function getOAuthClient() {
  const clientId = firstNonEmpty(process.env.GMAIL_CLIENT_ID);
  const clientSecret = firstNonEmpty(process.env.GMAIL_CLIENT_SECRET);
  const refreshToken = firstNonEmpty(process.env.GMAIL_REFRESH_TOKEN);

  if (!clientId || !clientSecret) {
    throw new Error("GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set");
  }
  if (!refreshToken) {
    throw new Error(
      "GMAIL_REFRESH_TOKEN חסר. הרץ scripts/gmail_mailer.py פעם אחת לאימות, והעתק את refresh_token ל-Render."
    );
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken, scope: GMAIL_API_SCOPES.join(" ") });
  return oauth2;
}

export function getGmailApiClient(): gmail_v1.Gmail {
  const auth = getOAuthClient();
  return google.gmail({ version: "v1", auth });
}

export type GmailEnvPresence = {
  clientId: boolean;
  clientSecret: boolean;
  refreshToken: boolean;
};

export function getGmailEnvPresence(): GmailEnvPresence {
  return {
    clientId: Boolean(firstNonEmpty(process.env.GMAIL_CLIENT_ID)),
    clientSecret: Boolean(firstNonEmpty(process.env.GMAIL_CLIENT_SECRET)),
    refreshToken: Boolean(firstNonEmpty(process.env.GMAIL_REFRESH_TOKEN))
  };
}

export function getMissingGmailEnvKeys(): string[] {
  const presence = getGmailEnvPresence();
  const missing: string[] = [];
  if (!presence.clientId) missing.push("GMAIL_CLIENT_ID");
  if (!presence.clientSecret) missing.push("GMAIL_CLIENT_SECRET");
  if (!presence.refreshToken) missing.push("GMAIL_REFRESH_TOKEN");
  return missing;
}

export function formatGmailConfigError(): string {
  const missing = getMissingGmailEnvKeys();
  if (missing.length === 0) {
    return "Gmail API לא מוגדר. בדוק שהערכים ב-Render שייכים לשירות Web (jusic-crm) ולחץ Manual Deploy.";
  }
  return `Gmail API לא מוגדר — חסר ב-Environment (שירות Web): ${missing.join(", ")}. אחרי עדכון: Manual Deploy.`;
}

export function isGmailApiConfigured(): boolean {
  const presence = getGmailEnvPresence();
  return presence.clientId && presence.clientSecret && presence.refreshToken;
}

/** User-facing hint when Google rejects OAuth (common after wrong secrets paste). */
export function formatGmailOAuthError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message)
        : String(error ?? "");
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const blob = `${code} ${raw}`.toLowerCase();

  if (blob.includes("unauthorized_client")) {
    return [
      "Gmail OAuth: unauthorized_client — ה-Client ID וה-Client Secret לא שייכים לאותו OAuth Client,",
      "או שה-Refresh Token הונפק עבור אפליקציה אחרת.",
      "ב-Google Cloud צור OAuth Client מסוג Desktop (לא Web), הרץ:",
      "python scripts/gmail_mailer.py auth-only",
      "והעתק את GMAIL_REFRESH_TOKEN ל-Render. או הגדר EMAIL_REPLY_PROVIDER=smtp + App Password.",
    ].join(" ");
  }
  if (blob.includes("invalid_grant")) {
    return [
      "Gmail OAuth: invalid_grant — ה-Refresh Token לא תקף (בוטל או הוחלף).",
      "הרץ שוב: python scripts/gmail_mailer.py auth-only והדבק refresh_token חדש ב-Render.",
    ].join(" ");
  }
  return raw || "Gmail API send failed";
}

export async function sendViaGmailApi(input: GmailSendInput): Promise<GmailSendResult> {
  const auth = getOAuthClient();
  const gmail = google.gmail({ version: "v1", auth });
  const raw = buildMimeMessage(input);

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodeRawMessage(raw) }
  });

  const gmailId = response.data.id ?? `gmail-${Date.now()}`;
  const domain =
    firstNonEmpty(input.fromEmail, process.env.EMAIL_FROM)?.split("@")[1] ?? "gmail.com";
  const messageId =
    formatHeaderMessageId(input.messageId)?.replace(/^<|>$/g, "") ??
    `gmail.${gmailId}@${domain}`;

  return { gmailId, messageId };
}
