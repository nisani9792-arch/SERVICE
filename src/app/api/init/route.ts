import { NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { ensureTicketUpgradeSchema } from "@/lib/ticket-schema";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const db = sql();

    await db`
      CREATE TABLE IF NOT EXISTS tickets (
        id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        sender_email  TEXT NOT NULL DEFAULT '',
        sender_name   TEXT NOT NULL DEFAULT '',
        subject       TEXT NOT NULL DEFAULT '',
        body          TEXT NOT NULL DEFAULT '',
        category      TEXT NOT NULL DEFAULT 'suggestions',
        priority      INTEGER NOT NULL DEFAULT 3,
        ai_summary    TEXT NOT NULL DEFAULT '',
        status        TEXT NOT NULL DEFAULT 'open',
        source        TEXT NOT NULL DEFAULT 'manual',
        message_at    TIMESTAMPTZ,
        email_import_key TEXT,
        email_message_id TEXT,
        email_mailbox_uid TEXT,
        email_ingested_at TIMESTAMPTZ,
        tags          TEXT[] NOT NULL DEFAULT '{}',
        assigned_to   TEXT NOT NULL DEFAULT '',
        closure_note  TEXT NOT NULL DEFAULT '',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    await db`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS message_at TIMESTAMPTZ`;
    await db`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_import_key TEXT`;
    await db`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_message_id TEXT`;
    await db`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_mailbox_uid TEXT`;
    await db`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_ingested_at TIMESTAMPTZ`;
    await db`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'`;
    await db`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_to TEXT NOT NULL DEFAULT ''`;
    await db`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closure_note TEXT NOT NULL DEFAULT ''`;

    await db`CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets (created_at DESC)`;
    await db`CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets (category)`;
    await db`CREATE INDEX IF NOT EXISTS idx_tickets_sender_email ON tickets (sender_email)`;
    await db`CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status)`;
    await db`CREATE INDEX IF NOT EXISTS idx_tickets_message_at ON tickets (message_at DESC NULLS LAST)`;
    await db`CREATE INDEX IF NOT EXISTS idx_tickets_tags ON tickets USING GIN (tags)`;
    await db`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_email_import_key
      ON tickets (email_import_key)
      WHERE email_import_key IS NOT NULL
    `;
    await db`CREATE INDEX IF NOT EXISTS idx_tickets_email_message_id ON tickets (email_message_id)`;
    await db`CREATE INDEX IF NOT EXISTS idx_tickets_email_mailbox_uid ON tickets (email_mailbox_uid)`;
    await db`
      CREATE INDEX IF NOT EXISTS idx_tickets_list_sort
      ON tickets (COALESCE(message_at, created_at) DESC NULLS LAST)
    `;
    await db`
      CREATE INDEX IF NOT EXISTS idx_tickets_category_status
      ON tickets (category, status)
    `;

    await db`
      CREATE TABLE IF NOT EXISTS reply_templates (
        id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title      TEXT NOT NULL DEFAULT '',
        body       TEXT NOT NULL DEFAULT '',
        shortcut   TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    await db`
      CREATE TABLE IF NOT EXISTS reply_signature (
        id TEXT PRIMARY KEY DEFAULT 'default',
        opening TEXT NOT NULL DEFAULT '',
        closing TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    await db`
      CREATE TABLE IF NOT EXISTS saved_inquiries (
        id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        ticket_id    TEXT,
        title        TEXT NOT NULL DEFAULT '',
        content      TEXT NOT NULL DEFAULT '',
        note         TEXT NOT NULL DEFAULT '',
        status       TEXT NOT NULL DEFAULT 'open',
        source_email TEXT NOT NULL DEFAULT '',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await db`CREATE INDEX IF NOT EXISTS idx_saved_inquiries_created_at ON saved_inquiries (created_at DESC)`;
    await db`CREATE INDEX IF NOT EXISTS idx_saved_inquiries_status ON saved_inquiries (status)`;
    await db`CREATE INDEX IF NOT EXISTS idx_saved_inquiries_ticket_id ON saved_inquiries (ticket_id)`;

    await db`
      CREATE TABLE IF NOT EXISTS ticket_attachments (
        id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        ticket_id      TEXT NOT NULL,
        filename       TEXT NOT NULL DEFAULT 'attachment',
        content_type   TEXT NOT NULL DEFAULT 'application/octet-stream',
        size_bytes     INTEGER NOT NULL DEFAULT 0,
        content_base64 TEXT NOT NULL,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await db`CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON ticket_attachments (ticket_id)`;

    await db`
      CREATE TABLE IF NOT EXISTS backup_snapshots (
        id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        backup_key          TEXT NOT NULL UNIQUE,
        folder              TEXT NOT NULL DEFAULT 'backups',
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        table_counts        JSONB NOT NULL DEFAULT '{}'::jsonb,
        payload_gzip_base64 TEXT NOT NULL,
        byte_size           INTEGER NOT NULL DEFAULT 0,
        checksum            TEXT NOT NULL DEFAULT ''
      )
    `;
    await db`
      CREATE INDEX IF NOT EXISTS idx_backup_snapshots_created_at
      ON backup_snapshots (created_at DESC)
    `;

    await db`UPDATE tickets SET status = 'closed' WHERE status = 'handled'`;

    await ensureTicketUpgradeSchema();

    await db`
      CREATE TABLE IF NOT EXISTS access_operators (
        ip_address    TEXT PRIMARY KEY,
        display_name  TEXT NOT NULL DEFAULT '',
        gate_unlocked BOOLEAN NOT NULL DEFAULT false,
        session_token TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await db`
      ALTER TABLE access_operators
      ADD COLUMN IF NOT EXISTS session_token TEXT
    `;
    await db`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_access_operators_session_token
      ON access_operators (session_token)
      WHERE session_token IS NOT NULL
    `;

    await db`
      CREATE TABLE IF NOT EXISTS operator_sessions (
        token          TEXT PRIMARY KEY,
        display_name   TEXT NOT NULL DEFAULT '',
        gate_unlocked  BOOLEAN NOT NULL DEFAULT false,
        ip_address     TEXT NOT NULL DEFAULT '',
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '365 days'),
        last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await db`
      CREATE INDEX IF NOT EXISTS idx_operator_sessions_expires
      ON operator_sessions (expires_at)
    `;

    await db`
      CREATE TABLE IF NOT EXISTS outbound_email_queue (
        id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        to_address      TEXT NOT NULL,
        subject         TEXT NOT NULL DEFAULT '',
        body_text       TEXT NOT NULL DEFAULT '',
        status          TEXT NOT NULL DEFAULT 'pending',
        attempt_count   INTEGER NOT NULL DEFAULT 0,
        last_error      TEXT NOT NULL DEFAULT '',
        idempotency_key TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        sent_at         TIMESTAMPTZ,
        next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await db`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_outbound_email_idempotency
      ON outbound_email_queue (idempotency_key)
      WHERE idempotency_key IS NOT NULL
    `;
    await db`
      CREATE INDEX IF NOT EXISTS idx_outbound_email_pending
      ON outbound_email_queue (status, next_attempt_at)
      WHERE status IN ('pending', 'waiting_domain')
    `;

    return NextResponse.json({ ok: true, message: "Database initialized successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to initialize database", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
