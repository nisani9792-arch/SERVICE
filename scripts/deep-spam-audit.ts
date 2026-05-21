/**
 * Full-database spam audit using the same rules as ingest/sweep.
 * Usage:
 *   npx tsx scripts/deep-spam-audit.ts           # report only
 *   npx tsx scripts/deep-spam-audit.ts --apply   # move matches to spam
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { bodyForAiPrompt } from "../src/lib/message-filter";
import { isLikelySpamInquiry } from "../src/lib/spam-inquiry";

const APPLY = process.argv.includes("--apply");
const BATCH = 500;

type Row = {
  id: string;
  subject: string;
  body: string;
  body_cleaned: string;
  category: string;
};

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

  const sql = neon(databaseUrl);

  let offset = 0;
  let scanned = 0;
  const matches: Row[] = [];
  const byCategory: Record<string, number> = {};

  while (true) {
    const rows = (await sql`
      SELECT id, subject, body, body_cleaned, category
      FROM tickets
      WHERE deleted_at IS NULL
        AND lower(trim(category)) NOT IN ('spam', 'spam (מובנה)')
      ORDER BY created_at ASC
      LIMIT ${BATCH}
      OFFSET ${offset}
    `) as Row[];

    if (!rows.length) break;

    for (const row of rows) {
      scanned += 1;
      const subject = String(row.subject ?? "");
      const body = bodyForAiPrompt(String(row.body ?? ""), row.body_cleaned);
      if (!isLikelySpamInquiry(subject, body)) continue;
      matches.push(row);
      const cat = String(row.category ?? "(none)");
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    offset += rows.length;
    if (rows.length < BATCH) break;
    console.log(`  scanned ${scanned}…`);
  }

  console.log(`\nScanned: ${scanned} non-spam tickets`);
  console.log(`Likely spam: ${matches.length}`);
  console.log("By current category:", byCategory);

  for (const row of matches.slice(0, 8)) {
    const snip = bodyForAiPrompt(String(row.body ?? ""), row.body_cleaned)
      .replace(/\s+/g, " ")
      .slice(0, 90);
    console.log(`  - ${row.id} [${row.category}] ${snip}`);
  }

  if (!APPLY || matches.length === 0) {
    if (!APPLY && matches.length > 0) {
      console.log(`\nRun with --apply to move ${matches.length} tickets to spam.`);
    }
    return;
  }

  const ids = matches.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    await sql`
      UPDATE tickets
      SET category = 'spam',
          status = 'closed',
          priority = 1,
          ai_summary = COALESCE(
            NULLIF(trim(ai_summary), ''),
            'סווג אוטומטית כספאם (סריקה מעמיקה)'
          ),
          updated_at = now()
      WHERE id = ANY(${chunk})
        AND deleted_at IS NULL
    `;
  }
  console.log(`\nMoved ${ids.length} tickets to spam.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
