import type { NextRequest, NextResponse } from "next/server";

export const GATE_COOKIE_NAME = "service_gate";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 90;

export function getGateTokenFromRequest(request: NextRequest): string | null {
  const value = request.cookies.get(GATE_COOKIE_NAME)?.value?.trim();
  return value || null;
}

export function attachGateCookie(response: NextResponse, sessionToken: string): void {
  response.cookies.set(GATE_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SEC
  });
}
