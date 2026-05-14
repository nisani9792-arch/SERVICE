import { NextRequest, NextResponse } from "next/server";
import { sendCustomerReply } from "@/lib/email-send";
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

    await sendCustomerReply({
      to: recipient,
      subject: String(ticket.subject ?? ""),
      message,
      inReplyTo: ticket.email_message_id,
      references: parseReferences(ticket.email_message_id)
    });

    await sql()`
      UPDATE tickets
      SET status = 'closed',
          closure_note = ${message},
          tags = COALESCE(
            (
              SELECT array_agg(DISTINCT e)
              FROM unnest(tags || ARRAY['REPLIED']::text[]) AS e
            ),
            ARRAY['REPLIED']::text[]
          ),
          updated_at = now()
      WHERE id = ${params.id}
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to send reply",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}
