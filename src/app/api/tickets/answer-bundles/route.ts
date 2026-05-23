import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { buildAnswerBundles, syncBundleTags } from "@/lib/answer-bundles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const minSize = Math.max(2, parseInt(request.nextUrl.searchParams.get("minSize") ?? "3", 10) || 3);
    const limit = Math.min(
      3000,
      Math.max(100, parseInt(request.nextUrl.searchParams.get("limit") ?? "3000", 10) || 3000)
    );

    const result = await buildAnswerBundles({ limit, minSize });

    return NextResponse.json({
      ...result,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to build answer bundles",
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
    const body = (await request.json()) as { action?: string };
    if (body.action === "sync_tags") {
      const tagged = await syncBundleTags();
      return NextResponse.json({ ok: true, tagged });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Bundle action failed",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}
