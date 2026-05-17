import { replyFromAddress, sendCustomerReply } from "@/lib/email-send";
import { enqueueOutboundEmail } from "@/lib/outbound-email";
import { createOutboundMessageId, recordOutboundMessageId } from "@/lib/outbound-message-ids";
import { sql } from "@/lib/neon";

export type TicketReplySendResult =
  | { ok: true; queued: false; messageId: string }
  | { ok: true; queued: true; queueId: string; message: string };

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

type TicketRow = {
  id: string;
  sender_email: string;
  subject: string;
  email_message_id: string | null;
};

export async function sendReplyForTicket(
  ticket: TicketRow,
  message: string,
  options?: { closeAfterSend?: boolean }
): Promise<TicketReplySendResult> {
  const closeAfterSend = options?.closeAfterSend !== false;
  const recipient = String(ticket.sender_email ?? "").trim();
  if (!recipient || !recipient.includes("@")) {
    throw new Error("Ticket has no valid recipient email");
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
    const domainPending = /domain.*not verified|לא מאומת|403|not authorized|from address/i.test(
      details
    );
    if (domainPending) {
      const queueId = await enqueueOutboundEmail({
        to: recipient,
        subject: String(ticket.subject ?? ""),
        message,
        idempotencyKey: `ticket-reply:${ticket.id}:${message.slice(0, 64)}`
      });
      return {
        ok: true,
        queued: true,
        queueId,
        message:
          "המענה נשמר בתור ויישלח אוטומטית (אם נדרש — השלם אימות דומיין ב-Resend)."
      };
    }
    throw error;
  }

  if (closeAfterSend) {
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
      WHERE id = ${ticket.id}
    `;
  } else {
    await sql()`
      UPDATE tickets
      SET status = CASE WHEN status = 'closed' THEN status ELSE 'in_progress' END,
          tags = COALESCE(
            (
              SELECT array_agg(DISTINCT e)
              FROM unnest(COALESCE(tags, '{}'::text[]) || ARRAY['REPLIED']::text[]) AS e
            ),
            ARRAY['REPLIED']::text[]
          ),
          updated_at = now()
      WHERE id = ${ticket.id}
    `;
  }

  return { ok: true, queued: false, messageId: outboundMessageId };
}
