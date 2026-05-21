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
