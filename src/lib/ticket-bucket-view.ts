import { sql } from "@/lib/neon";
import type { TicketBucket } from "@/lib/ticket-buckets";

let viewReady: Promise<void> | null = null;

const SPAM_CATS = ["spam", "spam (מובנה)"];

/**
 * PostgreSQL view — single source of truth for bucket assignment.
 * active = open|in_progress and not spam (matches dashboard stats).
 */
export async function ensureTicketBucketView(): Promise<void> {
  if (!viewReady) {
    viewReady = (async () => {
      await sql()`
        CREATE OR REPLACE VIEW ticket_buckets_v AS
        SELECT
          t.*,
          CASE
            WHEN t.deleted_at IS NOT NULL THEN 'deleted'
            WHEN lower(trim(t.category)) IN ('spam', 'spam (מובנה)') THEN 'spam'
            WHEN t.status IN ('closed', 'handled')
              AND (
                COALESCE(t.tags, '{}'::text[]) && ARRAY['REPLIED']::text[]
                OR (t.closure_note IS NOT NULL AND length(trim(t.closure_note)) > 10)
              )
              THEN 'outbox'
            WHEN t.status IN ('closed', 'handled') THEN 'handled'
            WHEN t.status IN ('open', 'in_progress')
              AND lower(trim(t.category)) NOT IN ('spam', 'spam (מובנה)')
              THEN 'active'
            ELSE 'other'
          END AS bucket_key
        FROM tickets t
      `;
    })().catch((err) => {
      viewReady = null;
      throw err;
    });
  }
  return viewReady;
}

export type TriageQueueKey = TicketBucket | "triage" | "all";

export type BucketCounts = Record<string, number>;

export async function fetchBucketCounts(): Promise<BucketCounts> {
  await ensureTicketBucketView();
  const rows = await sql()`
    SELECT bucket_key, count(*)::int AS c
    FROM ticket_buckets_v
    GROUP BY bucket_key
  `;
  const counts: BucketCounts = {};
  for (const row of rows) {
    counts[String((row as { bucket_key: string }).bucket_key)] = Number(
      (row as { c: number }).c
    );
  }
  return counts;
}

function queueToBucketFilter(queue: TriageQueueKey): {
  bucketKey: string | null;
  triageOnly: boolean;
} {
  if (queue === "triage") {
    return { bucketKey: "active", triageOnly: true };
  }
  if (queue === "all") {
    return { bucketKey: null, triageOnly: false };
  }
  return { bucketKey: queue, triageOnly: false };
}

export type TriageBatchParams = {
  queue?: TriageQueueKey;
  offset?: number;
  limit?: number;
  q?: string | null;
};

export type TriageBatchRow = Record<string, unknown> & { bucket_key: string };

export async function fetchTriageBatch(params: TriageBatchParams): Promise<{
  items: TriageBatchRow[];
  total: number;
  bucketCounts: BucketCounts;
}> {
  await ensureTicketBucketView();

  const queue = params.queue ?? "active";
  const offset = Math.max(0, params.offset ?? 0);
  const limit = Math.min(50, Math.max(1, params.limit ?? 3));
  const like = params.q?.trim() ? `%${params.q.trim()}%` : null;
  const { bucketKey, triageOnly } = queueToBucketFilter(queue);

  const [countRows, bucketRows, itemRows] = await Promise.all([
    sql()`
      SELECT count(*)::int AS total
      FROM ticket_buckets_v v
      WHERE (
          ${bucketKey}::text IS NULL
          OR v.bucket_key = ${bucketKey}
        )
        AND (
          ${triageOnly}::boolean = false
          OR v.category IN ('pending_triage', 'customer_followup')
        )
        AND (
          ${like}::text IS NULL
          OR v.subject ILIKE ${like}
          OR v.sender_email ILIKE ${like}
          OR v.sender_name ILIKE ${like}
          OR v.body ILIKE ${like}
          OR v.ai_summary ILIKE ${like}
        )
    `,
    fetchBucketCounts(),
    sql()`
      SELECT
        v.id, v.ticket_number, v.sender_email, v.sender_name, v.subject,
        left(v.body, 420) AS body,
        v.body_cleaned,
        v.category, v.priority, v.ai_summary, v.ai_suggested_category,
        v.classification_confidence,
        v.status, v.source,
        v.message_at, v.tags, v.assigned_to, v.closure_note,
        v.email_message_id, v.email_mailbox_uid, v.email_ingested_at,
        v.created_at, v.updated_at, v.bucket_key
      FROM ticket_buckets_v v
      WHERE (
          ${bucketKey}::text IS NULL
          OR v.bucket_key = ${bucketKey}
        )
        AND (
          ${triageOnly}::boolean = false
          OR v.category IN ('pending_triage', 'customer_followup')
        )
        AND (
          ${like}::text IS NULL
          OR v.subject ILIKE ${like}
          OR v.sender_email ILIKE ${like}
          OR v.sender_name ILIKE ${like}
          OR v.body ILIKE ${like}
          OR v.ai_summary ILIKE ${like}
        )
      ORDER BY
        CASE
          WHEN ${triageOnly}::boolean = true AND v.category = 'customer_followup' THEN 0
          WHEN ${triageOnly}::boolean = true THEN 1
          ELSE 2
        END ASC,
        CASE WHEN ${triageOnly}::boolean = true THEN COALESCE(v.classification_confidence, 0) ELSE 0 END DESC,
        COALESCE(v.message_at, v.created_at) ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `
  ]);

  const total = Number((countRows[0] as { total: number })?.total ?? 0);

  return {
    items: itemRows as TriageBatchRow[],
    total,
    bucketCounts: bucketRows
  };
}

export function isSpamCategoryName(category: string): boolean {
  return SPAM_CATS.includes(category.trim().toLowerCase());
}
