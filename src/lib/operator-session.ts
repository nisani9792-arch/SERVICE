import type { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";

export const SESSION_COOKIE = "service_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 365;

let tableReady = false;

export type OperatorSession = {
  token: string;
  displayName: string;
  gateUnlocked: boolean;
};

async function ensureSessionTable(): Promise<void> {
  if (tableReady) return;
  await sql()`
    CREATE TABLE IF NOT EXISTS operator_sessions (
      token          TEXT PRIMARY KEY,
      display_name   TEXT NOT NULL DEFAULT '',
      gate_unlocked  BOOLEAN NOT NULL DEFAULT false,
      ip_address     TEXT NOT NULL DEFAULT '',
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '365 days'),
      last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql()`
    CREATE INDEX IF NOT EXISTS idx_operator_sessions_expires
    ON operator_sessions (expires_at)
  `;
  tableReady = true;
}

export function createSessionToken(): string {
  return crypto.randomUUID();
}

export function getSessionTokenFromRequest(request: NextRequest): string | null {
  const value = request.cookies.get(SESSION_COOKIE)?.value?.trim();
  return value || null;
}

export function attachSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC
  });
}

export async function getSession(token: string): Promise<OperatorSession | null> {
  await ensureSessionTable();
  const rows = await sql()`
    SELECT token, display_name, gate_unlocked
    FROM operator_sessions
    WHERE token = ${token}
      AND expires_at > now()
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    token: String(row.token),
    displayName: String(row.display_name ?? "").trim(),
    gateUnlocked: Boolean(row.gate_unlocked)
  };
}

export async function createSession(ipAddress: string): Promise<string> {
  await ensureSessionTable();
  const token = createSessionToken();
  await sql()`
    INSERT INTO operator_sessions (token, ip_address, gate_unlocked, last_seen_at, expires_at)
    VALUES (${token}, ${ipAddress}, false, now(), now() + interval '365 days')
  `;
  return token;
}

export async function unlockSession(token: string, ipAddress: string): Promise<void> {
  await ensureSessionTable();
  await sql()`
    INSERT INTO operator_sessions (token, ip_address, gate_unlocked, last_seen_at, expires_at)
    VALUES (${token}, ${ipAddress}, true, now(), now() + interval '365 days')
    ON CONFLICT (token) DO UPDATE SET
      gate_unlocked = true,
      ip_address = ${ipAddress},
      last_seen_at = now(),
      expires_at = now() + interval '365 days'
  `;
}

export async function bindSessionDisplayName(token: string, displayName: string): Promise<void> {
  const name = displayName.trim();
  if (!name) throw new Error("display name required");

  await ensureSessionTable();
  await sql()`
    UPDATE operator_sessions
    SET display_name = ${name},
        gate_unlocked = true,
        last_seen_at = now(),
        expires_at = now() + interval '365 days'
    WHERE token = ${token}
  `;
}

export async function touchSession(token: string): Promise<void> {
  await ensureSessionTable();
  await sql()`
    UPDATE operator_sessions
    SET last_seen_at = now()
    WHERE token = ${token}
      AND expires_at > now()
  `;
}

export async function resolveOrCreateSessionToken(
  request: NextRequest,
  ipAddress: string
): Promise<string> {
  const existing = getSessionTokenFromRequest(request);
  if (existing) {
    const session = await getSession(existing);
    if (session) return existing;
  }
  return createSession(ipAddress);
}
