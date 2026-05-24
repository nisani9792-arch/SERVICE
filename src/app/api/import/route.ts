import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { classifyHybrid } from "@/lib/classification";
import { cleanMessageForAi } from "@/lib/message-filter";
import { prepareHistoricalBatch } from "@/lib/historical-import";
import type { ClassifiedImportRecord, HistoricalTicketJson, ImportRecordInput } from "@/lib/types";
import { sql } from "@/lib/neon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_FAST_CLASSIFICATION = {
  category: "suggestions" as const,
  priority: 3 as const,
  summary: "פנייה שיובאה בייבוא מהיר וממתינה לסיווג ידני."
};

export async function POST(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      records?: ImportRecordInput[];
      skipClassification?: boolean;
    };

    const records = Array.isArray(body.records) ? body.records : [];
    if (records.length === 0) {
      return NextResponse.json({ error: "records must be a non-empty array" }, { status: 400 });
    }

    const enriched: ClassifiedImportRecord[] = [];

    for (const record of records) {
      const senderEmail = String(record.senderEmail ?? "").trim();
      const subject = String(record.subject ?? "").trim();
      const content = String(record.body ?? "");
      const senderName = String(record.senderName ?? "").trim();

      if (!senderEmail || !subject) {
        continue;
      }

      let classification;
      if (body.skipClassification) {
        classification = DEFAULT_FAST_CLASSIFICATION;
      } else {
        try {
          const bodyCleaned = cleanMessageForAi(content);
          const hybrid = await classifyHybrid(senderEmail, subject, bodyCleaned);
          classification = {
            category: hybrid.category,
            priority: hybrid.priority,
            summary: hybrid.summary
          };
        } catch {
          classification = DEFAULT_FAST_CLASSIFICATION;
        }
      }

      enriched.push({
        senderEmail,
        senderName,
        subject,
        body: content,
        category: classification.category,
        priority: classification.priority,
        summary: classification.summary
      });
    }

    return NextResponse.json({ records: enriched });
  } catch (error) {
    return NextResponse.json(
      {
        error: "failed to import records",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * Fast path for large historical JSON dumps (no Gemini). Uses structured categories & auto-closes spam-like rows.
 */
export async function PUT(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      records?: HistoricalTicketJson[];
    };
    const raw = Array.isArray(body.records) ? body.records : [];
    const prepared = prepareHistoricalBatch(raw);

    if (prepared.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 });
    }

    const senderEmails: string[] = [];
    const senderNames: string[] = [];
    const subjects: string[] = [];
    const bodies: string[] = [];
    const categories: string[] = [];
    const priorities: number[] = [];
    const summaries: string[] = [];
    const statuses: string[] = [];
    const messageAts: (string | null)[] = [];

    for (const row of prepared) {
      senderEmails.push(row.senderEmail);
      senderNames.push(row.senderName);
      subjects.push(row.subject);
      bodies.push(row.body);
      categories.push(row.category);
      priorities.push(row.priority);
      summaries.push(row.summary);
      statuses.push(row.status);
      messageAts.push(row.messageAt);
    }

    await sql()`
      INSERT INTO tickets
        (sender_email, sender_name, subject, body, category, priority, ai_summary, status, source, message_at)
      SELECT * FROM UNNEST (
        ${senderEmails}::text[],
        ${senderNames}::text[],
        ${subjects}::text[],
        ${bodies}::text[],
        ${categories}::text[],
        ${priorities}::int[],
        ${summaries}::text[],
        ${statuses}::text[],
        ${senderEmails.map(() => "import")}::text[],
        ${messageAts}::timestamptz[]
      )
    `;

    return NextResponse.json({ ok: true, inserted: prepared.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: "historical import failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
