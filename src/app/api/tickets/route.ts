import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { classifyTicketContent } from "@/lib/gemini";
import { rowToTicket } from "@/lib/ticket-row";

export const dynamic = "force-dynamic";

const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? "25", 10) || 25)
    );
    const offset = (page - 1) * pageSize;

    const category = searchParams.get("category");
    const categoryFilter = category && category !== "all" ? category : null;

    const status = searchParams.get("status");
    const activeStatusFilter = status === "active";
    const statusFilter = status && status !== "all" && status !== "active" ? status : null;

    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const dateFromTs = dateFrom ? new Date(dateFrom).toISOString() : null;
    const dateToTs = dateTo ? new Date(dateTo).toISOString() : null;
    if ((dateFrom && Number.isNaN(Date.parse(dateFrom))) || (dateTo && Number.isNaN(Date.parse(dateTo)))) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }

    const tagsRaw = searchParams.get("tags");
    const tagList = tagsRaw
      ? tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const emailExact = searchParams.get("email")?.trim() || null;
    const q = searchParams.get("q")?.trim() || null;
    const like = q ? `%${q}%` : null;

    const countRows = await sql()`
      SELECT count(*)::int AS c
      FROM tickets
      WHERE (${categoryFilter}::text IS NULL OR category = ${categoryFilter})
        AND (${activeStatusFilter}::boolean = false OR status <> 'closed')
        AND (${statusFilter}::text IS NULL OR status = ${statusFilter})
        AND (
          ${dateFromTs}::timestamptz IS NULL
          OR COALESCE(message_at, created_at) >= ${dateFromTs}::timestamptz
        )
        AND (
          ${dateToTs}::timestamptz IS NULL
          OR COALESCE(message_at, created_at) <= ${dateToTs}::timestamptz
        )
        AND (
          COALESCE(array_length(${tagList}::text[], 1), 0) = 0
          OR tags && ${tagList}::text[]
        )
        AND (${emailExact}::text IS NULL OR sender_email = ${emailExact})
        AND (
          ${like}::text IS NULL
          OR subject ILIKE ${like}
          OR sender_email ILIKE ${like}
          OR sender_name ILIKE ${like}
          OR body ILIKE ${like}
          OR ai_summary ILIKE ${like}
        )
    `;

    const total = countRows[0]?.c ?? 0;

    const rows = await sql()`
      SELECT id, sender_email, sender_name, subject, body,
             category, priority, ai_summary, status, source,
             message_at, tags, assigned_to, closure_note,
             email_message_id, email_mailbox_uid, email_ingested_at,
             created_at, updated_at
      FROM tickets
      WHERE (${categoryFilter}::text IS NULL OR category = ${categoryFilter})
        AND (${activeStatusFilter}::boolean = false OR status <> 'closed')
        AND (${statusFilter}::text IS NULL OR status = ${statusFilter})
        AND (
          ${dateFromTs}::timestamptz IS NULL
          OR COALESCE(message_at, created_at) >= ${dateFromTs}::timestamptz
        )
        AND (
          ${dateToTs}::timestamptz IS NULL
          OR COALESCE(message_at, created_at) <= ${dateToTs}::timestamptz
        )
        AND (
          COALESCE(array_length(${tagList}::text[], 1), 0) = 0
          OR tags && ${tagList}::text[]
        )
        AND (${emailExact}::text IS NULL OR sender_email = ${emailExact})
        AND (
          ${like}::text IS NULL
          OR subject ILIKE ${like}
          OR sender_email ILIKE ${like}
          OR sender_name ILIKE ${like}
          OR body ILIKE ${like}
          OR ai_summary ILIKE ${like}
        )
      ORDER BY COALESCE(message_at, created_at) DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    const items = rows.map((r) => rowToTicket(r as Record<string, unknown>));

    return NextResponse.json({
      items,
      total,
      page,
      pageSize
    });
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

    if (!senderEmail || !subject) {
      return NextResponse.json(
        { error: "senderEmail and subject are required" },
        { status: 400 }
      );
    }

    const classification = await classifyTicketContent(senderEmail, subject, content);

    const rows = await sql()`
      INSERT INTO tickets (sender_email, sender_name, subject, body, category, priority, ai_summary, status, source)
      VALUES (${senderEmail}, ${senderName}, ${subject}, ${content},
              ${classification.category}, ${classification.priority}, ${classification.summary},
              ${"open"}, ${source})
      RETURNING id, sender_email, sender_name, subject, body, category, priority, ai_summary, status, source,
                message_at, tags, assigned_to, closure_note, email_message_id, email_mailbox_uid, email_ingested_at,
                created_at, updated_at
    `;

    const r = rows[0];
    return NextResponse.json(rowToTicket(r as Record<string, unknown>), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create ticket", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
