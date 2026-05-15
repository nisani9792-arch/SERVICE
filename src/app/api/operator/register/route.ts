import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { registerOperatorName } from "@/lib/operator";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { displayName?: string };
    const displayName = String(body.displayName ?? "").trim();
    if (!displayName || displayName.length > 80) {
      return NextResponse.json({ error: "שם משתמש חובה (עד 80 תווים)" }, { status: 400 });
    }

    const ip = getClientIp(request);
    await registerOperatorName(ip, displayName);
    return NextResponse.json({ ok: true, displayName });
  } catch (error) {
    return NextResponse.json(
      { error: "register failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
