import { NextRequest, NextResponse } from "next/server";
import { classifyTicketContent } from "@/lib/gemini";
import { ClassifiedImportRecord, ImportRecordInput } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_FAST_CLASSIFICATION = {
  category: "suggestions" as const,
  priority: 3 as const,
  summary: "פנייה שיובאה בייבוא מהיר וממתינה לסיווג ידני."
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      records?: ImportRecordInput[];
      skipClassification?: boolean;
    };

    const records = Array.isArray(body.records) ? body.records : [];
    if (records.length === 0) {
      return NextResponse.json(
        { error: "records must be a non-empty array" },
        { status: 400 }
      );
    }

    const enriched: ClassifiedImportRecord[] = [];

    for (const record of records) {
      const senderEmail = String(record.senderEmail ?? "").trim();
      const subject = String(record.subject ?? "").trim();
      const content = String(record.body ?? "").trim();
      const senderName = String(record.senderName ?? "").trim();

      if (!senderEmail || !subject || !content) {
        continue;
      }

      let classification;
      if (body.skipClassification) {
        classification = DEFAULT_FAST_CLASSIFICATION;
      } else {
        try {
          classification = await classifyTicketContent(
            senderEmail,
            subject,
            content
          );
        } catch {
          classification = DEFAULT_FAST_CLASSIFICATION;
        }
      }

      enriched.push({
        senderEmail,
        senderName,
        subject,
        body: content,
        ...classification
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
