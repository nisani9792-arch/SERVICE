import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { sql } from "@/lib/neon";
import { getStatsCache, setStatsCache, STATS_CACHE_MS } from "@/lib/stats-cache";

export const dynamic = "force-dynamic";

function isSpamCategory(category: string): boolean {
  const c = category.trim().toLowerCase().replace(/\s+/g, "_");
  return c === "spam" || c.includes("pr/media") || c.includes("pr_media");
}

export async function GET(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const bypassCache = request.headers.get("x-service-live") === "true";
    const now = Date.now();
    const cached = getStatsCache();
    if (!bypassCache && cached && now - cached.at < STATS_CACHE_MS) {
      return NextResponse.json(cached.payload, {
        headers: { "Cache-Control": "no-store" }
      });
    }

    const aggRows = await sql()`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status = 'open')::int AS open_count,
        count(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_count,
        count(*) FILTER (WHERE status IN ('closed', 'handled'))::int AS closed_count,
        count(*) FILTER (
          WHERE status NOT IN ('closed', 'handled', 'in_progress', 'open')
        )::int AS other_openish,
        count(*) FILTER (
          WHERE category = 'pending_triage'
            AND status NOT IN ('closed', 'handled')
        )::int AS pending_triage,
        count(*) FILTER (
          WHERE category = 'customer_followup'
            AND status NOT IN ('closed', 'handled')
        )::int AS customer_followup
      FROM tickets
      WHERE deleted_at IS NULL
    `;

    const catRows = await sql()`
      SELECT category, count(*)::int AS c
      FROM tickets
      WHERE deleted_at IS NULL
      GROUP BY category
      ORDER BY c DESC
    `;

    const agg = aggRows[0];
    const total = Number(agg?.total ?? 0);
    const open = Number(agg?.open_count ?? 0) + Number(agg?.other_openish ?? 0);
    const in_progress = Number(agg?.in_progress_count ?? 0);
    const closed = Number(agg?.closed_count ?? 0);

    const byCategory = catRows.map((r) => ({
      category: String(r.category),
      count: Number(r.c)
    }));

    let spamLike = 0;
    for (const row of catRows) {
      if (isSpamCategory(String(row.category))) {
        spamLike += Number(row.c);
      }
    }

    const payload = {
      total,
      byCategory,
      statusCounts: { open, in_progress, closed },
      openClosedRatio: { open: open + in_progress, closed },
      spamPercent: total > 0 ? Math.round((spamLike / total) * 1000) / 10 : 0,
      spamCount: spamLike,
      pendingTriageCount: Number(agg?.pending_triage ?? 0),
      customerFollowupCount: Number(agg?.customer_followup ?? 0)
    };

    setStatsCache(payload);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { error: "stats failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
