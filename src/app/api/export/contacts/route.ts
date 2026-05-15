import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { sql } from "@/lib/neon";

export const dynamic = "force-dynamic";

function csvEscape(value: string): string {
  const v = value.replace(/"/g, '""');
  if (/[",\n\r]/.test(v)) return `"${v}"`;
  return v;
}

export async function GET(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const rows =
      category && category !== "all"
        ? await sql()`
            SELECT DISTINCT ON (lower(sender_email))
              sender_name,
              sender_email
            FROM tickets
            WHERE category = ${category}
              AND sender_email <> ''
            ORDER BY lower(sender_email), created_at DESC
          `
        : await sql()`
            SELECT DISTINCT ON (lower(sender_email))
              sender_name,
              sender_email
            FROM tickets
            WHERE sender_email <> ''
            ORDER BY lower(sender_email), created_at DESC
          `;

    const lines = ["sender_name,email"];
    for (const r of rows) {
      lines.push(
        `${csvEscape(String(r.sender_name ?? ""))},${csvEscape(String(r.sender_email ?? ""))}`
      );
    }

    const csv = lines.join("\n") + "\n";
    const suffix = category && category !== "all" ? `-${category}` : "";
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contacts${suffix}.csv"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: "export failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
