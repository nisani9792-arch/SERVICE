import { NextRequest, NextResponse } from "next/server";
import { getRegisteredDisplayName, isAccessUnlocked } from "@/lib/access-state";

const PUBLIC_API_PREFIXES = [
  "/api/operator/",
  "/api/health",
  "/api/email-ingest",
  "/api/email-outbound/",
  "/api/backup/"
];

export function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Returns 401 response if gate not unlocked for this client. */
export async function requireGateAccess(
  request: NextRequest
): Promise<NextResponse | null> {
  const unlocked = await isAccessUnlocked(request);
  if (!unlocked) {
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

  const displayName = (await getRegisteredDisplayName(request)) ?? "";
  if (!displayName) {
    return NextResponse.json({ error: "נדרש רישום שם משתמש" }, { status: 403 });
  }
  return { displayName };
}
