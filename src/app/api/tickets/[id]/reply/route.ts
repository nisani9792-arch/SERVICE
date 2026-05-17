import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { replyFromAddress, sendCustomerReply } from "@/lib/email-send";
import { enqueueOutboundEmail } from "@/lib/outbound-email";
import { createOutboundMessageId, recordOutboundMessageId } from "@/lib/outbound-message-ids";
import { sql } from "@/lib/neon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseReferences(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as { message?: string };
    const message = (body.message ?? "").trim();

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

    const recipient = String(ticket.sender_email ?? "").trim();
    if (!recipient || !recipient.includes("@")) {
      return NextResponse.json({ error: "Ticket has no valid recipient email" }, { status: 400 });
    }

    const outboundMessageId = createOutboundMessageId(replyFromAddress());

    try {
      const sent = await sendCustomerReply({
        to: recipient,
        subject: String(ticket.subject ?? ""),
        message,
        messageId: outboundMessageId,
        inReplyTo: ticket.email_message_id,
        references: parseReferences(ticket.email_message_id)
      });
      await recordOutboundMessageId(sent.messageId, ticket.id);
    } catch (error) {
      const details = error instanceof Error ? error.message : "Unknown send error";
      const domainPending = /domain.*not verified|לא מאומת|403/i.test(details);
      if (domainPending) {
        const queueId = await enqueueOutboundEmail({
          to: recipient,
          subject: String(ticket.subject ?? ""),
          message,
          idempotencyKey: `ticket-reply:${ticket.id}:${message.slice(0, 64)}`
        });
        return NextResponse.json({
          ok: true,
          queued: true,
          queueId,
          message:
            "הדומיין עדיין בתהליך אישור ב-Resend. התשובה נשמרה בתור ותישלח אוטומטית לאחר האימות."
        });
      }
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

    try {
      await sql()`
        UPDATE tickets
        SET status = 'closed',
            closure_note = ${message},
            tags = COALESCE(
              (
                SELECT array_agg(DISTINCT e)
                FROM unnest(COALESCE(tags, '{}'::text[]) || ARRAY['REPLIED']::text[]) AS e
              ),
              ARRAY['REPLIED']::text[]
            ),
            updated_at = now()
        WHERE id = ${params.id}
      `;
    } catch (error) {
      const details = error instanceof Error ? error.message : "Unknown database error";
      console.error("[reply] db update failed after send:", details);
      return NextResponse.json(
        {
          error: "Email may have been sent, but ticket update failed",
          step: "database",
          details
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
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
