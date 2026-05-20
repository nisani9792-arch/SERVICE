import { cleanMessageForAi } from "@/lib/message-filter";
import {
  DEFAULT_REPLY_CLOSING,
  DEFAULT_REPLY_OPENING,
  type ReplySignature
} from "@/lib/reply-signature";

const INQUIRY_CONTEXT_BLOCK =
  /^-{3,}\s*\n\s*פנייה[\s\S]*?\n-{3,}\s*$/gim;

const GENERIC_OPENINGS = [
  /^היי[.\s,!:]*$/im,
  /^שלום[.\s,!:]*$/im,
  /^בהמשך לפנייתך[^\n]*$/im,
  /^בברכה[^\n]*$/im
];

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Customer inquiry only — no signatures or reply boilerplate. */
export function extractFreeInquiryText(raw: string): string {
  let text = cleanMessageForAi(String(raw ?? ""));
  text = text.replace(INQUIRY_CONTEXT_BLOCK, "").trim();
  for (const re of GENERIC_OPENINGS) {
    text = text.replace(re, "").trim();
  }
  return collapse(text);
}

/** Operator free-text reply only — strips opening, closing, and inquiry reference block. */
export function extractFreeReplyText(
  raw: string,
  signature?: Pick<ReplySignature, "opening" | "closing">
): string {
  let text = String(raw ?? "").trim();
  if (!text) return "";

  text = text.replace(INQUIRY_CONTEXT_BLOCK, "").trim();

  const opening = (signature?.opening ?? DEFAULT_REPLY_OPENING).trim();
  const closing = (signature?.closing ?? DEFAULT_REPLY_CLOSING).trim();

  if (opening && text.startsWith(opening)) {
    text = text.slice(opening.length).trim();
  }
  if (closing && text.endsWith(closing)) {
    text = text.slice(0, -closing.length).trim();
  }

  const lines = text.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (kept.length) kept.push("");
      continue;
    }
    if (/^פנייה\s+#?TK/i.test(t)) continue;
    if (GENERIC_OPENINGS.some((re) => re.test(t))) continue;
    kept.push(line);
  }

  return collapse(kept.join("\n"));
}
