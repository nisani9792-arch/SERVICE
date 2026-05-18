/**
 * Strips email noise before LLM classification — signatures, quotes, HTML bloat.
 */

const MAX_AI_BODY_CHARS = 6000;

const SIGNATURE_MARKERS = [
  /^--\s*$/m,
  /^sent from my /im,
  /^נשלח מה-iPhone/im,
  /^בברכה[,\s]/im,
  /^best regards[,\s]/im,
  /^regards[,\s]/im,
  /^thanks[,\s]/im,
  /^תודה[,\s]/im
];

const QUOTE_LINE = /^(>|\|)/;
const QUOTE_HEADER =
  /^(on .+ wrote:|ב-?.+ כתב(?:\/ה)?:|מאת:|from:|-----original message-----)/im;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(html: string): string {
  let text = html;
  text = text.replace(/<style[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<script[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(text);
}

function trimAtSignature(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    if (SIGNATURE_MARKERS.some((re) => re.test(line.trim()))) break;
    kept.push(line);
  }
  return kept.join("\n");
}

function trimQuotedThread(text: string): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (QUOTE_LINE.test(trimmed)) break;
    if (QUOTE_HEADER.test(trimmed)) break;
    kept.push(line);
  }
  return kept.join("\n");
}

function collapseWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Distilled message body for AI prompts and storage. */
export function cleanMessageForAi(raw: string): string {
  const input = String(raw ?? "").trim();
  if (!input) return "";

  const looksHtml = /<[a-z][\s\S]*>/i.test(input);
  let text = looksHtml ? stripHtml(input) : input;
  text = trimQuotedThread(text);
  text = trimAtSignature(text);
  text = collapseWhitespace(text);

  if (text.length > MAX_AI_BODY_CHARS) {
    text = `${text.slice(0, MAX_AI_BODY_CHARS)}…`;
  }
  return text;
}

export function bodyForAiPrompt(rawBody: string, storedCleaned?: string | null): string {
  const cleaned = storedCleaned?.trim();
  if (cleaned) return cleaned;
  return cleanMessageForAi(rawBody);
}
