import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BulkInsertRecord = {
  senderEmail: string;
  senderName?: string;
  subject: string;
  body: string;
  category: string;
  priority: number;
  summary: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { records?: BulkInsertRecord[] };
    const records = Array.isArray(body.records) ? body.records : [];

    if (records.length === 0) {
      return NextResponse.json(
        { error: "records array is required" },
        { status: 400 }
      );
    }

    const senderEmails: string[] = [];
    const senderNames: string[] = [];
    const subjects: string[] = [];
    const bodies: string[] = [];
    const categories: string[] = [];
    const priorities: number[] = [];
    const summaries: string[] = [];

    for (const record of records) {
      const senderEmail = String(record.senderEmail ?? "").trim();
      const subject = String(record.subject ?? "").trim();
      const content = String(record.body ?? "").trim();
      if (!senderEmail || !subject || !content) continue;

      const priorityValue = Number(record.priority);
      const priority =
        Number.isInteger(priorityValue) && priorityValue >= 1 && priorityValue <= 5
          ? priorityValue
          : 3;

      senderEmails.push(senderEmail);
      senderNames.push(String(record.senderName ?? "").trim());
      subjects.push(subject);
      bodies.push(content);
      categories.push(String(record.category ?? "suggestions").trim() || "suggestions");
      priorities.push(priority);
      summaries.push(String(record.summary ?? "").trim());
    }

    if (senderEmails.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 });
    }

    await sql()`
      INSERT INTO tickets
        (sender_email, sender_name, subject, body, category, priority, ai_summary, status, source)
      SELECT * FROM UNNEST (
        ${senderEmails}::text[],
        ${senderNames}::text[],
        ${subjects}::text[],
        ${bodies}::text[],
        ${categories}::text[],
        ${priorities}::int[],
        ${summaries}::text[],
        ${senderEmails.map(() => "open")}::text[],
        ${senderEmails.map(() => "import")}::text[]
      )
    `;

    return NextResponse.json({ ok: true, inserted: senderEmails.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Bulk insert failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      ids: string[];
      category?: string;
      status?: string;
    };

    const ids = body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    const category = body.category ?? null;
    const status = category === "handled" ? "handled" : (body.status ?? null);

    await sql()`
      UPDATE tickets SET
        category   = COALESCE(${category}, category),
        status     = COALESCE(${status}, status),
        updated_at = now()
      WHERE id = ANY(${ids})
    `;

    return NextResponse.json({ ok: true, updated: ids.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Bulk update failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as { ids: string[] };
    const ids = body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    await sql()`DELETE FROM tickets WHERE id = ANY(${ids})`;
    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Bulk delete failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
