import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { unlockGateForIp } from "@/lib/operator";
import {
  attachSessionCookie,
  resolveOrCreateSessionToken,
  unlockSession
} from "@/lib/operator-session";

export const dynamic = "force-dynamic";

const GATE_CODE = (process.env.GATE_ACCESS_CODE ?? "JUSIC").trim().toUpperCase();

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      method?: string;
      code?: string;
    };

    const method = String(body.method ?? "code").toLowerCase();
    const code = String(body.code ?? "").trim().toUpperCase();

    if (method === "code" && code !== GATE_CODE) {
      return NextResponse.json({ error: "קוד כניסה שגוי" }, { status: 403 });
    }

    if (method !== "code" && method !== "space" && method !== "biometric") {
      return NextResponse.json({ error: "שיטת כניסה לא חוקית" }, { status: 400 });
    }

    const ip = getClientIp(request);
    await unlockGateForIp(ip);

    const token = await resolveOrCreateSessionToken(request, ip);
    await unlockSession(token, ip);

    const response = NextResponse.json({ ok: true });
    attachSessionCookie(response, token);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "unlock failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
