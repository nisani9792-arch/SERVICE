import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { reclassifyTicketContent } from "@/lib/gemini";
import { bodyForAiPrompt } from "@/lib/message-filter";
import { sql } from "@/lib/neon";
import { invalidateStatsCache } from "@/lib/stats-cache";
import { ensureTicketUpgradeSchema } from "@/lib/ticket-schema";
import { PENDING_TRIAGE_CATEGORY } from "@/lib/triage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BATCH = 40;

function isSpamCategory(category: string): boolean {
  const c = category.trim().toLowerCase();
  return c === "spam" || c === "spam (מובנה)";
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

async function classifyRows(rows: TicketRow[]) {
  const results: Array<{ id: string; from: string; to: string; summary: string }> = [];

  for (const row of rows) {
    const aiBody = bodyForAiPrompt(String(row.body ?? ""), row.body_cleaned);
    const classification = await reclassifyTicketContent(
      String(row.sender_email ?? ""),
      String(row.subject ?? ""),
      aiBody
    );

    const wasSpam = isSpamCategory(String(row.category));
    const nowSpam = isSpamCategory(classification.category);
    const reopen = wasSpam && !nowSpam;

    await sql()`
      UPDATE tickets
      SET category = ${classification.category},
          priority = ${classification.priority},
          ai_summary = ${classification.summary},
          body_cleaned = ${aiBody},
          status = ${reopen ? "open" : row.status},
          updated_at = now()
      WHERE id = ${row.id}
    `;

    results.push({
      id: String(row.id),
      from: String(row.category),
      to: classification.category,
      summary: classification.summary
    });
  }

  return results;
}

/** Single-request reclassify (max ${MAX_BATCH} tickets). For larger sets use POST /api/tickets/reclassify/batch */
export async function POST(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    await ensureTicketUpgradeSchema();

    const body = (await request.json()) as { scope?: string; limit?: number; ids?: string[] };
    const scope = (body.scope ?? "spam").trim().toLowerCase();
    const limit = Math.min(MAX_BATCH, Math.max(1, Number(body.limit) || 25));
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean).slice(0, MAX_BATCH) : [];

    let rows: TicketRow[] = [];

    if (ids.length > 0) {
      rows = (await sql()`
        SELECT id, sender_email, subject, body, body_cleaned, category, status
        FROM tickets
        WHERE id = ANY(${ids})
        ORDER BY updated_at DESC
        LIMIT ${MAX_BATCH}
      `) as TicketRow[];
    } else if (scope === "spam") {
      rows = (await sql()`
        SELECT id, sender_email, subject, body, body_cleaned, category, status
        FROM tickets
        WHERE lower(category) IN ('spam', 'spam (מובנה)')
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `) as TicketRow[];
    } else if (scope === "pending_triage") {
      rows = (await sql()`
        SELECT id, sender_email, subject, body, body_cleaned, category, status
        FROM tickets
        WHERE category = ${PENDING_TRIAGE_CATEGORY}
        ORDER BY created_at ASC
        LIMIT ${limit}
      `) as TicketRow[];
    } else {
      return NextResponse.json(
        { error: "Invalid scope. Use spam, pending_triage, or pass ids[]" },
        { status: 400 }
      );
    }

    const results = await classifyRows(rows);
    invalidateStatsCache();

    return NextResponse.json({
      ok: true,
      scope: ids.length > 0 ? "ids" : scope,
      scanned: rows.length,
      updated: results.length,
      results,
      hint:
        rows.length >= limit
          ? "For more tickets use POST /api/tickets/reclassify/batch with polling"
          : undefined
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Reclassify failed",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}
