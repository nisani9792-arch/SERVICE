import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { getOperatorByIp, touchOperator } from "@/lib/operator";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const op = await getOperatorByIp(ip);

    if (op?.gateUnlocked) {
      await touchOperator(ip);
    }

    return NextResponse.json({
      unlocked: Boolean(op?.gateUnlocked),
      displayName: op?.displayName?.trim() || null
    });
  } catch (error) {
    return NextResponse.json(
      { error: "operator lookup failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
