import { isEmptyOrNoiseInquiry } from "@/lib/inquiry-spam-heuristic";
import { quickHeuristic } from "@/lib/gemini";
import { bodyForAiPrompt } from "@/lib/message-filter";
import { sql } from "@/lib/neon";
import { invalidateStatsCache } from "@/lib/stats-cache";

export type SpamSweepResult = {
  scanned: number;
  movedToSpam: number;
  done: boolean;
};

type SweepRow = {
  id: string;
  subject: string;
  body: string;
  body_cleaned: string;
};

export async function sweepSpamHeuristicChunk(limit = 200): Promise<SpamSweepResult> {
  const rows = (await sql()`
    SELECT id, subject, body, body_cleaned
    FROM tickets
    WHERE deleted_at IS NULL
      AND lower(trim(category)) NOT IN ('spam', 'spam (מובנה)')
      AND category <> 'customer_followup'
    ORDER BY created_at ASC
    LIMIT ${Math.min(500, Math.max(1, limit))}
  `) as SweepRow[];

  const toSpam: string[] = [];

  for (const row of rows) {
    const subject = String(row.subject ?? "");
    const body = bodyForAiPrompt(String(row.body ?? ""), row.body_cleaned);
    if (isEmptyOrNoiseInquiry(subject, body)) {
      toSpam.push(String(row.id));
      continue;
    }
    const heuristic = quickHeuristic(subject, body);
    if (heuristic?.category === "spam") {
      toSpam.push(String(row.id));
    }
  }

  if (toSpam.length > 0) {
    await sql()`
      UPDATE tickets
      SET category = 'spam',
          status = 'closed',
          priority = 1,
          ai_summary = COALESCE(NULLIF(trim(ai_summary), ''), 'סווג אוטומטית כספאם (ללא פנייה משמעותית)'),
          updated_at = now()
      WHERE id = ANY(${toSpam})
        AND deleted_at IS NULL
    `;
    invalidateStatsCache();
  }

  const remaining = await sql()`
    SELECT count(*)::int AS c
    FROM tickets
    WHERE deleted_at IS NULL
      AND lower(trim(category)) NOT IN ('spam', 'spam (מובנה)')
      AND category <> 'customer_followup'
  `;

  const left = Number((remaining[0] as { c: number }).c ?? 0);

  return {
    scanned: rows.length,
    movedToSpam: toSpam.length,
    done: rows.length === 0 || left === 0
  };
}
