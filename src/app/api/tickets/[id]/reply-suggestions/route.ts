import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { findSimilarReplySuggestions } from "@/lib/reply-knowledge";
import { extractFreeInquiryText } from "@/lib/reply-text-extract";
import { sql } from "@/lib/neon";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const rows = await sql()`
      SELECT subject, body, body_cleaned
      FROM tickets
      WHERE id = ${params.id} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const row = rows[0] as { subject: string; body: string; body_cleaned: string };
    const subject = String(row.subject ?? "");
    const inquiry = extractFreeInquiryText(String(row.body_cleaned || row.body || ""));

    const suggestions = await findSimilarReplySuggestions(subject, inquiry, 5);
    return NextResponse.json({ suggestions, inquiryPreview: inquiry.slice(0, 280) });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch suggestions",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}
