import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess, requireRegisteredOperator } from "@/lib/api-guard";
import { classifyHybrid } from "@/lib/classification";
import { cleanMessageForAi } from "@/lib/message-filter";
import { sql, withQueryDedup } from "@/lib/neon";
import { allocateNextTicketNumber } from "@/lib/ticket-sequence";
import { ensureTicketListColumns, ensureTicketUpgradeSchema } from "@/lib/ticket-schema";
import { parseTicketListFilters } from "@/lib/ticket-filters";
import { ticketListFromBucketView } from "@/lib/ticket-list-query";
import { rowToTicket } from "@/lib/ticket-row";
import { ensureTicketBucketView } from "@/lib/ticket-bucket-view";

export const dynamic = "force-dynamic";

const LIST_BODY_PREVIEW_CHARS = 420;

async function fetchTicketList(searchParams: URLSearchParams) {
  await ensureTicketListColumns();
  await ensureTicketBucketView();

  const parsed = parseTicketListFilters(searchParams);
  if ("error" in parsed) {
    return { error: parsed.error, status: 400 as const };
  }

  const f = parsed;
  const sortTriage = f.sortMode === "triage";
  const useView = ticketListFromBucketView(f);

  const rows = useView
    ? await sql()`
        SELECT
          v.id, v.ticket_number, v.sender_email, v.sender_name, v.subject,
          left(v.body, ${LIST_BODY_PREVIEW_CHARS}) AS body,
          v.body_cleaned,
          v.category, v.priority, v.ai_summary, v.ai_suggested_category, v.classification_confidence,
          v.status, v.source,
          v.message_at, v.tags, v.assigned_to, v.closure_note,
          v.email_message_id, v.email_mailbox_uid, v.email_ingested_at,
          v.created_at, v.updated_at,
          count(*) OVER()::int AS total_count
        FROM ticket_buckets_v v
        WHERE v.deleted_at IS NULL
          AND (
            (${f.triageQueue}::boolean = true AND v.category IN ('pending_triage', 'customer_followup'))
            OR (
              ${f.triageQueue}::boolean = false
              AND (${f.categoryFilter}::text IS NULL OR v.category = ${f.categoryFilter})
            )
          )
          AND (
            ${f.bucketFilter}::text IS NULL
            OR v.bucket_key = ${f.bucketFilter}
          )
          AND (
            ${f.excludeSpamFilter}::boolean = false
            OR v.bucket_key <> 'spam'
          )
          AND (
            ${f.activeStatusFilter}::boolean = false
            OR v.status NOT IN ('closed', 'handled')
          )
          AND (
            ${f.closedStatusFilter}::boolean = false
            OR (
              v.status IN ('closed', 'handled')
              AND ${f.outboxStatusFilter}::boolean = false
            )
          )
          AND (
            ${f.outboxStatusFilter}::boolean = false
            OR v.bucket_key = 'outbox'
          )
          AND (
            ${f.exactStatusFilter}::text IS NULL
            OR v.status = ${f.exactStatusFilter}
          )
          AND (
            ${f.dateFromTs}::timestamptz IS NULL
            OR COALESCE(v.message_at, v.created_at) >= ${f.dateFromTs}::timestamptz
          )
          AND (
            ${f.dateToExclusiveTs}::timestamptz IS NULL
            OR COALESCE(v.message_at, v.created_at) < ${f.dateToExclusiveTs}::timestamptz
          )
          AND (
            COALESCE(array_length(${f.tagList}::text[], 1), 0) = 0
            OR v.tags && ${f.tagList}::text[]
          )
          AND (${f.emailExact}::text IS NULL OR v.sender_email = ${f.emailExact})
          AND (
            ${f.ticketNumberExact}::int IS NULL
            OR v.ticket_number = ${f.ticketNumberExact}
          )
          AND (
            ${f.like}::text IS NULL
            OR v.subject ILIKE ${f.like}
            OR v.sender_email ILIKE ${f.like}
            OR v.sender_name ILIKE ${f.like}
            OR v.ai_summary ILIKE ${f.like}
            OR v.body_cleaned ILIKE ${f.like}
            OR CAST(v.ticket_number AS text) ILIKE ${f.like}
          )
        ORDER BY
          CASE
            WHEN ${sortTriage}::boolean = true AND v.category = 'customer_followup' THEN 0
            WHEN ${sortTriage}::boolean = true THEN 1
            ELSE 2
          END ASC,
          CASE WHEN ${sortTriage}::boolean = true THEN COALESCE(v.classification_confidence, 0) ELSE 0 END DESC,
          CASE WHEN ${f.outboxStatusFilter}::boolean = true THEN v.updated_at END DESC NULLS LAST,
          COALESCE(v.message_at, v.created_at) DESC
        LIMIT ${f.pageSize}
        OFFSET ${f.offset}
      `
    : await sql()`
        SELECT
          id, ticket_number, sender_email, sender_name, subject,
          left(body, ${LIST_BODY_PREVIEW_CHARS}) AS body,
          body_cleaned,
          category, priority, ai_summary, ai_suggested_category, classification_confidence,
          status, source,
          message_at, tags, assigned_to, closure_note,
          email_message_id, email_mailbox_uid, email_ingested_at,
          created_at, updated_at,
          count(*) OVER()::int AS total_count
        FROM tickets
        WHERE deleted_at IS NOT NULL
          AND (
            (${f.triageQueue}::boolean = true AND category IN ('pending_triage', 'customer_followup'))
            OR (
              ${f.triageQueue}::boolean = false
              AND (${f.categoryFilter}::text IS NULL OR category = ${f.categoryFilter})
            )
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
            OR body_cleaned ILIKE ${f.like}
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

  return {
    body: { items, total, page: f.page, pageSize: f.pageSize }
  };
}

export async function GET(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const cacheKey = request.nextUrl.search;
    const result = await withQueryDedup(`tickets-list${cacheKey}`, () =>
      fetchTicketList(request.nextUrl.searchParams)
    );

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.body);
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
    const classification = await classifyHybrid(senderEmail, subject, bodyCleaned);
    const ticketNumber = await allocateNextTicketNumber();
    const tags = classification.extraTags.length ? classification.extraTags : [];

    const rows = await sql()`
      INSERT INTO tickets (
        ticket_number, sender_email, sender_name, subject, body, body_cleaned,
        category, priority, ai_summary, ai_suggested_category, classification_confidence,
        status, source, assigned_to, tags
      )
      VALUES (
        ${ticketNumber}, ${senderEmail}, ${senderName}, ${subject}, ${content}, ${bodyCleaned},
        ${classification.category}, ${classification.priority}, ${classification.summary},
        ${classification.aiSuggestedCategory}, ${classification.classificationConfidence},
        ${classification.status}, ${source}, ${operator.displayName}, ${tags}
      )
      RETURNING id, ticket_number, sender_email, sender_name, subject, body, body_cleaned,
                category, priority, ai_summary, ai_suggested_category, classification_confidence,
                status, source,
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
