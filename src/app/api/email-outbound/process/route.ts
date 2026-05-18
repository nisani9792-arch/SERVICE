import { NextRequest, NextResponse } from "next/server";
import { processOutboundEmailQueue } from "@/lib/outbound-email";

export const dynamic = "force-dynamic";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.EMAIL_OUTBOUND_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("x-email-outbound-secret")?.trim();
  return header === secret;
}

/** Cron/worker: flush outbound email queue (Gmail API). */
export async function POST(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 25)));
    const result = await processOutboundEmailQueue(limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}
