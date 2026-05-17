import { NextResponse } from "next/server";
import { getEmailDeliveryStatus } from "@/lib/email-send";

export const dynamic = "force-dynamic";

/** Public diagnostics for email reply setup (no secrets exposed). */
export async function GET() {
  try {
    const status = await getEmailDeliveryStatus();
    const fromDomain = status.fromAddress.split("@")[1] ?? "";
    const domainMatch = status.resendDomains?.find(
      (d) => d.name.toLowerCase() === fromDomain.toLowerCase()
    );

    const apiOk = status.resendApiKeyValid === true;
    const ready =
      status.effectiveProvider === "resend" && status.resendKeyConfigured && apiOk;

    return NextResponse.json({
      ok: ready,
      ...status,
      fromDomain,
      domainVerified: domainMatch?.status === "verified",
      hint: !status.resendKeyConfigured
        ? "הוסף RESEND_API_KEY ב-Render (שירות jusic-crm)"
        : status.resendApiKeyValid === false
          ? "מפתח Resend לא תקין — צור API Key חדש ב-resend.com, עדכן ב-Render, Deploy מחדש"
          : !status.resendKeyFormatValid
            ? "המפתח חייב להתחיל ב-re_ ללא מרכאות או רווחים"
            : !domainMatch
              ? `הוסף/אמת את ${fromDomain} ב-Resend → Domains`
              : domainMatch.status !== "verified"
                ? `הדומיין ${fromDomain} במצב: ${domainMatch.status} — השלם DNS`
                : ready
                  ? domainMatch?.status === "verified"
                    ? "מוכן לשליחה"
                    : "מפתח תקין — נסה לשלוח (אם נכשל, אמת דומיין ב-Resend)"
                  : "בדוק EMAIL_FROM=editor@jusic.co ו-EMAIL_REPLY_PROVIDER=resend"
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
