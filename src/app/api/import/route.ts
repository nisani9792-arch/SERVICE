import { NextRequest, NextResponse } from "next/server";
import { classifyTicketContent } from "@/lib/gemini";
import { ImportRecordInput } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      records?: ImportRecordInput[];
    };

    const records = Array.isArray(body.records) ? body.records : [];
    if (records.length === 0) {
      return NextResponse.json(
        { error: "records must be a non-empty array" },
        { status: 400 }
      );
    }

    const enriched = [];
    for (const record of records) {
      const senderEmail = String(record.senderEmail ?? "").trim();
      const subject = String(record.subject ?? "").trim();
      const content = String(record.body ?? "").trim();

      if (!senderEmail || !subject || !content) {
        continue;
      }

      const classification = await classifyTicketContent(
        senderEmail,
        subject,
        content
      );

      enriched.push({
        senderEmail,
        senderName: String(record.senderName ?? "").trim(),
        subject,
        body: content,
        ...classification
      });
    }

    return NextResponse.json({ records: enriched });
  } catch {
    return NextResponse.json(
      { error: "failed to import records" },
      { status: 500 }
    );
  }
}
