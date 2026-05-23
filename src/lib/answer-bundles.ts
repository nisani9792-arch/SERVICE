import { buildQuestionKey, ensureReplyKnowledgeSchema, findSimilarReplySuggestions } from "@/lib/reply-knowledge";
import { extractFreeInquiryText } from "@/lib/reply-text-extract";
import { sql } from "@/lib/neon";

const MAX_SCAN = 3000;
const MIN_BUNDLE_SIZE = 3;
const MAX_BUNDLE_SIZE = 30;

const EASY_PHRASES = [
  "מה נשמע",
  "מה קורה",
  "היי",
  "שלום",
  "בוקר טוב",
  "ערב טוב",
  "מתי",
  "נפתח",
  "יצא",
  "מתי האפל",
  "מתי יוצא",
  "מתי יצא",
  "hello",
  "hi ",
  "hey"
];

export type AnswerBundleSample = {
  id: string;
  subject: string;
  senderEmail: string;
  inquirySnippet: string;
};

export type AnswerBundle = {
  bundleKey: string;
  topicLabel: string;
  count: number;
  ticketIds: string[];
  samples: AnswerBundleSample[];
  suggestedReply: string | null;
  easy: boolean;
  easyScore: number;
};

function humanizeBundleKey(key: string): string {
  if (!key || key === "unknown") return "פנייה כללית";
  const parts = key.split("|").filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(0, 4).join(" · ");
  }
  const words = key.replace(/_/g, " ").trim();
  return words.length > 48 ? `${words.slice(0, 45)}…` : words;
}

function scoreEasy(inquiry: string, bodyLen: number): number {
  const lower = inquiry.toLowerCase();
  let score = 0;
  if (bodyLen <= 120) score += 3;
  if (bodyLen <= 60) score += 2;
  for (const phrase of EASY_PHRASES) {
    if (lower.includes(phrase)) score += 4;
  }
  if (/^(היי|שלום|מה נשמע|בוקר טוב)[\s!.?]*$/i.test(inquiry.trim())) score += 6;
  return score;
}

type OpenRow = {
  id: string;
  subject: string;
  sender_email: string;
  body: string;
  body_cleaned: string;
};

export async function buildAnswerBundles(options?: {
  limit?: number;
  minSize?: number;
}): Promise<{ bundles: AnswerBundle[]; openTotal: number; scanned: number }> {
  await ensureReplyKnowledgeSchema();

  const scanLimit = Math.min(MAX_SCAN, options?.limit ?? MAX_SCAN);
  const minSize = Math.max(2, options?.minSize ?? MIN_BUNDLE_SIZE);

  const rows = (await sql()`
    SELECT id, subject, sender_email, body, body_cleaned
    FROM tickets
    WHERE deleted_at IS NULL
      AND status IN ('open', 'in_progress')
      AND lower(trim(category)) NOT IN ('spam', 'spam (מובנה)')
      AND category <> 'customer_followup'
    ORDER BY created_at ASC
    LIMIT ${scanLimit}
  `) as OpenRow[];

  const countRows = await sql()`
    SELECT count(*)::int AS c
    FROM tickets
    WHERE deleted_at IS NULL
      AND status IN ('open', 'in_progress')
      AND lower(trim(category)) NOT IN ('spam', 'spam (מובנה)')
      AND category <> 'customer_followup'
  `;
  const openTotal = Number((countRows[0] as { c: number }).c ?? 0);

  const groups = new Map<
    string,
    {
      samples: AnswerBundleSample[];
      ticketIds: string[];
      easyScore: number;
      sampleInquiry: string;
      sampleSubject: string;
    }
  >();

  for (const row of rows) {
    const id = String(row.id);
    const subject = String(row.subject ?? "");
    const raw = String(row.body_cleaned || row.body || "");
    const inquiry = extractFreeInquiryText(raw);
    if (inquiry.length < 4) continue;

    const bundleKey = buildQuestionKey(subject, inquiry);
    const easyScore = scoreEasy(inquiry, inquiry.length);
    const snippet = inquiry.slice(0, 200);

    const bucket = groups.get(bundleKey) ?? {
      samples: [],
      ticketIds: [],
      easyScore: 0,
      sampleInquiry: inquiry,
      sampleSubject: subject
    };

    bucket.ticketIds.push(id);
    bucket.easyScore = Math.max(bucket.easyScore, easyScore);
    if (bucket.samples.length < 3) {
      bucket.samples.push({
        id,
        subject,
        senderEmail: String(row.sender_email ?? ""),
        inquirySnippet: snippet
      });
    }
    if (!bucket.sampleInquiry || inquiry.length > bucket.sampleInquiry.length) {
      bucket.sampleInquiry = inquiry;
      bucket.sampleSubject = subject;
    }
    groups.set(bundleKey, bucket);
  }

  const patternRows = await sql()`
    SELECT question_key, reply_text, hit_count
    FROM reply_topic_patterns
    ORDER BY hit_count DESC
    LIMIT 200
  `;

  const replyByKey = new Map<string, string>();
  for (const row of patternRows) {
    const key = String((row as { question_key: string }).question_key ?? "");
    const reply = String((row as { reply_text: string }).reply_text ?? "").trim();
    if (key && reply.length >= 12) replyByKey.set(key, reply);
  }

  const bundles: AnswerBundle[] = [];

  for (const [bundleKey, group] of Array.from(groups.entries())) {
    if (group.ticketIds.length < minSize) continue;

    const ticketIds = group.ticketIds.slice(0, MAX_BUNDLE_SIZE);
    let suggestedReply = replyByKey.get(bundleKey) ?? null;

    if (!suggestedReply && group.sampleInquiry.length >= 6) {
      try {
        const suggestions = await findSimilarReplySuggestions(
          group.sampleSubject,
          group.sampleInquiry,
          1
        );
        suggestedReply = suggestions[0]?.replyText ?? null;
      } catch {
        suggestedReply = null;
      }
    }

    const easy = group.easyScore >= 5;
    bundles.push({
      bundleKey,
      topicLabel: humanizeBundleKey(bundleKey),
      count: group.ticketIds.length,
      ticketIds,
      samples: group.samples,
      suggestedReply,
      easy,
      easyScore: group.easyScore
    });
  }

  bundles.sort((a, b) => {
    if (a.easy !== b.easy) return a.easy ? -1 : 1;
    if (b.easyScore !== a.easyScore) return b.easyScore - a.easyScore;
    return b.count - a.count;
  });

  return { bundles, openTotal, scanned: rows.length };
}

/** Tag open tickets with BUNDLE:<key> for quick filtering in workbench. */
export async function syncBundleTags(limit = MAX_SCAN): Promise<number> {
  const { bundles } = await buildAnswerBundles({ limit, minSize: MIN_BUNDLE_SIZE });
  let tagged = 0;

  for (const bundle of bundles) {
    const tag = `BUNDLE:${bundle.bundleKey.slice(0, 80)}`;
    const ids = bundle.ticketIds;
    if (ids.length === 0) continue;

    await sql()`
      UPDATE tickets
      SET tags = (
        SELECT array_agg(DISTINCT e)
        FROM unnest(
          COALESCE(tags, '{}'::text[]) || ${[tag]}::text[]
        ) AS e
      ),
      updated_at = now()
      WHERE id = ANY(${ids})
        AND deleted_at IS NULL
        AND NOT (${tag} = ANY(COALESCE(tags, '{}'::text[])))
    `;
    tagged += ids.length;
  }

  return tagged;
}

export async function markBundleAsSpam(ticketIds: string[]): Promise<number> {
  if (ticketIds.length === 0) return 0;
  const rows = await sql()`
    UPDATE tickets
    SET category = 'spam',
        status = 'closed',
        updated_at = now()
    WHERE id = ANY(${ticketIds})
      AND deleted_at IS NULL
    RETURNING id
  `;
  return rows.length;
}
