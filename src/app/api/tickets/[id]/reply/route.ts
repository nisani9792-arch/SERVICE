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
    const body = (await request.json()) as { message?: string; closeAfterSend?: boolean };
    const message = (body.message ?? "").trim();
    const closeAfterSend = body.closeAfterSend !== false;

    if (message.length < 2) {
      return NextResponse.json({ error: "Reply message is required" }, { status: 400 });
    }

    const rows = await sql()`
      SELECT id, sender_email, subject, email_message_id
      FROM tickets
      WHERE id = ${params.id}
      LIMIT 1
    `;

    const ticket = rows[0] as
      | {
          id: string;
          sender_email: string;
          subject: string;
          email_message_id: string | null;
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
          closed: closeAfterSend
        });
      }
      return NextResponse.json({ ok: true, queued: false, closed: closeAfterSend });
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
