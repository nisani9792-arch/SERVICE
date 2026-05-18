import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { sql } from "@/lib/neon";
import {
  backfillReplyKnowledgeFromTickets,
  ensureReplyKnowledgeSchema,
  findSimilarReplySuggestions
} from "@/lib/reply-knowledge";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    await ensureReplyKnowledgeSchema();

    const backfill = request.nextUrl.searchParams.get("backfill") === "1";
    let backfilled = 0;
    if (backfill) {
      backfilled = await backfillReplyKnowledgeFromTickets(800);
    }

    const counts = await sql()`
      SELECT
        count(*) FILTER (WHERE deleted_at IS NULL)::int AS active_tickets,
        count(*) FILTER (
          WHERE deleted_at IS NULL
            AND closure_note IS NOT NULL
            AND length(trim(closure_note)) > 10
        )::int AS answered_tickets,
        count(*) FILTER (
          WHERE deleted_at IS NULL
            AND lower(trim(category)) IN ('spam', 'spam (מובנה)')
        )::int AS spam_tickets
      FROM tickets
    `;

    const knowledgeCount = await sql()`
      SELECT count(*)::int AS c FROM ticket_reply_knowledge
    `;

    const topCategories = await sql()`
      SELECT category, count(*)::int AS c
      FROM tickets
      WHERE deleted_at IS NULL
        AND lower(trim(category)) NOT IN ('spam', 'spam (מובנה)')
      GROUP BY category
      ORDER BY c DESC
      LIMIT 8
    `;

    const recentAnswered = await sql()`
      SELECT id, subject, body, body_cleaned, category, closure_note, updated_at
      FROM tickets
      WHERE deleted_at IS NULL
        AND closure_note IS NOT NULL
        AND length(trim(closure_note)) > 30
        AND NOT (lower(trim(category)) IN ('spam', 'spam (מובנה)'))
      ORDER BY updated_at DESC
      LIMIT 12
    `;

    const frequentTopics: Array<{
      subject: string;
      count: number;
      sampleReply: string;
    }> = [];

    for (const row of recentAnswered.slice(0, 8)) {
      const subject = String((row as { subject: string }).subject ?? "");
      const inquiry = String(
        (row as { body_cleaned: string }).body_cleaned ||
          (row as { body: string }).body ||
          ""
      );
      const similar = await findSimilarReplySuggestions(subject, inquiry, 1);
      frequentTopics.push({
        subject: subject.slice(0, 80),
        count: similar.length > 0 ? similar[0]!.score + 1 : 1,
        sampleReply: similar[0]?.replyText.slice(0, 280) ?? String((row as { closure_note: string }).closure_note).slice(0, 280)
      });
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      backfilled,
      totals: {
        activeTickets: Number((counts[0] as { active_tickets: number }).active_tickets ?? 0),
        answeredTickets: Number((counts[0] as { answered_tickets: number }).answered_tickets ?? 0),
        spamTickets: Number((counts[0] as { spam_tickets: number }).spam_tickets ?? 0),
        knowledgeEntries: Number((knowledgeCount[0] as { c: number }).c ?? 0)
      },
      topCategories: topCategories.map((r) => ({
        category: String((r as { category: string }).category),
        count: Number((r as { c: number }).c)
      })),
      frequentTopics,
      hint:
        "ככל שתסגרו פניות עם מענה ללקוח, המערכת לומדת תשובות דומות ומציעה אותן במסך המענה."
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to build insights",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}
