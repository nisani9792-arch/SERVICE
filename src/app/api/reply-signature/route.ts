import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { getReplySignature, saveReplySignature } from "@/lib/reply-signature";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const signature = await getReplySignature();
    return NextResponse.json({ signature });
  } catch (error) {
    return NextResponse.json(
      { error: "failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as { opening?: string; closing?: string };
    const signature = await saveReplySignature(
      String(body.opening ?? ""),
      String(body.closing ?? "")
    );
    return NextResponse.json({ signature });
  } catch (error) {
    return NextResponse.json(
      { error: "save failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
