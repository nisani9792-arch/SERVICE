import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { sweepSpamHeuristicChunk } from "@/lib/spam-sweep";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Move empty/noise inquiries to spam in chunks (on demand, no Gemini). */
export async function POST(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    const limit = Math.min(500, Math.max(1, Number(body.limit) || 200));
    const result = await sweepSpamHeuristicChunk(limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Spam sweep failed",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}
