import { sql } from "@/lib/neon";
import { isSpamCategory } from "@/lib/spam-category";

let schemaReady: Promise<void> | null = null;

export async function ensureReplyKnowledgeSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS ticket_reply_knowledge (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          ticket_id TEXT,
          subject TEXT NOT NULL DEFAULT '',
          inquiry_snippet TEXT NOT NULL DEFAULT '',
          reply_text TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT '',
          keywords TEXT[] NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql()`
        CREATE INDEX IF NOT EXISTS idx_reply_knowledge_created
        ON ticket_reply_knowledge (created_at DESC)
      `;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

const STOP_WORDS = new Set([
  "של",
  "על",
  "את",
  "זה",
  "לא",
  "כי",
  "גם",
  "אני",
  "the",
  "and",
  "for",
  "you",
  "your",
  "with",
  "from",
  "this",
  "that",
  "have",
  "are",
  "was"
]);

export function extractKeywords(text: string, max = 24): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\u0590-\u05FF@.\s-]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= max) break;
  }
  return out;
}

export async function recordReplyKnowledge(input: {
  ticketId: string;
  subject: string;
  inquiryText: string;
  replyText: string;
  category: string;
}): Promise<void> {
  if (isSpamCategory(input.category)) return;
  const reply = input.replyText.trim();
  if (reply.length < 12) return;

  await ensureReplyKnowledgeSchema();
  const keywords = extractKeywords(`${input.subject}\n${input.inquiryText}`);

  await sql()`
    INSERT INTO ticket_reply_knowledge (
      ticket_id, subject, inquiry_snippet, reply_text, category, keywords
    )
    VALUES (
      ${input.ticketId},
      ${input.subject.trim()},
      ${input.inquiryText.trim().slice(0, 2000)},
      ${reply.slice(0, 8000)},
      ${input.category.trim()},
      ${keywords}
    )
  `;
}

export type SimilarReplySuggestion = {
  id: string;
  subject: string;
  inquirySnippet: string;
  replyText: string;
  category: string;
  score: number;
  createdAt: string;
};

export async function findSimilarReplySuggestions(
  subject: string,
  inquiryText: string,
  limit = 5
): Promise<SimilarReplySuggestion[]> {
  await ensureReplyKnowledgeSchema();
  const keywords = extractKeywords(`${subject}\n${inquiryText}`);
  if (keywords.length === 0) return [];

  const rows = await sql()`
    SELECT id, subject, inquiry_snippet, reply_text, category, keywords, created_at
    FROM ticket_reply_knowledge
    ORDER BY created_at DESC
    LIMIT 400
  `;

  const scored: SimilarReplySuggestion[] = [];
  for (const row of rows) {
    const rowKeywords = Array.isArray((row as { keywords: string[] }).keywords)
      ? ((row as { keywords: string[] }).keywords as string[])
      : [];
    const overlap = keywords.filter((k) => rowKeywords.includes(k)).length;
    if (overlap === 0) continue;

    const subjectBonus =
      String((row as { subject: string }).subject ?? "")
        .toLowerCase()
        .includes(subject.toLowerCase().slice(0, 20)) && subject.length > 5
        ? 2
        : 0;

    scored.push({
      id: String((row as { id: string }).id),
      subject: String((row as { subject: string }).subject ?? ""),
      inquirySnippet: String((row as { inquiry_snippet: string }).inquiry_snippet ?? ""),
      replyText: String((row as { reply_text: string }).reply_text ?? ""),
      category: String((row as { category: string }).category ?? ""),
      score: overlap + subjectBonus,
      createdAt: String((row as { created_at: string }).created_at)
    });
  }

  scored.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));
  return scored.slice(0, limit);
}

/** Backfill knowledge from tickets that already have closure notes. */
export async function backfillReplyKnowledgeFromTickets(limit = 500): Promise<number> {
  await ensureReplyKnowledgeSchema();

  const rows = await sql()`
    SELECT id, subject, body, body_cleaned, closure_note, category
    FROM tickets
    WHERE deleted_at IS NULL
      AND closure_note IS NOT NULL
      AND length(trim(closure_note)) > 20
      AND NOT (lower(trim(category)) IN ('spam', 'spam (מובנה)'))
      AND id NOT IN (SELECT ticket_id FROM ticket_reply_knowledge WHERE ticket_id IS NOT NULL)
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `;

  let inserted = 0;
  for (const row of rows) {
    const ticketId = String((row as { id: string }).id);
    await recordReplyKnowledge({
      ticketId,
      subject: String((row as { subject: string }).subject ?? ""),
      inquiryText: String(
        (row as { body_cleaned: string }).body_cleaned ||
          (row as { body: string }).body ||
          ""
      ),
      replyText: String((row as { closure_note: string }).closure_note ?? ""),
      category: String((row as { category: string }).category ?? "")
    });
    inserted += 1;
  }
  return inserted;
}
