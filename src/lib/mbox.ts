/**
 * MBOX parser for Google Takeout Gmail exports.
 *
 * Handles:
 *  - mboxrd separator lines ("From " at column 0) and `>From ` un-escaping.
 *  - Folded headers and case-insensitive lookup.
 *  - RFC 2047 encoded-word subjects/from names (Q + B encodings, any charset).
 *  - Quoted-printable and base64 transfer encodings.
 *  - multipart/* messages (prefers text/plain over text/html).
 *  - Basic HTML stripping when only HTML parts are available.
 *
 * The parser is intentionally permissive: malformed messages are skipped rather
 * than throwing so a single bad email never aborts a large Takeout import.
 */

import { repairEmailAddress } from "@/lib/email-address-repair";

export interface MboxMessage {
  senderEmail: string;
  senderName: string;
  to: string;
  /** Decoded Cc header (used with To for recipient filtering). */
  cc: string;
  subject: string;
  date: string;
  body: string;
}

export interface MboxParseOptions {
  /** Yield to the event loop every N messages so the UI can repaint. */
  yieldEvery?: number;
  onProgress?: (parsedCount: number) => void;
  /** Optional: only keep messages whose `to`/`cc` includes this address. */
  filterRecipient?: string;
  /** Optional: drop messages whose sender matches this address (e.g. yourself). */
  excludeSender?: string;
}

const sleep = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const decodeWord = (charset: string, encoding: string, data: string): string => {
  let bytes: Uint8Array;
  if (encoding.toUpperCase() === "B") {
    try {
      const binary = atob(data.replace(/\s+/g, ""));
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
    } catch {
      return data;
    }
  } else {
    const text = data.replace(/_/g, " ");
    const out: number[] = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "=" && i + 2 < text.length) {
        const byte = parseInt(text.substr(i + 1, 2), 16);
        if (!Number.isNaN(byte)) {
          out.push(byte);
          i += 2;
          continue;
        }
      }
      out.push(text.charCodeAt(i));
    }
    bytes = new Uint8Array(out);
  }
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
};

const decodeRfc2047 = (input: string): string => {
  if (!input || input.indexOf("=?") === -1) return input;
  // Collapse whitespace between adjacent encoded-words per RFC 2047 §6.2.
  const collapsed = input.replace(
    /(\?=)\s+(=\?)/g,
    "$1$2"
  );
  return collapsed.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    (_match, charset, enc, data) => {
      try {
        return decodeWord(String(charset), String(enc), String(data));
      } catch {
        return _match;
      }
    }
  );
};

const parseEmailAddress = (
  raw: string
): { name: string; email: string } => {
  const decoded = decodeRfc2047(raw).trim();
  if (!decoded) return { name: "", email: "" };

  const angle = decoded.match(/^([^<]*)<([^>]+)>/);
  if (angle) {
    return {
      name: angle[1].trim().replace(/^["']|["']$/g, ""),
      email: angle[2].trim().toLowerCase()
    };
  }

  const bare = decoded.match(/([^\s,<>]+@[^\s,<>]+)/);
  if (bare) {
    const email = bare[1].trim().toLowerCase();
    const name = decoded.replace(bare[1], "").trim().replace(/^["']|["']$/g, "");
    return { name, email };
  }

  return { name: decoded, email: "" };
};

const decodeQuotedPrintable = (input: string, charset: string): string => {
  const noSoft = input.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < noSoft.length; i++) {
    const ch = noSoft[i];
    if (ch === "=" && i + 2 < noSoft.length) {
      const byte = parseInt(noSoft.substr(i + 1, 2), 16);
      if (!Number.isNaN(byte)) {
        bytes.push(byte);
        i += 2;
        continue;
      }
    }
    const code = noSoft.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else {
      const enc = new TextEncoder().encode(ch);
      for (let j = 0; j < enc.length; j++) bytes.push(enc[j]);
    }
  }
  try {
    return new TextDecoder(charset).decode(new Uint8Array(bytes));
  } catch {
    return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  }
};

const decodeBase64 = (input: string, charset: string): string => {
  try {
    const cleaned = input.replace(/\s+/g, "");
    if (!cleaned) return "";
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    try {
      return new TextDecoder(charset).decode(bytes);
    } catch {
      return new TextDecoder("utf-8").decode(bytes);
    }
  } catch {
    return input;
  }
};

const parseHeaders = (headerText: string): Map<string, string> => {
  const headers = new Map<string, string>();
  const unfolded = headerText.replace(/\r?\n[ \t]+/g, " ");
  const lines = unfolded.split(/\r?\n/);
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key && !headers.has(key)) headers.set(key, value);
  }
  return headers;
};

const getParam = (header: string, name: string): string | null => {
  const re = new RegExp(name + '\\s*=\\s*"?([^";\\s]+)"?', "i");
  const m = header.match(re);
  return m ? m[1] : null;
};

const htmlToText = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_m, n) => {
      try {
        return String.fromCodePoint(Number(n));
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => {
      try {
        return String.fromCodePoint(parseInt(h, 16));
      } catch {
        return "";
      }
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const decodeBodyPart = (
  rawBody: string,
  encoding: string,
  charset: string
): string => {
  const enc = encoding.toLowerCase();
  if (enc === "base64") return decodeBase64(rawBody, charset);
  if (enc === "quoted-printable") return decodeQuotedPrintable(rawBody, charset);
  return rawBody;
};

const splitMultipart = (body: string, boundary: string): string[] => {
  const delimiter = "--" + boundary;
  const lines = body.split(/\r?\n/);
  const parts: string[] = [];
  let current: string[] = [];
  let inPart = false;
  for (const line of lines) {
    if (line === delimiter || line === delimiter + "--") {
      if (inPart) parts.push(current.join("\n"));
      current = [];
      inPart = line === delimiter;
      continue;
    }
    if (inPart) current.push(line);
  }
  if (inPart && current.length) parts.push(current.join("\n"));
  return parts;
};

const extractText = (
  headers: Map<string, string>,
  rawBody: string,
  depth: number
): string => {
  if (depth > 6) return rawBody;
  const contentType = headers.get("content-type") ?? "text/plain; charset=utf-8";
  const encoding = headers.get("content-transfer-encoding") ?? "7bit";
  const charset = (getParam(contentType, "charset") ?? "utf-8").toLowerCase();
  const lower = contentType.toLowerCase();

  if (lower.startsWith("multipart/")) {
    const boundary = getParam(contentType, "boundary");
    if (!boundary) return rawBody;
    const parts = splitMultipart(rawBody, boundary);
    let plain: string | null = null;
    let html: string | null = null;
    for (const part of parts) {
      const sepIdx = (() => {
        const a = part.indexOf("\r\n\r\n");
        const b = part.indexOf("\n\n");
        if (a >= 0 && (b < 0 || a < b)) return { idx: a, len: 4 };
        if (b >= 0) return { idx: b, len: 2 };
        return null;
      })();
      if (!sepIdx) continue;
      const partHeaders = parseHeaders(part.slice(0, sepIdx.idx));
      const partBody = part.slice(sepIdx.idx + sepIdx.len);
      const partCT = (partHeaders.get("content-type") ?? "").toLowerCase();
      const text = extractText(partHeaders, partBody, depth + 1);
      if (partCT.startsWith("text/plain") && plain == null) plain = text;
      else if (partCT.startsWith("text/html") && html == null) html = text;
      else if (partCT.startsWith("multipart/") && plain == null) plain = text;
    }
    return plain ?? html ?? "";
  }

  const decoded = decodeBodyPart(rawBody, encoding, charset);
  if (lower.startsWith("text/html")) return htmlToText(decoded);
  return decoded;
};

const parseSingleMessage = (msgText: string): MboxMessage | null => {
  if (!msgText.trim()) return null;
  const sepIdx = (() => {
    const a = msgText.indexOf("\r\n\r\n");
    const b = msgText.indexOf("\n\n");
    if (a >= 0 && (b < 0 || a < b)) return { idx: a, len: 4 };
    if (b >= 0) return { idx: b, len: 2 };
    return null;
  })();
  if (!sepIdx) return null;

  const headerText = msgText.slice(0, sepIdx.idx);
  const rawBody = msgText.slice(sepIdx.idx + sepIdx.len);
  const body = rawBody.replace(/^>(>*From )/gm, "$1");

  const headers = parseHeaders(headerText);
  const { name, email } = parseEmailAddress(headers.get("from") ?? "");
  const subject = decodeRfc2047(headers.get("subject") ?? "").trim();
  const to = decodeRfc2047(headers.get("to") ?? "");
  const cc = decodeRfc2047(headers.get("cc") ?? "");
  const date = headers.get("date") ?? "";
  const text = extractText(headers, body, 0).trim();

  return {
    senderEmail: repairEmailAddress(email),
    senderName: name,
    to,
    cc,
    subject,
    date,
    body: text
  };
};

export const parseMbox = async (
  text: string,
  options: MboxParseOptions = {}
): Promise<MboxMessage[]> => {
  const { yieldEvery = 200, onProgress, filterRecipient, excludeSender } = options;
  const recipientFilter = filterRecipient?.trim().toLowerCase() ?? "";
  const excludeFilter = excludeSender?.trim().toLowerCase() ?? "";

  const messages: MboxMessage[] = [];
  let buffer: string[] = [];
  let parsedSinceYield = 0;

  const flush = async () => {
    if (buffer.length === 0) return;
    const parsed = parseSingleMessage(buffer.join("\n"));
    buffer = [];
    if (!parsed) return;
    const recipients = `${parsed.to} ${parsed.cc}`.toLowerCase();
    if (recipientFilter && !recipients.includes(recipientFilter)) {
      return;
    }
    if (excludeFilter && parsed.senderEmail === excludeFilter) {
      return;
    }
    if (!parsed.senderEmail && !parsed.subject && !parsed.body) {
      return;
    }
    messages.push(parsed);
    parsedSinceYield += 1;
    if (parsedSinceYield >= yieldEvery) {
      parsedSinceYield = 0;
      onProgress?.(messages.length);
      await sleep();
    }
  };

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith("From ")) {
      await flush();
    } else {
      buffer.push(line);
    }
  }
  await flush();
  onProgress?.(messages.length);
  return messages;
};

export const isMboxFile = (file: File): boolean => {
  const name = file.name.toLowerCase();
  return name.endsWith(".mbox") || name.endsWith(".mbx");
};
