import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { sendReplyForTicket } from "@/lib/ticket-reply";
import { sql } from "@/lib/neon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as { message?: string };
    const message = (body.message ?? "").trim();
    const closeAfterSend = true;

    if (message.length < 2) {
      return NextResponse.json({ error: "Reply message is required" }, { status: 400 });
    }

    const rows = await sql()`
      SELECT id, sender_email, subject, body, body_cleaned, category,
             email_message_id, ticket_number, ai_summary, message_at, created_at
      FROM tickets
      WHERE id = ${params.id} AND deleted_at IS NULL
      LIMIT 1
    `;

    const ticket = rows[0] as
      | {
          id: string;
          sender_email: string;
          subject: string;
          email_message_id: string | null;
          ticket_number: number | null;
        }
      | undefined;

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    try {
      const result = await sendReplyForTicket(ticket, message, { closeAfterSend });
      if (result.queued) {
        return NextResponse.json({
          ok: true,
          queued: true,
          queueId: result.queueId,
          message: result.message,
          closed: result.closed,
          closureNote: result.closureNote
        });
      }
      return NextResponse.json({
        ok: true,
        queued: false,
        sent: true,
        closed: result.closed,
        closureNote: result.closureNote
      });
    } catch (error) {
      const details = error instanceof Error ? error.message : "Unknown send error";
      console.error("[reply] send failed:", details);
      return NextResponse.json(
        {
          error: "Failed to send reply",
          step: "send",
          details
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown";
    console.error("[reply] unexpected:", details);
    return NextResponse.json(
      {
        error: "Failed to send reply",
        step: "unknown",
        details
      },
      { status: 500 }
    );
  }
}
