import { NextRequest, NextResponse } from "next/server";
import { resolveAccessState } from "@/lib/access-state";
import { getClientIp } from "@/lib/client-ip";
import {
  attachSessionCookie,
  bindSessionDisplayName,
  resolveOrCreateSessionToken,
  unlockSession
} from "@/lib/operator-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const state = await resolveAccessState(request);

    const response = NextResponse.json({
      unlocked: state.unlocked,
      displayName: state.displayName
    });

    const token =
      state.sessionToken ?? (await resolveOrCreateSessionToken(request, ip));
    attachSessionCookie(response, token);

    if (state.unlocked && state.source === "ip") {
      await unlockSession(token, ip);
      if (state.displayName) {
        await bindSessionDisplayName(token, state.displayName);
      }
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "operator lookup failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
