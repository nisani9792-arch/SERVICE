import { NextResponse } from "next/server";
import { sql } from "@/lib/neon";

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
      CREATE TABLE IF NOT EXISTS reply_templates (
        id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title      TEXT NOT NULL DEFAULT '',
        body       TEXT NOT NULL DEFAULT '',
        shortcut   TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    await db`UPDATE tickets SET status = 'closed' WHERE status = 'handled'`;

    return NextResponse.json({ ok: true, message: "Database initialized successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to initialize database", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
