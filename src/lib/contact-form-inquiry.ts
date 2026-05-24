import { repairEmailAddress } from "@/lib/email-address-repair";
import { cleanMessageForAi } from "@/lib/message-filter";

const CONTACT_FIELD_LINE =
  /^(?:שם\s*מלא|שם|אימייל|email|מייל|טלפון|phone|נייד|mobile|whatsapp|וואטסאפ)[\s:]/i;

const SITE_META_LINE =
  /^(?:קישור\s*לעמוד|IP\s*השולח|העבר\s*לטיפול|מענה\s*ללקוח|שמירת\s*הפנייה|—+)/i;

/** Website contact-form wrapper (שם מלא + phone/email fields). */
export function hasContactFormShell(body: string): boolean {
  const text = String(body ?? "");
  return (
    /שם\s*מלא\s*:/i.test(text) &&
    /(?:טלפון|אימייל|email|phone)\s*:/i.test(text)
  );
}

/** Customer message only — strips contact-form metadata and site footer lines. */
export function extractContactFormMessage(body: string): string {
  let text = cleanMessageForAi(String(body ?? ""));
  if (!text) return "";

  const msgMatch = text.match(/(?:^|\n)\s*(?:הודעה|message)\s*:\s*([\s\S]*)$/i);
  if (msgMatch) {
    text = msgMatch[1].trim();
  } else if (hasContactFormShell(text)) {
    const lines = text.split("\n");
    const kept: string[] = [];
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (CONTACT_FIELD_LINE.test(t)) continue;
      if (SITE_META_LINE.test(t)) continue;
      kept.push(line);
    }
    text = kept.join("\n").trim();
  }

  return text
    .split("\n")
    .filter((line) => !SITE_META_LINE.test(line.trim()))
    .join("\n")
    .trim();
}

/** Text shown in rapid-reply / triage — inquiry body only. */
export function extractInquiryForDisplay(body: string, subject = ""): string {
  const fromForm = extractContactFormMessage(body);
  if (fromForm.length >= 4) return fromForm;
  const cleaned = cleanMessageForAi(body);
  if (cleaned.length >= 4) return cleaned;
  return subject.trim() || "(אין תוכן בפנייה)";
}

const WEBSITE_SUBJECT_MARKERS = [/הודעה\s*חדשה\s*באתר\s*Jusic/i];

const RELAY_MAILBOXES = new Set(["editor@jusic.co", "info@jusic.co"]);

export type WebsiteContactUnwrap = {
  senderEmail: string;
  senderName: string;
  subject: string;
  body: string;
};

function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

function decodeHtmlEntities(value: string): string {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#064;|&commat;/gi, "@")
    .replace(/&quot;/gi, "\"")
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u200e|\u200f|\u202a|\u202b|\u202c/g, "");
}

function fieldBetween(body: string, startLabel: string, endLabels: string[]): string {
  const start = body.indexOf(startLabel);
  if (start === -1) return "";
  const valueStart = start + startLabel.length;
  let end = body.length;
  for (const endLabel of endLabels) {
    const i = body.indexOf(endLabel, valueStart);
    if (i !== -1 && i < end) end = i;
  }
  return body.slice(valueStart, end).replace(/\s+/g, " ").trim();
}

function extractEmailFromField(raw: string): string {
  const match = raw.match(/[\w.+-]+@[\w.-]+\.\w{2,}/i);
  return match ? match[0].trim().toLowerCase() : raw.trim().toLowerCase();
}

function shortenText(value: string, maxLen: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1).trim()}…`;
}

/** Inbound mail relayed from our site contact form (EDITOR@JUSIC.CO / hosting). */
export function isWebsiteContactRelaySender(senderEmail: string, ownerEmail?: string): boolean {
  const email = normalizeEmailAddress(senderEmail);
  const owner = normalizeEmailAddress(ownerEmail ?? "editor@jusic.co");
  if (email === owner) return true;
  if (RELAY_MAILBOXES.has(email)) return true;
  const domain = email.split("@")[1] ?? "";
  return /\.sgvps\.net$/i.test(domain);
}

export function isWebsiteContactRelayContent(subject: string, body: string): boolean {
  const subj = String(subject ?? "");
  const text = decodeHtmlEntities(String(body ?? ""));
  if (WEBSITE_SUBJECT_MARKERS.some((pattern) => pattern.test(subj))) return true;
  if (text.includes("שם מלא:") && text.includes("הודעה:")) return true;
  return hasContactFormShell(text);
}

/** Website form relay — not our own outgoing mail; treat as customer inquiry. */
export function isWebsiteContactRelay(
  senderEmail: string,
  subject: string,
  body: string,
  ownerEmail?: string
): boolean {
  return (
    isWebsiteContactRelaySender(senderEmail, ownerEmail) &&
    isWebsiteContactRelayContent(subject, body)
  );
}

/** Extract real customer fields from a website contact-form relay email. */
export function unwrapWebsiteContactRelay(
  senderEmail: string,
  senderName: string,
  subject: string,
  body: string,
  ownerEmail?: string
): WebsiteContactUnwrap | null {
  if (!isWebsiteContactRelay(senderEmail, subject, body, ownerEmail)) return null;

  const decodedBody = decodeHtmlEntities(body);
  const name = fieldBetween(decodedBody, "שם מלא:", [
    "טלפון נייד:",
    "טלפון:",
    "אימייל:",
    "הודעה:"
  ]);
  const phone =
    fieldBetween(decodedBody, "טלפון נייד:", ["אימייל:", "הודעה:", "---תאריך:", "תאריך:"]) ||
    fieldBetween(decodedBody, "טלפון:", ["אימייל:", "הודעה:", "---תאריך:", "תאריך:"]);
  const emailRaw = fieldBetween(decodedBody, "אימייל:", ["הודעה:", "---תאריך:", "תאריך:"]);
  const message = fieldBetween(decodedBody, "הודעה:", [
    "---תאריך:",
    "תאריך:",
    "קישור לעמוד:",
    "פרטי משתמש:",
    "IP השולח:"
  ]);
  const pageUrl = fieldBetween(decodedBody, "קישור לעמוד:", [
    "פרטי משתמש:",
    "IP השולח:",
    "מופעל באמצעות:"
  ]);
  const ip = fieldBetween(decodedBody, "IP השולח:", ["מופעל באמצעות:"]);

  const customerEmail = repairEmailAddress(extractEmailFromField(emailRaw));
  const primaryText = message || decodedBody.replace(/\s+/g, " ").trim();
  const metadata = [
    name ? `שם מלא: ${name}` : "",
    phone ? `טלפון: ${phone}` : "",
    customerEmail ? `אימייל: ${customerEmail}` : "",
    "",
    "הודעה:",
    primaryText || "(ללא תוכן)",
    "",
    pageUrl ? `קישור לעמוד: ${pageUrl}` : "",
    ip ? `IP השולח: ${ip}` : ""
  ]
    .filter((line, index, arr) => line || (arr[index - 1] && arr[index + 1]))
    .join("\n")
    .trim();

  return {
    senderEmail: customerEmail || "website-form@noreply.jusic.co",
    senderName: name || senderName.trim() || customerEmail || "פנייה מהאתר",
    subject: primaryText
      ? `פנייה מהאתר: ${shortenText(primaryText, 90)}`
      : subject.trim() || "פנייה מהאתר",
    body: metadata || decodedBody
  };
}
