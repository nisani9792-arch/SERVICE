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
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    await db`CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets (created_at DESC)`;
    await db`CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets (category)`;

    return NextResponse.json({ ok: true, message: "Database initialized successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to initialize database", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
