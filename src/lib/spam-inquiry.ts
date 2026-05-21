import {
  extractContactFormMessage,
  hasContactFormShell
} from "@/lib/contact-form-inquiry";
import { isEmptyOrNoiseInquiry } from "@/lib/inquiry-spam-heuristic";
import { isMarketingSpamInquiry } from "@/lib/marketing-spam-heuristic";
import { cleanMessageForAi } from "@/lib/message-filter";

const SITE_TEST_PATTERNS = [
  /^רק\s+בדיקה[!.?\s]*$/i,
  /^בדיקה\s*בלבד[!.?\s]*$/i,
  /בדיקת?\s*האתר/i,
  /רציתי\s+לבדוק/i,
  /רק\s+רציתי\s+לראות/i,
  /לבדוק\s+איך\s+האתר/i,
  /איך\s+האתר\s+עובד/i,
  /^just\s+testing[!.?\s]*$/i,
  /^only\s+a\s+test[!.?\s]*$/i,
  /testing\s+(the\s+)?(site|form|website)/i,
  /checking\s+if\s+(the\s+)?(site|form)\s+works/i,
  /wanted\s+to\s+see\s+how/i
];

const MEANINGLESS_QUESTION =
  /^(מה\s+זה|מה\s+זה\?|מה\s+קורה|מה\s+המצב|היי\??|hello\??|hi\??|test\??|בדיקה\??|שלום\??)[!.?\s]*$/i;

const MAILING_LIST_PATTERNS = [
  /unsubscribe/i,
  /mailing\s+list/i,
  /newsletter/i,
  /you\s+are\s+receiving\s+this/i,
  /remove\s+(me\s+)?from\s+(the\s+)?list/i,
  /opt[\s-]?out/i,
  /email\s+preferences/i,
  /no\s+longer\s+wish\s+to\s+receive/i,
  /list-unsubscribe/i,
  /bulk\s+email/i,
  /promotional\s+email/i
];

export function isSiteTestInquiry(subject: string, message: string): boolean {
  const parts = [message.trim(), subject.trim(), `${subject} ${message}`.trim()].filter(Boolean);
  return parts.some((text) => SITE_TEST_PATTERNS.some((re) => re.test(text)));
}

export function isMailingListSpam(subject: string, body: string): boolean {
  const text = `${subject} ${body}`.trim();
  return MAILING_LIST_PATTERNS.some((re) => re.test(text));
}

export function isContactFormProbe(subject: string, body: string): boolean {
  if (!hasContactFormShell(body)) return false;
  const message = extractContactFormMessage(body);
  if (!message || message.length < 4) return true;
  if (isSiteTestInquiry(subject, message)) return true;
  if (MEANINGLESS_QUESTION.test(message.trim())) return true;
  return isEmptyOrNoiseInquiry(subject, message);
}

/** Unified spam check for sweep, ingest, and audits. */
export function isLikelySpamInquiry(subject: string, body: string): boolean {
  const raw = String(body ?? "");
  const message = extractContactFormMessage(raw) || cleanMessageForAi(raw);

  if (isEmptyOrNoiseInquiry(subject, message)) return true;
  if (isMarketingSpamInquiry(subject, raw)) return true;
  if (isMailingListSpam(subject, raw)) return true;
  if (isSiteTestInquiry(subject, message)) return true;
  if (isContactFormProbe(subject, raw)) return true;

  return false;
}
