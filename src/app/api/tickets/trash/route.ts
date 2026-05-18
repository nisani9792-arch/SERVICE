import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { sql } from "@/lib/neon";
import { ensureTicketListColumns } from "@/lib/ticket-schema";
import { parseTicketListFilters } from "@/lib/ticket-filters";
import { rowToTicket } from "@/lib/ticket-row";
import { invalidateStatsCache } from "@/lib/stats-cache";

export const dynamic = "force-dynamic";

const LIST_BODY_PREVIEW_CHARS = 420;

export async function GET(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    await ensureTicketListColumns();
    const url = new URL(request.url);
    url.searchParams.set("trash", "1");
    const parsed = parseTicketListFilters(url.searchParams);
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
        created_at, updated_at, deleted_at,
        count(*) OVER()::int AS total_count
      FROM tickets
      WHERE deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
      LIMIT ${f.pageSize}
      OFFSET ${f.offset}
    `;

    const total = rows.length > 0 ? Number((rows[0] as { total_count: number }).total_count ?? 0) : 0;
    const items = rows.map((r) => {
      const row = { ...(r as Record<string, unknown>) };
      delete row.total_count;
      return rowToTicket(row);
    });

    return NextResponse.json({ items, total, page: f.page, pageSize: f.pageSize });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch trash",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}

/** Restore tickets from recycle bin. Body: { ids: string[] } */
export async function POST(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    await sql()`
      UPDATE tickets
      SET deleted_at = NULL, updated_at = now()
      WHERE id = ANY(${ids}) AND deleted_at IS NOT NULL
    `;
    invalidateStatsCache();
    return NextResponse.json({ ok: true, restored: ids.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to restore tickets",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}

/** Permanent delete from recycle bin. Body: { ids: string[] } */
export async function DELETE(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    await sql()`DELETE FROM tickets WHERE id = ANY(${ids}) AND deleted_at IS NOT NULL`;
    invalidateStatsCache();
    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to permanently delete",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}
