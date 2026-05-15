import { NextResponse } from "next/server";
import { sql } from "@/lib/neon";

export const dynamic = "force-dynamic";

function isSpamRow(category: string): boolean {
  const c = category.trim().toLowerCase().replace(/\s+/g, "_");
  return c === "spam" || c.includes("pr/media") || c.includes("pr_media");
}

export async function GET() {
  try {
    const catRows = await sql()`
      SELECT category, count(*)::int AS c
      FROM tickets
      GROUP BY category
      ORDER BY c DESC
    `;

    const statusRows = await sql()`
      SELECT status, count(*)::int AS c
      FROM tickets
      GROUP BY status
    `;

    const totalRows = await sql()`SELECT count(*)::int AS c FROM tickets`;
    const total = totalRows[0]?.c ?? 0;

    const byCategory = catRows.map((r) => ({
      category: String(r.category),
      count: Number(r.c)
    }));

    const statusCounts = {
      open: 0,
      in_progress: 0,
      closed: 0
    };
    for (const row of statusRows) {
      const s = String(row.status).toLowerCase();
      if (s === "handled") {
        statusCounts.closed += Number(row.c);
      } else if (s in statusCounts) {
        statusCounts[s as keyof typeof statusCounts] += Number(row.c);
      } else {
        statusCounts.open += Number(row.c);
      }
    }

    let spamLike = 0;
    for (const row of catRows) {
      if (isSpamRow(String(row.category))) {
        spamLike += Number(row.c);
      }
    }

    const spamPercent = total > 0 ? Math.round((spamLike / total) * 1000) / 10 : 0;

    const openClosedRatio = {
      open: statusCounts.open + statusCounts.in_progress,
      closed: statusCounts.closed
    };

    const pendingTriageRows = await sql()`
      SELECT count(*)::int AS c
      FROM tickets
      WHERE category = 'pending_triage'
        AND status NOT IN ('closed', 'handled')
    `;
    const pendingTriageCount = pendingTriageRows[0]?.c ?? 0;

    return NextResponse.json({
      total,
      byCategory,
      statusCounts,
      openClosedRatio,
      spamPercent,
      spamCount: spamLike,
      pendingTriageCount
    });
  } catch (error) {
    return NextResponse.json(
      { error: "stats failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
