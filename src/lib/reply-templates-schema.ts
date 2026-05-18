import { sql } from "@/lib/neon";

let ready: Promise<void> | null = null;

/** Ensures reply_templates exists (fixes 500 when /api/init was never run on Render). */
export async function ensureReplyTemplatesTable(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS reply_templates (
          id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          title      TEXT NOT NULL DEFAULT '',
          body       TEXT NOT NULL DEFAULT '',
          shortcut   TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}
