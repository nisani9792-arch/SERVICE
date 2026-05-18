import { NextResponse } from "next/server";
import { getEmailDeliveryStatus } from "@/lib/email-send";

export const dynamic = "force-dynamic";

/** Diagnostics for Gmail API reply setup (no secrets exposed). */
export async function GET() {
  try {
    const status = await getEmailDeliveryStatus();
    const ok =
      status.gmailApiConfigured &&
      status.replyProvider === "gmail_api" &&
      status.ingestProvider === "gmail_api";

    return NextResponse.json({
      ok,
      ...status,
      hint:
        status.hint ??
        (ok ? "מוכן לייבוא ושליחת מייל (Gmail API)" : "הגדר Gmail API credentials")
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
