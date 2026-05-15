import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { getOperatorByIp } from "@/lib/operator";

const PUBLIC_API_PREFIXES = [
  "/api/operator/",
  "/api/health",
  "/api/email-ingest",
  "/api/backup/"
];

export function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Returns 401 response if gate not unlocked for this IP. */
export async function requireGateAccess(
  request: NextRequest
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const op = await getOperatorByIp(ip);
  if (!op?.gateUnlocked) {
    return NextResponse.json({ error: "נדרשת כניסה למערכת" }, { status: 401 });
  }
  return null;
}

/** Gate + registered operator name (for mutations). */
export async function requireRegisteredOperator(
  request: NextRequest
): Promise<{ displayName: string } | NextResponse> {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  const ip = getClientIp(request);
  const op = await getOperatorByIp(ip);
  const displayName = op?.displayName?.trim() ?? "";
  if (!displayName) {
    return NextResponse.json({ error: "נדרש רישום שם משתמש" }, { status: 403 });
  }
  return { displayName };
}
