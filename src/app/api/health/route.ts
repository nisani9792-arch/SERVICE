import { NextResponse } from "next/server";
import { getEmailDeliveryStatus } from "@/lib/email-send";
import { listBackupSnapshots } from "@/lib/db-backup";
import { sql } from "@/lib/neon";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  try {
    const rows = await sql()`SELECT version()`;
    checks.neon = { ok: true, detail: rows[0]?.version ?? "connected" };
  } catch (error) {
    checks.neon = {
      ok: false,
      detail: error instanceof Error ? error.message : "connection failed"
    };
  }

  const geminiKey =
    process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  checks.gemini = {
    ok: Boolean(geminiKey),
    detail: geminiKey ? "API key configured" : "GOOGLE_GEMINI_API_KEY is missing"
  };

  const email = await getEmailDeliveryStatus();
  checks.email = {
    ok: email.gmailApiConfigured || email.smtpConfigured,
    detail: `provider=${email.replyProvider}, gmailApi=${email.gmailApiConfigured}, from=${email.fromFormatted}`
  };

  try {
    const backups = await listBackupSnapshots(1);
    checks.backups = {
      ok: backups.length > 0,
      detail:
        backups.length > 0
          ? `latest=${backups[0]?.backupKey} (${backups[0]?.createdAt})`
          : "no automatic backup yet — cron runs every 3 days"
    };
  } catch (error) {
    checks.backups = {
      ok: false,
      detail: error instanceof Error ? error.message : "backup check failed"
    };
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    { status: allOk ? "healthy" : "degraded", checks },
    { status: allOk ? 200 : 503 }
  );
}
