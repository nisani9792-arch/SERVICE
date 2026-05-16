import { NextRequest, NextResponse } from "next/server";
import { resolveAccessState } from "@/lib/access-state";
import { getClientIp } from "@/lib/client-ip";
import { registerOperatorName } from "@/lib/operator";
import {
  attachSessionCookie,
  bindSessionDisplayName,
  getSessionTokenFromRequest,
  resolveOrCreateSessionToken,
  unlockSession
} from "@/lib/operator-session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { displayName?: string };
    const displayName = String(body.displayName ?? "").trim();
    if (!displayName || displayName.length > 80) {
      return NextResponse.json({ error: "שם משתמש חובה (עד 80 תווים)" }, { status: 400 });
    }

    const ip = getClientIp(request);
    const access = await resolveAccessState(request);
    if (!access.unlocked) {
      return NextResponse.json({ error: "נדרשת כניסה למערכת לפני רישום השם" }, { status: 403 });
    }

    const token = getSessionTokenFromRequest(request) ?? (await resolveOrCreateSessionToken(request, ip));
    await unlockSession(token, ip);
    await bindSessionDisplayName(token, displayName);
    await registerOperatorName(ip, displayName, { gateAlreadyUnlocked: true });

    const response = NextResponse.json({ ok: true, displayName });
    attachSessionCookie(response, token);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown";
    const status = message === "gate not unlocked" ? 403 : 500;
    return NextResponse.json({ error: "register failed", details: message }, { status });
  }
}
