import { reclassifyTicketContent } from "@/lib/gemini";
import { isSpamCategory } from "@/lib/spam-category";
import { bodyForAiPrompt } from "@/lib/message-filter";
import { sql } from "@/lib/neon";
import { ensureTicketUpgradeSchema, type BatchJobPayload } from "@/lib/ticket-schema";
import { PENDING_TRIAGE_CATEGORY } from "@/lib/triage";

const DEFAULT_CHUNK = 25;
const MAX_CHUNK = 50;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1200;

export type BatchJobStatus = "pending" | "running" | "completed" | "failed";

export type BatchJobRow = {
  id: string;
  scope: string;
  status: BatchJobStatus;
  total: number;
  processed: number;
  chunk_size: number;
  token_estimate: number;
  last_error: string;
  results: unknown;
  payload: BatchJobPayload | null;
  created_at: string;
  updated_at: string;
};

export function parseBatchJobPayload(raw: unknown): BatchJobPayload {
  if (!raw || typeof raw !== "object") return {};
  const p = raw as BatchJobPayload;
  return {
    ids: Array.isArray(p.ids) ? p.ids.filter(Boolean) : [],
    classifyScope: typeof p.classifyScope === "string" ? p.classifyScope : undefined
  };
}

type TicketRow = {
  id: string;
  sender_email: string;
  subject: string;
  body: string;
  body_cleaned: string;
  category: string;
  status: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function classifyOne(row: TicketRow) {
  const aiBody = bodyForAiPrompt(String(row.body ?? ""), row.body_cleaned);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const classification = await reclassifyTicketContent(
        String(row.sender_email ?? ""),
        String(row.subject ?? ""),
        aiBody
      );

      const wasSpam = isSpamCategory(String(row.category));
      const nowSpam = isSpamCategory(classification.category);
      const reopen = wasSpam && !nowSpam;

      const statusAfter =
        nowSpam ? "closed" : reopen ? "open" : row.status;

      await sql()`
        UPDATE tickets
        SET category = ${classification.category},
            priority = ${classification.priority},
            ai_summary = ${classification.summary},
            body_cleaned = ${aiBody},
            status = ${statusAfter},
            updated_at = now()
        WHERE id = ${row.id}
          AND deleted_at IS NULL
      `;

      return {
        id: String(row.id),
        from: String(row.category),
        to: classification.category,
        summary: classification.summary,
        tokens: Math.ceil((aiBody.length + String(row.subject).length) / 4)
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Classify failed");
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError ?? new Error("Classify failed");
}

async function fetchJobTickets(
  job: BatchJobRow,
  scope: string,
  ids: string[],
  limit: number
): Promise<TicketRow[]> {
  const offset = job.processed;

  if (ids.length > 0) {
    return (await sql()`
      SELECT id, sender_email, subject, body, body_cleaned, category, status
      FROM tickets
      WHERE id = ANY(${ids}) AND deleted_at IS NULL
      ORDER BY updated_at DESC
      OFFSET ${offset}
      LIMIT ${limit}
    `) as TicketRow[];
  }

  if (scope === "spam") {
    return (await sql()`
      SELECT id, sender_email, subject, body, body_cleaned, category, status
      FROM tickets
      WHERE lower(category) IN ('spam', 'spam (מובנה)')
        AND deleted_at IS NULL
      ORDER BY updated_at DESC
      OFFSET ${offset}
      LIMIT ${limit}
    `) as TicketRow[];
  }

  if (scope === "pending_triage") {
    return (await sql()`
      SELECT id, sender_email, subject, body, body_cleaned, category, status
      FROM tickets
      WHERE category = ${PENDING_TRIAGE_CATEGORY}
        AND deleted_at IS NULL
      ORDER BY created_at ASC
      OFFSET ${offset}
      LIMIT ${limit}
    `) as TicketRow[];
  }

  if (scope === "all") {
    return (await sql()`
      SELECT id, sender_email, subject, body, body_cleaned, category, status
      FROM tickets
      WHERE category <> ${"customer_followup"}
        AND deleted_at IS NULL
      ORDER BY created_at ASC
      OFFSET ${offset}
      LIMIT ${limit}
    `) as TicketRow[];
  }

  return [];
}

export async function countBatchTargets(scope: string, ids: string[]): Promise<number> {
  if (ids.length > 0) {
    const rows = await sql()`
      SELECT count(*)::int AS c FROM tickets WHERE id = ANY(${ids}) AND deleted_at IS NULL
    `;
    return Number((rows[0] as { c: number }).c ?? 0);
  }
  if (scope === "spam") {
    const rows = await sql()`
      SELECT count(*)::int AS c FROM tickets
      WHERE lower(category) IN ('spam', 'spam (מובנה)')
        AND deleted_at IS NULL
    `;
    return Number((rows[0] as { c: number }).c ?? 0);
  }
  if (scope === "pending_triage") {
    const rows = await sql()`
      SELECT count(*)::int AS c
      FROM tickets
      WHERE category = ${PENDING_TRIAGE_CATEGORY} AND deleted_at IS NULL
    `;
    return Number((rows[0] as { c: number }).c ?? 0);
  }
  if (scope === "all") {
    const rows = await sql()`
      SELECT count(*)::int AS c
      FROM tickets
      WHERE category <> ${"customer_followup"} AND deleted_at IS NULL
    `;
    return Number((rows[0] as { c: number }).c ?? 0);
  }
  return 0;
}

export async function createBatchJob(
  scope: string,
  total: number,
  chunkSize: number,
  payload: BatchJobPayload = {}
): Promise<string> {
  await ensureTicketUpgradeSchema();
  const rows = await sql()`
    INSERT INTO ai_batch_jobs (scope, status, total, processed, chunk_size, payload)
    VALUES (${scope}, ${"pending"}, ${total}, ${0}, ${chunkSize}, ${JSON.stringify(payload)}::jsonb)
    RETURNING id
  `;
  return String((rows[0] as { id: string }).id);
}

export async function getBatchJob(jobId: string): Promise<BatchJobRow | null> {
  const rows = await sql()`
    SELECT id, scope, status, total, processed, chunk_size, token_estimate, last_error,
           results, payload, created_at, updated_at
    FROM ai_batch_jobs
    WHERE id = ${jobId}
    LIMIT 1
  `;
  if (!rows.length) return null;
  return rows[0] as BatchJobRow;
}

export async function runBatchJobChunk(
  jobId: string,
  options: { scope: string; ids: string[]; chunkSize?: number }
): Promise<{
  job: BatchJobRow;
  chunkResults: Array<{ id: string; from: string; to: string; summary: string }>;
  done: boolean;
}> {
  await ensureTicketUpgradeSchema();
  const job = await getBatchJob(jobId);
  if (!job) throw new Error("Batch job not found");

  const payload = parseBatchJobPayload(job.payload);
  const scope = options.scope || payload.classifyScope || job.scope;
  const ids = options.ids.length > 0 ? options.ids : (payload.ids ?? []);
  const chunkSize = Math.min(
    MAX_CHUNK,
    Math.max(1, options.chunkSize ?? job.chunk_size ?? DEFAULT_CHUNK)
  );

  await sql()`
    UPDATE ai_batch_jobs
    SET status = ${"running"}, updated_at = now()
    WHERE id = ${jobId}
  `;

  const rows = await fetchJobTickets(job, scope, ids, chunkSize);
  const priorResults = Array.isArray(job.results) ? [...(job.results as object[])] : [];
  const chunkResults: Array<{ id: string; from: string; to: string; summary: string }> = [];
  let tokenDelta = 0;

  try {
    for (const row of rows) {
      const result = await classifyOne(row);
      chunkResults.push({
        id: result.id,
        from: result.from,
        to: result.to,
        summary: result.summary
      });
      tokenDelta += result.tokens;
    }

    const processed = job.processed + rows.length;
    const done = processed >= job.total || rows.length === 0;
    const merged = [...priorResults, ...chunkResults];

    await sql()`
      UPDATE ai_batch_jobs
      SET processed = ${processed},
          token_estimate = token_estimate + ${tokenDelta},
          results = ${JSON.stringify(merged)}::jsonb,
          status = ${done ? "completed" : "running"},
          updated_at = now()
      WHERE id = ${jobId}
    `;

    const updated = (await getBatchJob(jobId))!;
    return { job: updated, chunkResults, done };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Batch chunk failed";
    await sql()`
      UPDATE ai_batch_jobs
      SET status = ${"failed"},
          last_error = ${message},
          updated_at = now()
      WHERE id = ${jobId}
    `;
    const failed = (await getBatchJob(jobId))!;
    return { job: failed, chunkResults, done: true };
  }
}
