import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { classifyTicketContent } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql()`
      SELECT id, sender_email, sender_name, subject, body,
             category, priority, ai_summary, status, source,
             created_at, updated_at
      FROM tickets
      ORDER BY created_at DESC
    `;
    const tickets = rows.map((r) => ({
      id: r.id,
      senderEmail: r.sender_email,
      senderName: r.sender_name,
      subject: r.subject,
      body: r.body,
      category: r.category,
      priority: r.priority,
      aiSummary: r.ai_summary,
      status: r.status,
      source: r.source,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
    return NextResponse.json(tickets);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch tickets", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      senderEmail?: string;
      senderName?: string;
      subject?: string;
      body?: string;
      source?: string;
    };

    const senderEmail = (body.senderEmail ?? "").trim();
    const senderName = (body.senderName ?? "").trim();
    const subject = (body.subject ?? "").trim();
    const content = (body.body ?? "").trim();
    const source = body.source ?? "manual";

    if (!senderEmail || !subject || !content) {
      return NextResponse.json(
        { error: "senderEmail, subject, and body are required" },
        { status: 400 }
      );
    }

    const classification = await classifyTicketContent(senderEmail, subject, content);

    const rows = await sql()`
      INSERT INTO tickets (sender_email, sender_name, subject, body, category, priority, ai_summary, status, source)
      VALUES (${senderEmail}, ${senderName}, ${subject}, ${content},
              ${classification.category}, ${classification.priority}, ${classification.summary},
              ${"open"}, ${source})
      RETURNING id, sender_email, sender_name, subject, body, category, priority, ai_summary, status, source, created_at, updated_at
    `;

    const r = rows[0];
    return NextResponse.json({
      id: r.id,
      senderEmail: r.sender_email,
      senderName: r.sender_name,
      subject: r.subject,
      body: r.body,
      category: r.category,
      priority: r.priority,
      aiSummary: r.ai_summary,
      status: r.status,
      source: r.source,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create ticket", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
