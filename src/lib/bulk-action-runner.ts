import { blockSendersAndCascade } from "@/lib/spam-sender";
import { parseTicketListFilters, type TicketListFilters } from "@/lib/ticket-filters";
import { sql } from "@/lib/neon";

const CHUNK_SIZE = 500;
const MAX_TOTAL = 10_000;

export type BulkActionType = "spam" | "delete" | "close" | "category";

export type BulkActionPayload = {
  filters: Record<string, string>;
  action: BulkActionType;
  category?: string;
  blockSender?: boolean;
};

export type BulkJobRow = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  total: number;
  processed: number;
  action: string;
  payload: BulkActionPayload;
  last_error: string;
};

let schemaReady: Promise<void> | null = null;

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS ticket_bulk_jobs (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          status TEXT NOT NULL DEFAULT 'pending',
          action TEXT NOT NULL DEFAULT '',
          total INT NOT NULL DEFAULT 0,
          processed INT NOT NULL DEFAULT 0,
          payload JSONB NOT NULL DEFAULT '{}'::jsonb,
          last_error TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

function filtersFromPayload(payload: BulkActionPayload): TicketListFilters | { error: string } {
  return parseTicketListFilters(new URLSearchParams(payload.filters ?? {}));
}

async function countMatching(f: TicketListFilters): Promise<number> {
  const rows = await sql()`
    SELECT count(*)::int AS c
    FROM tickets
    WHERE (
        (${f.trashOnly}::boolean = true AND deleted_at IS NOT NULL)
        OR (${f.trashOnly}::boolean = false AND deleted_at IS NULL)
      )
      AND (
        (${f.triageQueue}::boolean = true AND category IN ('pending_triage', 'customer_followup'))
        OR (
          ${f.triageQueue}::boolean = false
          AND (${f.categoryFilter}::text IS NULL OR category = ${f.categoryFilter})
        )
      )
      AND (
        ${f.bucketFilter}::text IS NULL
        OR ${f.bucketFilter} <> 'spam'
        OR lower(trim(category)) IN ('spam', 'spam (מובנה)')
      )
      AND (
        ${f.bucketFilter}::text IS NULL
        OR ${f.bucketFilter} <> 'handled'
        OR (
          status IN ('closed', 'handled')
          AND lower(trim(category)) NOT IN ('spam', 'spam (מובנה)')
        )
      )
      AND (
        ${f.excludeSpamFilter}::boolean = false
        OR lower(trim(category)) NOT IN ('spam', 'spam (מובנה)')
      )
      AND (
        ${f.activeStatusFilter}::boolean = false
        OR (status NOT IN ('closed', 'handled'))
      )
      AND (
        ${f.closedStatusFilter}::boolean = false
        OR (
          status IN ('closed', 'handled')
          AND ${f.outboxStatusFilter}::boolean = false
        )
      )
      AND (
        ${f.outboxStatusFilter}::boolean = false
        OR (
          status IN ('closed', 'handled')
          AND (
            COALESCE(tags, '{}'::text[]) && ${["REPLIED"]}::text[]
            OR (closure_note IS NOT NULL AND length(trim(closure_note)) > 10)
          )
        )
      )
      AND (
        ${f.exactStatusFilter}::text IS NULL
        OR status = ${f.exactStatusFilter}
      )
  `;
  return Number((rows[0] as { c: number }).c ?? 0);
}

async function fetchIds(f: TicketListFilters, limit: number, offset: number): Promise<string[]> {
  const rows = await sql()`
    SELECT id
    FROM tickets
    WHERE (
        (${f.trashOnly}::boolean = true AND deleted_at IS NOT NULL)
        OR (${f.trashOnly}::boolean = false AND deleted_at IS NULL)
      )
      AND (
        (${f.triageQueue}::boolean = true AND category IN ('pending_triage', 'customer_followup'))
        OR (
          ${f.triageQueue}::boolean = false
          AND (${f.categoryFilter}::text IS NULL OR category = ${f.categoryFilter})
        )
      )
      AND (
        ${f.bucketFilter}::text IS NULL
        OR ${f.bucketFilter} <> 'spam'
        OR lower(trim(category)) IN ('spam', 'spam (מובנה)')
      )
      AND (
        ${f.bucketFilter}::text IS NULL
        OR ${f.bucketFilter} <> 'handled'
        OR (
          status IN ('closed', 'handled')
          AND lower(trim(category)) NOT IN ('spam', 'spam (מובנה)')
        )
      )
      AND (
        ${f.excludeSpamFilter}::boolean = false
        OR lower(trim(category)) NOT IN ('spam', 'spam (מובנה)')
      )
      AND (
        ${f.activeStatusFilter}::boolean = false
        OR (status NOT IN ('closed', 'handled'))
      )
      AND (
        ${f.closedStatusFilter}::boolean = false
        OR (
          status IN ('closed', 'handled')
          AND ${f.outboxStatusFilter}::boolean = false
        )
      )
      AND (
        ${f.outboxStatusFilter}::boolean = false
        OR (
          status IN ('closed', 'handled')
          AND (
            COALESCE(tags, '{}'::text[]) && ${["REPLIED"]}::text[]
            OR (closure_note IS NOT NULL AND length(trim(closure_note)) > 10)
          )
        )
      )
      AND (
        ${f.exactStatusFilter}::text IS NULL
        OR status = ${f.exactStatusFilter}
      )
    ORDER BY created_at ASC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
  return rows.map((r) => String((r as { id: string }).id));
}

async function applyAction(
  ids: string[],
  payload: BulkActionPayload,
  operatorName: string | null
): Promise<void> {
  if (ids.length === 0) return;

  if (payload.action === "delete") {
    await sql()`
      UPDATE tickets SET deleted_at = now(), updated_at = now()
      WHERE id = ANY(${ids}) AND deleted_at IS NULL
    `;
    return;
  }

  if (payload.action === "spam") {
    await sql()`
      UPDATE tickets
      SET category = 'spam', status = 'closed', updated_at = now()
      WHERE id = ANY(${ids}) AND deleted_at IS NULL
    `;
    if (payload.blockSender !== false) {
      const emails = await sql()`
        SELECT DISTINCT lower(trim(sender_email)) AS email
        FROM tickets WHERE id = ANY(${ids}) AND sender_email <> ''
      `;
      await blockSendersAndCascade(
        emails.map((r) => String((r as { email: string }).email)),
        operatorName ?? ""
      );
    }
    return;
  }

  if (payload.action === "close") {
    await sql()`
      UPDATE tickets SET status = 'closed', updated_at = now()
      WHERE id = ANY(${ids}) AND deleted_at IS NULL
    `;
    return;
  }

  if (payload.action === "category" && payload.category) {
    const status = payload.category === "spam" ? "closed" : null;
    await sql()`
      UPDATE tickets
      SET category = ${payload.category},
          status = COALESCE(${status}, status),
          updated_at = now()
      WHERE id = ANY(${ids}) AND deleted_at IS NULL
    `;
  }
}

export async function createBulkActionJob(payload: BulkActionPayload): Promise<{
  jobId: string;
  total: number;
}> {
  await ensureSchema();
  const parsed = filtersFromPayload(payload);
  if ("error" in parsed) throw new Error(parsed.error);

  const total = Math.min(MAX_TOTAL, await countMatching(parsed));
  const rows = await sql()`
    INSERT INTO ticket_bulk_jobs (status, action, total, processed, payload)
    VALUES (${"pending"}, ${payload.action}, ${total}, ${0}, ${JSON.stringify(payload)}::jsonb)
    RETURNING id
  `;
  return { jobId: String((rows[0] as { id: string }).id), total };
}

export async function getBulkActionJob(jobId: string): Promise<BulkJobRow | null> {
  await ensureSchema();
  const rows = await sql()`
    SELECT id, status, total, processed, action, payload, last_error
    FROM ticket_bulk_jobs WHERE id = ${jobId} LIMIT 1
  `;
  if (!rows.length) return null;
  const row = rows[0] as BulkJobRow & { payload: unknown };
  return {
    ...row,
    payload: row.payload as BulkActionPayload
  };
}

export async function runBulkActionChunk(
  jobId: string,
  operatorName: string | null
): Promise<{ job: BulkJobRow; done: boolean; chunkSize: number }> {
  await ensureSchema();
  const job = await getBulkActionJob(jobId);
  if (!job) throw new Error("Job not found");
  if (job.status === "completed" || job.status === "failed") {
    return { job, done: true, chunkSize: 0 };
  }

  const parsed = filtersFromPayload(job.payload);
  if ("error" in parsed) throw new Error(parsed.error);

  await sql()`
    UPDATE ticket_bulk_jobs SET status = 'running', updated_at = now() WHERE id = ${jobId}
  `;

  const ids = await fetchIds(parsed, CHUNK_SIZE, job.processed);
  try {
    await applyAction(ids, job.payload, operatorName);
    const processed = job.processed + ids.length;
    const done = processed >= job.total || ids.length === 0;

    await sql()`
      UPDATE ticket_bulk_jobs
      SET processed = ${processed},
          status = ${done ? "completed" : "running"},
          updated_at = now()
      WHERE id = ${jobId}
    `;

    const updated = (await getBulkActionJob(jobId))!;
    return { job: updated, done, chunkSize: ids.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bulk action failed";
    await sql()`
      UPDATE ticket_bulk_jobs
      SET status = 'failed', last_error = ${message}, updated_at = now()
      WHERE id = ${jobId}
    `;
    throw error;
  }
}
