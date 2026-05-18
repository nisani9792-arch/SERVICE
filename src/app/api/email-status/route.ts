import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { getEmailDeliveryStatus } from "@/lib/email-send";
import { getGmailEnvPresence } from "@/lib/gmail-api";

export const dynamic = "force-dynamic";

/** Diagnostics for Gmail API reply setup (no secret values exposed). */
export async function GET(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const status = await getEmailDeliveryStatus();
    const gmailEnv = getGmailEnvPresence();
    const replyOk =
      status.replyProvider !== "gmail_api" ||
      status.gmailApiConfigured ||
      Boolean(status.replyViaSmtpFallback);
    const ingestOk = status.ingestProvider === "imap" || status.gmailApiConfigured;

    return NextResponse.json({
      ok: replyOk && ingestOk,
      replyOk,
      ingestOk,
      gmailEnv,
      ...status,
      hint:
        status.hint ??
        (replyOk && ingestOk
          ? `מוכן — ייבוא: ${status.ingestProvider}, שליחה: ${status.replyProvider}`
          : "בדוק הגדרות מייל ב-Render (שירות Web jusic-crm)")
    });
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
