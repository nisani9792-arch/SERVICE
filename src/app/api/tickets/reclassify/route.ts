import { NextRequest, NextResponse } from "next/server";
import { reclassifyTicketContent } from "@/lib/gemini";
import { sql } from "@/lib/neon";
import { PENDING_TRIAGE_CATEGORY } from "@/lib/triage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BATCH = 40;

function isSpamCategory(category: string): boolean {
  const c = category.trim().toLowerCase();
  return c === "spam" || c === "spam (מובנה)";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { scope?: string; limit?: number };
    const scope = (body.scope ?? "spam").trim().toLowerCase();
    const limit = Math.min(MAX_BATCH, Math.max(1, Number(body.limit) || 25));

    let rows: Array<{
      id: string;
      sender_email: string;
      subject: string;
      body: string;
      category: string;
      status: string;
    }> = [];

    if (scope === "spam") {
      rows = (await sql()`
        SELECT id, sender_email, subject, body, category, status
        FROM tickets
        WHERE lower(category) IN ('spam', 'spam (מובנה)')
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `) as typeof rows;
    } else if (scope === "pending_triage") {
      rows = (await sql()`
        SELECT id, sender_email, subject, body, category, status
        FROM tickets
        WHERE category = ${PENDING_TRIAGE_CATEGORY}
        ORDER BY created_at ASC
        LIMIT ${limit}
      `) as typeof rows;
    } else {
      return NextResponse.json({ error: "Invalid scope. Use spam or pending_triage" }, { status: 400 });
    }

    const results: Array<{
      id: string;
      from: string;
      to: string;
      summary: string;
    }> = [];

    for (const row of rows) {
      const classification = await reclassifyTicketContent(
        String(row.sender_email ?? ""),
        String(row.subject ?? ""),
        String(row.body ?? "")
      );

      const wasSpam = isSpamCategory(String(row.category));
      const nowSpam = isSpamCategory(classification.category);
      const reopen = wasSpam && !nowSpam;

      await sql()`
        UPDATE tickets
        SET category = ${classification.category},
            priority = ${classification.priority},
            ai_summary = ${classification.summary},
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

    return NextResponse.json({
      ok: true,
      scope,
      scanned: rows.length,
      updated: results.length,
      results
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
