import { extractContactFormMessage } from "@/lib/contact-form-inquiry";
import { cleanMessageForAi } from "@/lib/message-filter";

const MIN_INQUIRY_CHARS = 12;

const CONTACT_FIELD =
  /^(?:שם|name|אימייל|email|מייל|טלפון|phone|נייד|mobile|whatsapp|וואטסאפ)[\s:]*\S.+$/i;

const GENERIC_GREETINGS = [
  /^שלום[!.?\s]*$/i,
  /^היי[!.?\s]*$/i,
  /^hi[!.?\s]*$/i,
  /^hello[!.?\s]*$/i,
  /^בדיקה[!.?\s]*$/i,
  /^test[!.?\s]*$/i,
  /^thanks[!.?\s]*$/i,
  /^תודה[!.?\s]*$/i
];

const SUPPORT_HINTS =
  /אפליקצ|ג'וזיק|jusic|מנוי|פרימיום|שיר|נגן|התחבר|לא עובד|באג|תשלום|חיוב|זמר|שירים|קריוקי|copyright/i;

function hasMeaningfulText(text: string): boolean {
  return /[א-תa-z0-9]{3,}/i.test(text);
}

function isContactOnlyLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (CONTACT_FIELD.test(t)) return true;
  if (/^[\w.+-]+@[\w.-]+\.\w{2,}$/i.test(t)) return true;
  if (/^0\d[\d\s\-]{7,}$/.test(t.replace(/\s/g, ""))) return true;
  return false;
}

function isContactOnlyText(text: string): boolean {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return true;
  return lines.every(isContactOnlyLine);
}

function isGenericGreetingOnly(body: string, subject: string): boolean {
  const parts = [body.trim(), subject.trim()].filter(Boolean);
  if (parts.length === 0) return true;
  return parts.every((p) => GENERIC_GREETINGS.some((re) => re.test(p)) || p.length < 8);
}

function looksLikeSupportSubject(subject: string): boolean {
  return SUPPORT_HINTS.test(subject) && subject.trim().length >= 10;
}

/** Empty body, contact-only, or unrelated one-liners → spam (not real support requests). */
export function isEmptyOrNoiseInquiry(subject: string, body: string): boolean {
  const fromForm = extractContactFormMessage(body);
  const cleaned = fromForm.length > 0 ? fromForm : cleanMessageForAi(body);
  const subj = subject.trim();
  const combined = `${subj} ${cleaned}`.trim();

  if (!combined) return true;
  if (!hasMeaningfulText(combined)) return true;

  if (!cleaned && looksLikeSupportSubject(subj)) return false;

  if (isContactOnlyText(cleaned) && !looksLikeSupportSubject(subj)) return true;

  if (cleaned.length < MIN_INQUIRY_CHARS) {
    if (!cleaned && !looksLikeSupportSubject(subj)) return true;
    if (isGenericGreetingOnly(cleaned, subj)) return true;
  }

  if (combined.length < 28 && isGenericGreetingOnly(cleaned, subj)) return true;

  return false;
}
