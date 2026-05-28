import { sql } from "@/lib/neon";
import { extractInquiryTopicProfile, rankReplySuggestionsWithGemini } from "@/lib/reply-knowledge-ai";
import { extractKeywords } from "@/lib/reply-knowledge-keywords";
import { extractFreeInquiryText, extractFreeReplyText } from "@/lib/reply-text-extract";
import { getReplySignature, type ReplySignature } from "@/lib/reply-signature";
import { isSpamCategory } from "@/lib/spam-category";

export { extractKeywords } from "@/lib/reply-knowledge-keywords";

let schemaReady: Promise<void> | null = null;

const MIN_SUGGESTION_SCORE = 10;
const MIN_KEYWORD_OVERLAP = 2;
const MIN_OVERLAP_RATIO = 0.34;

/** Smart reply suggestions disabled — inaccurate for operators. */
export const REPLY_SUGGESTIONS_ENABLED = false;

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
          question_key TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql()`
        ALTER TABLE ticket_reply_knowledge
        ADD COLUMN IF NOT EXISTS question_key TEXT NOT NULL DEFAULT ''
      `;
      await sql()`
        CREATE INDEX IF NOT EXISTS idx_reply_knowledge_created
        ON ticket_reply_knowledge (created_at DESC)
      `;
      await sql()`
        CREATE INDEX IF NOT EXISTS idx_reply_knowledge_question_key
        ON ticket_reply_knowledge (question_key)
      `;
      await sql()`
        CREATE TABLE IF NOT EXISTS reply_topic_patterns (
          question_key TEXT PRIMARY KEY,
          sample_subject TEXT NOT NULL DEFAULT '',
          sample_inquiry TEXT NOT NULL DEFAULT '',
          reply_text TEXT NOT NULL DEFAULT '',
          hit_count INT NOT NULL DEFAULT 1,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

/** Stable fingerprint for recurring questions (inquiry body only, not subject line). */
export function buildQuestionKey(_subject: string, inquiryText: string): string {
  const inquiry = extractFreeInquiryText(inquiryText);
  const keywords = extractKeywords(inquiry, 10);
  if (keywords.length >= 2) {
    return keywords.slice(0, 8).sort().join("|");
  }
  const fallback = inquiry
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05FF]+/g, " ")
    .trim()
    .slice(0, 80);
  return fallback || "unknown";
}

function keywordOverlapRatio(query: string[], rowKeywords: string[]): number {
  if (query.length === 0 || rowKeywords.length === 0) return 0;
  const rowSet = new Set(rowKeywords);
  const overlap = query.filter((k) => rowSet.has(k)).length;
  return overlap / query.length;
}

/** Strip stored/full composed replies down to operator free text for UI suggestions. */
function freeReplyForSuggestion(
  raw: string,
  signature: Pick<ReplySignature, "opening" | "closing">
): string {
  const free = extractFreeReplyText(raw, signature);
  return free || String(raw ?? "").trim();
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let inter = 0;
  for (const token of a) {
    if (setB.has(token)) inter += 1;
  }
  const union = new Set([...a, ...b]).size;
  return union > 0 ? inter / union : 0;
}

async function upsertTopicPattern(input: {
  questionKey: string;
  subject: string;
  inquiryText: string;
  replyText: string;
}): Promise<void> {
  await sql()`
    INSERT INTO reply_topic_patterns (
      question_key, sample_subject, sample_inquiry, reply_text, hit_count, updated_at
    )
    VALUES (
      ${input.questionKey},
      ${input.subject.trim().slice(0, 200)},
      ${input.inquiryText.trim().slice(0, 500)},
      ${input.replyText.trim().slice(0, 4000)},
      ${1},
      now()
    )
    ON CONFLICT (question_key) DO UPDATE
    SET hit_count = reply_topic_patterns.hit_count + 1,
        reply_text = EXCLUDED.reply_text,
        sample_inquiry = EXCLUDED.sample_inquiry,
        sample_subject = EXCLUDED.sample_subject,
        updated_at = now()
  `;
}

export async function recordReplyKnowledge(input: {
  ticketId: string;
  subject: string;
  inquiryText: string;
  replyText: string;
  category: string;
}): Promise<void> {
  if (isSpamCategory(input.category)) return;

  const signature = await getReplySignature();
  const freeInquiry = extractFreeInquiryText(input.inquiryText);
  const freeReply = extractFreeReplyText(input.replyText, signature);

  if (freeReply.length < 12 || freeInquiry.length < 6) return;

  await ensureReplyKnowledgeSchema();
  const topicProfile = await extractInquiryTopicProfile(input.subject, freeInquiry);
  const baseKeywords = extractKeywords(freeInquiry, 20);
  const aiKeywords = topicProfile?.keywords ?? [];
  const topicTokens = (topicProfile?.topics ?? []).map((t) =>
    t.toLowerCase().replace(/\s+/g, "_").slice(0, 40)
  );
  const keywords = Array.from(new Set([...baseKeywords, ...aiKeywords, ...topicTokens])).slice(0, 28);
  const questionKey =
    topicTokens.length >= 2
      ? topicTokens.slice(0, 6).sort().join("|")
      : buildQuestionKey(input.subject, freeInquiry);

  await sql()`
    INSERT INTO ticket_reply_knowledge (
      ticket_id, subject, inquiry_snippet, reply_text, category, keywords, question_key
    )
    VALUES (
      ${input.ticketId},
      ${input.subject.trim()},
      ${freeInquiry.slice(0, 2000)},
      ${freeReply.slice(0, 8000)},
      ${input.category.trim()},
      ${keywords},
      ${questionKey}
    )
  `;

  await upsertTopicPattern({
    questionKey,
    subject: input.subject,
    inquiryText: freeInquiry,
    replyText: freeReply
  });
}

export type SimilarReplySuggestion = {
  id: string;
  subject: string;
  inquirySnippet: string;
  replyText: string;
  category: string;
  score: number;
  createdAt: string;
  matchReason: string;
  recurring: boolean;
  hitCount?: number;
};

async function findRecurringSuggestions(
  questionKey: string,
  subject: string,
  limit: number,
  signature: Pick<ReplySignature, "opening" | "closing">
): Promise<SimilarReplySuggestion[]> {
  const rows = await sql()`
    SELECT question_key, sample_subject, sample_inquiry, reply_text, hit_count, updated_at
    FROM reply_topic_patterns
    WHERE question_key = ${questionKey}
    ORDER BY hit_count DESC, updated_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => {
    const hitCount = Number((row as { hit_count: number }).hit_count ?? 1);
    return {
      id: `topic:${String((row as { question_key: string }).question_key)}`,
      subject: String((row as { sample_subject: string }).sample_subject ?? ""),
      inquirySnippet: String((row as { sample_inquiry: string }).sample_inquiry ?? ""),
      replyText: freeReplyForSuggestion(
        String((row as { reply_text: string }).reply_text ?? ""),
        signature
      ),
      category: "",
      score: 40 + hitCount * 5,
      createdAt: String((row as { updated_at: string }).updated_at ?? ""),
      matchReason:
        hitCount >= 2
          ? `שאלה חוזרת (${hitCount} פעמים)`
          : "נושא דומה שחזר בעבר",
      recurring: hitCount >= 2,
      hitCount
    };
  });
}

export async function findSimilarReplySuggestions(
  subject: string,
  inquiryText: string,
  limit = 5
): Promise<SimilarReplySuggestion[]> {
  if (!REPLY_SUGGESTIONS_ENABLED) return [];

  await ensureReplyKnowledgeSchema();
  const signature = await getReplySignature();

  const freeInquiry = extractFreeInquiryText(inquiryText);
  if (freeInquiry.length < 6) return [];

  const questionKey = buildQuestionKey(subject, freeInquiry);
  const queryKeywords = extractKeywords(freeInquiry, 24);

  const recurring = await findRecurringSuggestions(questionKey, subject, limit, signature);
  const seenReply = new Set<string>();
  const out: SimilarReplySuggestion[] = [];

  for (const item of recurring) {
    const key = item.replyText.slice(0, 120);
    if (seenReply.has(key)) continue;
    seenReply.add(key);
    out.push(item);
    if (out.length >= limit) return out;
  }

  if (queryKeywords.length === 0) return out;

  const rows = await sql()`
    SELECT id, subject, inquiry_snippet, reply_text, category, keywords, question_key, created_at
    FROM ticket_reply_knowledge
    WHERE length(trim(inquiry_snippet)) >= 6
      AND length(trim(reply_text)) >= 12
    ORDER BY created_at DESC
    LIMIT 500
  `;

  const scored: SimilarReplySuggestion[] = [];

  for (const row of rows) {
    const rowKeywords = Array.isArray((row as { keywords: string[] }).keywords)
      ? ((row as { keywords: string[] }).keywords as string[])
      : [];
    const rowInquiry = String((row as { inquiry_snippet: string }).inquiry_snippet ?? "");
    const rowKey = String((row as { question_key: string }).question_key ?? "");

    const overlap = queryKeywords.filter((k) => rowKeywords.includes(k)).length;
    const overlapRatio = keywordOverlapRatio(queryKeywords, rowKeywords);
    if (overlap < MIN_KEYWORD_OVERLAP && overlapRatio < MIN_OVERLAP_RATIO) continue;

    const jaccard = jaccardSimilarity(queryKeywords, rowKeywords);
    const sameQuestion = rowKey === questionKey;

    const score =
      overlap * 3 +
      Math.round(overlapRatio * 20) +
      Math.round(jaccard * 25) +
      (sameQuestion ? 15 : 0);

    if (score < MIN_SUGGESTION_SCORE) continue;

    const matchParts: string[] = [];
    if (sameQuestion) matchParts.push("אותה שאלה");
    if (overlap >= 3) matchParts.push(`${overlap} מילות מפתח משותפות`);
    else if (overlapRatio >= 0.5) matchParts.push("נושא קרוב");
    else matchParts.push("דמיון בניסוח הפנייה");

    scored.push({
      id: String((row as { id: string }).id),
      subject: String((row as { subject: string }).subject ?? ""),
      inquirySnippet: rowInquiry,
      replyText: freeReplyForSuggestion(
        String((row as { reply_text: string }).reply_text ?? ""),
        signature
      ),
      category: String((row as { category: string }).category ?? ""),
      score,
      createdAt: String((row as { created_at: string }).created_at),
      matchReason: matchParts.join(" · "),
      recurring: sameQuestion
    });
  }

  scored.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));

  for (const item of scored) {
    const key = item.replyText.slice(0, 120);
    if (seenReply.has(key)) continue;
    seenReply.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }

  if (out.length === 0) return out;

  const aiRanked = await rankReplySuggestionsWithGemini(subject, freeInquiry, out, limit);
  return aiRanked ?? out;
}

/** Re-normalize stored snippets (strip templates from legacy rows). */
export async function normalizeReplyKnowledgeRows(limit = 400): Promise<number> {
  await ensureReplyKnowledgeSchema();
  const signature = await getReplySignature();

  const rows = await sql()`
    SELECT id, subject, inquiry_snippet, reply_text, category
    FROM ticket_reply_knowledge
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  let updated = 0;
  for (const row of rows) {
    const id = String((row as { id: string }).id);
    const subject = String((row as { subject: string }).subject ?? "");
    const freeInquiry = extractFreeInquiryText(
      String((row as { inquiry_snippet: string }).inquiry_snippet ?? "")
    );
    const freeReply = extractFreeReplyText(
      String((row as { reply_text: string }).reply_text ?? ""),
      signature
    );
    if (freeInquiry.length < 6 || freeReply.length < 12) continue;

    const questionKey = buildQuestionKey(subject, freeInquiry);
    const keywords = extractKeywords(freeInquiry, 20);

    await sql()`
      UPDATE ticket_reply_knowledge
      SET inquiry_snippet = ${freeInquiry.slice(0, 2000)},
          reply_text = ${freeReply.slice(0, 8000)},
          keywords = ${keywords},
          question_key = ${questionKey}
      WHERE id = ${id}
    `;
    updated += 1;
  }

  const topicRows = await sql()`
    SELECT question_key, reply_text
    FROM reply_topic_patterns
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `;
  for (const row of topicRows) {
    const questionKey = String((row as { question_key: string }).question_key ?? "");
    const freeReply = extractFreeReplyText(
      String((row as { reply_text: string }).reply_text ?? ""),
      signature
    );
    if (!questionKey || freeReply.length < 12) continue;
    await sql()`
      UPDATE reply_topic_patterns
      SET reply_text = ${freeReply.slice(0, 4000)}
      WHERE question_key = ${questionKey}
    `;
  }

  return updated;
}

/** Backfill knowledge from tickets that already have closure notes. */
export async function backfillReplyKnowledgeFromTickets(limit = 500): Promise<number> {
  await ensureReplyKnowledgeSchema();
  const signature = await getReplySignature();

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
    const subject = String((row as { subject: string }).subject ?? "");
    const rawInquiry = String(
      (row as { body_cleaned: string }).body_cleaned || (row as { body: string }).body || ""
    );
    const freeInquiry = extractFreeInquiryText(rawInquiry);
    const freeReply = extractFreeReplyText(
      String((row as { closure_note: string }).closure_note ?? ""),
      signature
    );
    if (freeInquiry.length < 6 || freeReply.length < 12) continue;

    await recordReplyKnowledge({
      ticketId,
      subject,
      inquiryText: freeInquiry,
      replyText: freeReply,
      category: String((row as { category: string }).category ?? "")
    });
    inserted += 1;
  }
  return inserted;
}
