import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

function secretsMatch(configured: string, provided: string): boolean {
  const configuredBytes = Buffer.from(configured);
  const providedBytes = Buffer.from(provided);
  return (
    configuredBytes.length === providedBytes.length &&
    timingSafeEqual(configuredBytes, providedBytes)
  );
}

export function backupSecretConfigured(): string | undefined {
  return (
    process.env.BACKUP_SECRET?.trim() ||
    process.env.EMAIL_INGEST_SECRET?.trim() ||
    undefined
  );
}

export function hasValidBackupSecret(request: NextRequest): boolean {
  const configured = backupSecretConfigured();
  if (!configured) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization")?.trim();
  const bearer = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : "";
  const provided =
    bearer ||
    request.headers.get("x-backup-secret")?.trim() ||
    request.headers.get("x-email-ingest-secret")?.trim() ||
    request.nextUrl.searchParams.get("secret")?.trim();

  if (!provided) return false;
  return secretsMatch(configured, provided);
}
