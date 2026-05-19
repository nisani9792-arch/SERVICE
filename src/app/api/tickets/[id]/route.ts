import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { getRegisteredDisplayName } from "@/lib/access-state";
import { sql } from "@/lib/neon";
import { ensureTicketListColumns } from "@/lib/ticket-schema";
import { invalidateStatsCache } from "@/lib/stats-cache";
import { rowToTicket } from "@/lib/ticket-row";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    await ensureTicketListColumns();
    const rows = await sql()`
      SELECT id, ticket_number, sender_email, sender_name, subject, body, body_cleaned,
             category, priority, ai_summary, ai_suggested_category, classification_confidence,
             status, source,
             message_at, tags, assigned_to, closure_note,
             email_message_id, email_mailbox_uid, email_ingested_at,
             created_at, updated_at
      FROM tickets
      WHERE id = ${params.id} AND deleted_at IS NULL
      LIMIT 1
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    return NextResponse.json(rowToTicket(rows[0] as Record<string, unknown>));
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch ticket", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const body = await request.json() as {
      subject?: string;
      body?: string;
      category?: string;
      priority?: number;
      aiSummary?: string;
      aiSuggestedCategory?: string | null;
      classificationConfidence?: number | null;
      status?: string;
      tags?: string[];
      assignedTo?: string;
      closureNote?: string;
    };

    let effectiveStatus = body.status ?? undefined;
    if (body.category === "handled") {
      effectiveStatus = "closed";
    }

    const operatorName = await getRegisteredDisplayName(request);
    const assignedTo =
      body.assignedTo !== undefined ? (body.assignedTo ?? null) : (operatorName ?? null);

    const tags = body.tags;
    const shouldSetTags = Array.isArray(tags);
    const touchSuggested = body.aiSuggestedCategory !== undefined;
    const touchConfidence = body.classificationConfidence !== undefined;

    const rows = shouldSetTags
      ? await sql()`
      UPDATE tickets SET
        subject      = COALESCE(${body.subject ?? null}, subject),
        body         = COALESCE(${body.body ?? null}, body),
        category     = COALESCE(${body.category ?? null}, category),
        priority     = COALESCE(${body.priority ?? null}, priority),
        ai_summary   = COALESCE(${body.aiSummary ?? null}, ai_summary),
        ai_suggested_category = CASE WHEN ${touchSuggested} THEN ${body.aiSuggestedCategory ?? null} ELSE ai_suggested_category END,
        classification_confidence = CASE WHEN ${touchConfidence} THEN ${body.classificationConfidence ?? null} ELSE classification_confidence END,
        status       = COALESCE(${effectiveStatus ?? null}, status),
        tags         = ${tags}::text[],
        assigned_to  = COALESCE(${assignedTo}, assigned_to),
        closure_note = COALESCE(${body.closureNote ?? null}, closure_note),
        updated_at   = now()
      WHERE id = ${params.id}
      RETURNING id
    `
      : await sql()`
      UPDATE tickets SET
        subject      = COALESCE(${body.subject ?? null}, subject),
        body         = COALESCE(${body.body ?? null}, body),
        category     = COALESCE(${body.category ?? null}, category),
        priority     = COALESCE(${body.priority ?? null}, priority),
        ai_summary   = COALESCE(${body.aiSummary ?? null}, ai_summary),
        ai_suggested_category = CASE WHEN ${touchSuggested} THEN ${body.aiSuggestedCategory ?? null} ELSE ai_suggested_category END,
        classification_confidence = CASE WHEN ${touchConfidence} THEN ${body.classificationConfidence ?? null} ELSE classification_confidence END,
        status       = COALESCE(${effectiveStatus ?? null}, status),
        assigned_to  = COALESCE(${assignedTo}, assigned_to),
        closure_note = COALESCE(${body.closureNote ?? null}, closure_note),
        updated_at   = now()
      WHERE id = ${params.id}
      RETURNING id
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    invalidateStatsCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update ticket", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    await sql()`
      UPDATE tickets SET deleted_at = now(), updated_at = now()
      WHERE id = ${params.id} AND deleted_at IS NULL
    `;
    invalidateStatsCache();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete ticket", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
