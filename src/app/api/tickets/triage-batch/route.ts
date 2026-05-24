import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { fetchTriageBatch, type TriageQueueKey } from "@/lib/ticket-bucket-view";
import { rowToTicket } from "@/lib/ticket-row";
import { invalidateStatsCache } from "@/lib/stats-cache";

export const dynamic = "force-dynamic";

function parseQueue(raw: string | null): TriageQueueKey {
  const v = (raw ?? "active").trim().toLowerCase();
  if (
    v === "active" ||
    v === "handled" ||
    v === "spam" ||
    v === "outbox" ||
    v === "deleted" ||
    v === "triage" ||
    v === "all"
  ) {
    return v;
  }
  return "active";
}

/** SSOT: items + total + bucket counts in one round-trip. */
export async function GET(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const sp = request.nextUrl.searchParams;
    const queue = parseQueue(sp.get("queue"));
    const offset = parseInt(sp.get("offset") ?? "0", 10) || 0;
    const limit = parseInt(sp.get("limit") ?? "3", 10) || 3;
    const q = sp.get("q");

    const { items, total, bucketCounts } = await fetchTriageBatch({
      queue,
      offset,
      limit,
      q
    });

    const tickets = items.map((row) => rowToTicket(row as Record<string, unknown>));

    return NextResponse.json({
      items: tickets,
      total,
      bucketCounts,
      queue,
      offset,
      limit
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "triage-batch failed",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      action?: "invalidate_stats";
    };
    if (body.action === "invalidate_stats") {
      invalidateStatsCache();
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
