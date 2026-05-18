import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess, requireRegisteredOperator } from "@/lib/api-guard";
import { classifyTicketContent } from "@/lib/gemini";
import { cleanMessageForAi } from "@/lib/message-filter";
import { sql } from "@/lib/neon";
import { allocateNextTicketNumber } from "@/lib/ticket-sequence";
import { ensureTicketListColumns, ensureTicketUpgradeSchema } from "@/lib/ticket-schema";
import { parseTicketListFilters } from "@/lib/ticket-filters";
import { rowToTicket } from "@/lib/ticket-row";

export const dynamic = "force-dynamic";

const LIST_BODY_PREVIEW_CHARS = 420;

export async function GET(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    await ensureTicketListColumns();

    const parsed = parseTicketListFilters(new URL(request.url).searchParams);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const f = parsed;

    const rows = await sql()`
      SELECT
        id, ticket_number, sender_email, sender_name, subject,
        left(body, ${LIST_BODY_PREVIEW_CHARS}) AS body,
        body_cleaned,
        category, priority, ai_summary, status, source,
        message_at, tags, assigned_to, closure_note,
        email_message_id, email_mailbox_uid, email_ingested_at,
        created_at, updated_at,
        count(*) OVER()::int AS total_count
      FROM tickets
      WHERE (${f.categoryFilter}::text IS NULL OR category = ${f.categoryFilter})
        AND (
          ${f.activeStatusFilter}::boolean = false
          OR (status NOT IN ('closed', 'handled'))
        )
        AND (
          ${f.closedStatusFilter}::boolean = false
          OR (status IN ('closed', 'handled'))
        )
        AND (
          ${f.exactStatusFilter}::text IS NULL
          OR status = ${f.exactStatusFilter}
        )
        AND (
          ${f.dateFromTs}::timestamptz IS NULL
          OR COALESCE(message_at, created_at) >= ${f.dateFromTs}::timestamptz
        )
        AND (
          ${f.dateToExclusiveTs}::timestamptz IS NULL
          OR COALESCE(message_at, created_at) < ${f.dateToExclusiveTs}::timestamptz
        )
        AND (
          COALESCE(array_length(${f.tagList}::text[], 1), 0) = 0
          OR tags && ${f.tagList}::text[]
        )
        AND (${f.emailExact}::text IS NULL OR sender_email = ${f.emailExact})
        AND (
          ${f.ticketNumberExact}::int IS NULL
          OR ticket_number = ${f.ticketNumberExact}
        )
        AND (
          ${f.like}::text IS NULL
          OR subject ILIKE ${f.like}
          OR sender_email ILIKE ${f.like}
          OR sender_name ILIKE ${f.like}
          OR ai_summary ILIKE ${f.like}
          OR body ILIKE ${f.like}
          OR CAST(ticket_number AS text) ILIKE ${f.like}
        )
      ORDER BY COALESCE(message_at, created_at) DESC
      LIMIT ${f.pageSize}
      OFFSET ${f.offset}
    `;

    const total = rows.length > 0 ? Number(rows[0]?.total_count ?? 0) : 0;
    const items = rows.map((r) => {
      const row = { ...(r as Record<string, unknown>) };
      delete row.total_count;
      return rowToTicket(row);
    });

    return NextResponse.json({
      items,
      total,
      page: f.page,
      pageSize: f.pageSize
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch tickets", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const operator = await requireRegisteredOperator(request);
  if (operator instanceof NextResponse) return operator;

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

    await ensureTicketUpgradeSchema();
    const bodyCleaned = cleanMessageForAi(content);
    const classification = await classifyTicketContent(senderEmail, subject, bodyCleaned);
    const ticketNumber = await allocateNextTicketNumber();

    const rows = await sql()`
      INSERT INTO tickets (
        ticket_number, sender_email, sender_name, subject, body, body_cleaned,
        category, priority, ai_summary, status, source, assigned_to
      )
      VALUES (
        ${ticketNumber}, ${senderEmail}, ${senderName}, ${subject}, ${content}, ${bodyCleaned},
        ${classification.category}, ${classification.priority}, ${classification.summary},
        ${"open"}, ${source}, ${operator.displayName}
      )
      RETURNING id, ticket_number, sender_email, sender_name, subject, body, body_cleaned,
                category, priority, ai_summary, status, source,
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
