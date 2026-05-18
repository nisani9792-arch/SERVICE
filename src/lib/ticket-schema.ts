import { sql } from "@/lib/neon";

const START_NUMBER = 10000;

let columnsReady: Promise<void> | null = null;
let fullUpgradeReady: Promise<void> | null = null;

/** Fast path for list/detail APIs — adds columns only, no heavy backfill. */
export async function ensureTicketListColumns(): Promise<void> {
  if (!columnsReady) {
    columnsReady = (async () => {
      await sql()`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_number INTEGER`;
      await sql()`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS body_cleaned TEXT NOT NULL DEFAULT ''`;
      await sql()`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`;
    })().catch((err) => {
      columnsReady = null;
      throw err;
    });
  }
  return columnsReady;
}

/** Full upgrade — run via POST /api/init (includes backfill + batch tables). */
export async function ensureTicketUpgradeSchema(): Promise<void> {
  await ensureTicketListColumns();

  if (!fullUpgradeReady) {
    fullUpgradeReady = runFullUpgrade().catch((err) => {
      fullUpgradeReady = null;
      throw err;
    });
  }
  return fullUpgradeReady;
}

async function runFullUpgrade(): Promise<void> {
  // Neon driver: never use ${param} inside CREATE TABLE DEFAULT — causes bind errors.
  await sql()`
    CREATE TABLE IF NOT EXISTS ticket_number_seq (
      id TEXT PRIMARY KEY,
      last_number INTEGER NOT NULL DEFAULT 10000
    )
  `;
  await sql()`
    INSERT INTO ticket_number_seq (id, last_number)
    VALUES ('default', ${START_NUMBER})
    ON CONFLICT (id) DO NOTHING
  `;

  await sql()`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_ticket_number
    ON tickets (ticket_number)
    WHERE ticket_number IS NOT NULL
  `;

  await sql()`
    UPDATE tickets t
    SET ticket_number = sub.n
    FROM (
      SELECT id, ${START_NUMBER} + row_number() OVER (ORDER BY created_at ASC, id ASC) AS n
      FROM tickets
      WHERE ticket_number IS NULL
    ) sub
    WHERE t.id = sub.id
  `;

  await sql()`
    UPDATE ticket_number_seq
    SET last_number = GREATEST(
      last_number,
      COALESCE((SELECT MAX(ticket_number) FROM tickets), ${START_NUMBER})
    )
    WHERE id = 'default'
  `;

  await sql()`
    CREATE TABLE IF NOT EXISTS ai_batch_jobs (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      scope TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      total INTEGER NOT NULL DEFAULT 0,
      processed INTEGER NOT NULL DEFAULT 0,
      chunk_size INTEGER NOT NULL DEFAULT 25,
      token_estimate INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NOT NULL DEFAULT '',
      results JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql()`ALTER TABLE ai_batch_jobs ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await sql()`
    CREATE INDEX IF NOT EXISTS idx_ai_batch_jobs_status
    ON ai_batch_jobs (status, updated_at DESC)
  `;
}

export type BatchJobPayload = {
  ids?: string[];
  classifyScope?: string;
};
