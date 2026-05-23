import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { getRegisteredDisplayName } from "@/lib/access-state";
import { sql } from "@/lib/neon";
import { ensureTicketListColumns } from "@/lib/ticket-schema";
import { parseTicketListFilters } from "@/lib/ticket-filters";
import { invalidateStatsCache } from "@/lib/stats-cache";
import { blockSendersAndCascade } from "@/lib/spam-sender";

export const dynamic = "force-dynamic";

const MAX_BULK_BY_FILTER = 500;

export async function POST(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    await ensureTicketListColumns();

    const body = (await request.json()) as {
      filters?: Record<string, string>;
      action?: "update" | "delete";
      category?: string;
      status?: string;
      tags?: string[];
      replaceTags?: boolean;
      confirm?: boolean;
      blockSender?: boolean;
    };

    if (!body.confirm) {
      return NextResponse.json(
        { error: "Set confirm: true to apply bulk action on filtered tickets" },
        { status: 400 }
      );
    }

    const sp = new URLSearchParams(body.filters ?? {});
    const parsed = parseTicketListFilters(sp);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const f = parsed;
    const action = body.action ?? "update";

    const idRows = await sql()`
      SELECT id
      FROM tickets
      WHERE (
          (${f.trashOnly}::boolean = true AND deleted_at IS NOT NULL)
          OR (${f.trashOnly}::boolean = false AND deleted_at IS NULL)
        )
        AND (
          (${f.triageQueue}::boolean = true AND category IN ('pending_triage', 'customer_followup'))
          OR (
            ${f.triageQueue}::boolean = false
            AND (${f.categoryFilter}::text IS NULL OR category = ${f.categoryFilter})
          )
        )
        AND (
          ${f.bucketFilter}::text IS NULL
          OR ${f.bucketFilter} <> 'spam'
          OR lower(trim(category)) IN ('spam', 'spam (מובנה)')
        )
        AND (
          ${f.bucketFilter}::text IS NULL
          OR ${f.bucketFilter} <> 'handled'
          OR (
            status IN ('closed', 'handled')
            AND lower(trim(category)) NOT IN ('spam', 'spam (מובנה)')
          )
        )
        AND (
          ${f.excludeSpamFilter}::boolean = false
          OR lower(trim(category)) NOT IN ('spam', 'spam (מובנה)')
        )
        AND (
          ${f.activeStatusFilter}::boolean = false
          OR (status NOT IN ('closed', 'handled'))
        )
        AND (
          ${f.closedStatusFilter}::boolean = false
          OR (
            status IN ('closed', 'handled')
            AND ${f.outboxStatusFilter}::boolean = false
          )
        )
        AND (
          ${f.outboxStatusFilter}::boolean = false
          OR (
            status IN ('closed', 'handled')
            AND (
              COALESCE(tags, '{}'::text[]) && ${["REPLIED"]}::text[]
              OR (closure_note IS NOT NULL AND length(trim(closure_note)) > 10)
            )
          )
        )
        AND (
          ${f.exactStatusFilter}::text IS NULL
          OR status = ${f.exactStatusFilter}
        )
      LIMIT ${MAX_BULK_BY_FILTER}
    `;

    const ids = idRows.map((r) => String((r as { id: string }).id));
    if (ids.length === 0) {
      return NextResponse.json({ ok: true, updated: 0, ids: [] });
    }

    if (action === "delete") {
      await sql()`
        UPDATE tickets SET deleted_at = now(), updated_at = now()
        WHERE id = ANY(${ids}) AND deleted_at IS NULL
      `;
      invalidateStatsCache();
      return NextResponse.json({ ok: true, deleted: ids.length, ids });
    }

    const operatorName = await getRegisteredDisplayName(request);
    const category = body.category ?? null;
    let status = body.status ?? null;
    if (category === "handled" || category === "spam") {
      status = status ?? "closed";
    }

    const tagList = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).trim()).filter(Boolean)
      : null;

    if (tagList && tagList.length > 0 && body.replaceTags) {
      await sql()`
        UPDATE tickets SET
          category = COALESCE(${category}, category),
          status = COALESCE(${status}, status),
          tags = ${tagList}::text[],
          assigned_to = COALESCE(${operatorName}, assigned_to),
          updated_at = now()
        WHERE id = ANY(${ids})
      `;
    } else {
      await sql()`
        UPDATE tickets SET
          category = COALESCE(${category}, category),
          status = COALESCE(${status}, status),
          assigned_to = COALESCE(${operatorName}, assigned_to),
          updated_at = now()
        WHERE id = ANY(${ids})
      `;
    }

    if (category === "spam" && body.blockSender !== false) {
      const emails = await sql()`
        SELECT DISTINCT lower(trim(sender_email)) AS email
        FROM tickets WHERE id = ANY(${ids}) AND sender_email <> ''
      `;
      await blockSendersAndCascade(
        emails.map((r) => String((r as { email: string }).email)),
        operatorName ?? ""
      );
    }

    invalidateStatsCache();
    return NextResponse.json({ ok: true, updated: ids.length, ids });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Bulk by filter failed",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}
