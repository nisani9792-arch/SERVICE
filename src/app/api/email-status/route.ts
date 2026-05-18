import { NextResponse } from "next/server";
import { getEmailDeliveryStatus } from "@/lib/email-send";

export const dynamic = "force-dynamic";

/** Diagnostics for Gmail API reply setup (no secrets exposed). */
export async function GET() {
  try {
    const status = await getEmailDeliveryStatus();
    const replyOk =
      status.replyProvider !== "gmail_api" || status.gmailApiConfigured;
    const ingestOk =
      status.ingestProvider === "imap" || status.gmailApiConfigured;

    return NextResponse.json({
      ok: replyOk && ingestOk,
      replyOk,
      ingestOk,
      ...status,
      hint:
        status.hint ??
        (replyOk && ingestOk
          ? `מוכן — ייבוא: ${status.ingestProvider}, שליחה: ${status.replyProvider}`
          : "בדוק הגדרות מייל ב-Render")
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
