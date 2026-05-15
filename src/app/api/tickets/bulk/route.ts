import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { getClientIp } from "@/lib/client-ip";
import { sql } from "@/lib/neon";
import { resolveOperatorName } from "@/lib/operator";
import { invalidateStatsCache } from "@/lib/stats-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BulkInsertRecord = {
  senderEmail: string;
  senderName?: string;
  subject: string;
  body: string;
  category: string;
  priority: number;
  summary: string;
  status?: string;
  messageAt?: string | null;
};

export async function POST(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as { records?: BulkInsertRecord[] };
    const records = Array.isArray(body.records) ? body.records : [];

    if (records.length === 0) {
      return NextResponse.json({ error: "records array is required" }, { status: 400 });
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

    for (const record of records) {
      const senderEmail = String(record.senderEmail ?? "").trim();
      const subject = String(record.subject ?? "").trim();
      const content = String(record.body ?? "");
      if (!senderEmail || !subject) continue;

      const priorityValue = Number(record.priority);
      const priority =
        Number.isInteger(priorityValue) && priorityValue >= 1 && priorityValue <= 5
          ? priorityValue
          : 3;

      const st = String(record.status ?? "open").toLowerCase();
      const normalizedStatus =
        st === "handled" || st === "closed"
          ? "closed"
          : st === "in_progress" || st === "in progress"
            ? "in_progress"
            : "open";

      senderEmails.push(senderEmail);
      senderNames.push(String(record.senderName ?? "").trim());
      subjects.push(subject);
      bodies.push(content);
      categories.push(String(record.category ?? "suggestions").trim() || "suggestions");
      priorities.push(priority);
      summaries.push(String(record.summary ?? "").trim());
      statuses.push(normalizedStatus);
      const ma = record.messageAt
        ? new Date(record.messageAt).toISOString()
        : null;
      messageAts.push(ma && !Number.isNaN(Date.parse(ma)) ? ma : null);
    }

    if (senderEmails.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0 });
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

    invalidateStatsCache();
    return NextResponse.json({ ok: true, inserted: senderEmails.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Bulk insert failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      ids: string[];
      category?: string;
      status?: string;
      tags?: string[];
      replaceTags?: boolean;
      assignedTo?: string;
      closureNote?: string;
    };

    const ids = body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    const category = body.category ?? null;
    let status = body.status ?? null;
    if (category === "handled") {
      status = "closed";
    }

    const ip = getClientIp(request);
    const operatorName = await resolveOperatorName(ip);
    const assignedTo =
      body.assignedTo !== undefined ? (body.assignedTo ?? null) : (operatorName ?? null);
    const closureNote = body.closureNote ?? null;
    const tagList = Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean) : null;
    const replaceTags = Boolean(body.replaceTags);

    if (tagList && tagList.length > 0) {
      if (replaceTags) {
        await sql()`
          UPDATE tickets SET
            category     = COALESCE(${category}, category),
            status       = COALESCE(${status}, status),
            assigned_to  = COALESCE(${assignedTo}, assigned_to),
            closure_note = COALESCE(${closureNote}, closure_note),
            tags         = ${tagList}::text[],
            updated_at   = now()
          WHERE id = ANY(${ids})
        `;
      } else {
        await sql()`
          UPDATE tickets SET
            category     = COALESCE(${category}, category),
            status       = COALESCE(${status}, status),
            assigned_to  = COALESCE(${assignedTo}, assigned_to),
            closure_note = COALESCE(${closureNote}, closure_note),
            tags         = COALESCE(
              (
                SELECT array_agg(DISTINCT e)
                FROM unnest(COALESCE(tags, '{}') || ${tagList}::text[]) AS e
              ),
              '{}'
            ),
            updated_at   = now()
          WHERE id = ANY(${ids})
        `;
      }
    } else {
      await sql()`
        UPDATE tickets SET
          category     = COALESCE(${category}, category),
          status       = COALESCE(${status}, status),
          assigned_to  = COALESCE(${assignedTo}, assigned_to),
          closure_note = COALESCE(${closureNote}, closure_note),
          updated_at   = now()
        WHERE id = ANY(${ids})
      `;
    }

    invalidateStatsCache();
    return NextResponse.json({ ok: true, updated: ids.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Bulk update failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as { ids: string[] };
    const ids = body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    await sql()`DELETE FROM tickets WHERE id = ANY(${ids})`;
    invalidateStatsCache();
    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Bulk delete failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
