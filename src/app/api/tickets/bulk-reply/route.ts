import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { sendReplyForTicket } from "@/lib/ticket-reply";
import { invalidateStatsCache } from "@/lib/stats-cache";
import { sql } from "@/lib/neon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BULK = 25;

export async function POST(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      ids?: string[];
      message?: string;
    };
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean).slice(0, MAX_BULK) : [];
    const message = (body.message ?? "").trim();
    const closeAfterSend = true;

    if (ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }
    if (message.length < 2) {
      return NextResponse.json({ error: "Reply message is required" }, { status: 400 });
    }

    const rows = await sql()`
      SELECT id, sender_email, subject, body, body_cleaned, category,
             email_message_id, ticket_number, ai_summary, message_at, created_at
      FROM tickets
      WHERE id = ANY(${ids})
    `;

    const sent: string[] = [];
    const queued: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const row of rows) {
      const ticket = row as {
        id: string;
        sender_email: string;
        subject: string;
        email_message_id: string | null;
        ticket_number: number | null;
      };
      try {
        const result = await sendReplyForTicket(ticket, message, { closeAfterSend });
        if (result.queued) queued.push(ticket.id);
        else sent.push(ticket.id);
      } catch (error) {
        failed.push({
          id: ticket.id,
          error: error instanceof Error ? error.message : "Send failed"
        });
      }
    }

    invalidateStatsCache();

    return NextResponse.json({
      ok: failed.length === 0,
      sent: sent.length,
      queued: queued.length,
      failed,
      total: rows.length
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Bulk reply failed",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}
