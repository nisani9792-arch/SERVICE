import { replyFromAddress, sendCustomerReply } from "@/lib/email-send";
import { enqueueOutboundEmail } from "@/lib/outbound-email";
import { createOutboundMessageId, recordOutboundMessageId } from "@/lib/outbound-message-ids";
import { formatTicketNumber } from "@/lib/ticket-sequence";
import { sql } from "@/lib/neon";

export type TicketReplySendResult =
  | {
      ok: true;
      queued: false;
      messageId: string;
      closed: boolean;
      closureNote: string | null;
    }
  | {
      ok: true;
      queued: true;
      queueId: string;
      closed: boolean;
      closureNote: string | null;
      message: string;
    };

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

function isRetryableSendError(details: string): boolean {
  return /429|quota|rate.?limit|timeout|ECONNRESET|ETIMEDOUT|network|temporarily|503|502/i.test(
    details
  );
}

async function applyReplyTicketUpdate(
  ticketId: string,
  message: string,
  options: { closeAfterSend: boolean; outboundQueued: boolean }
): Promise<void> {
  const tagsExtra = options.outboundQueued ? ["OUTBOUND_QUEUED"] : [];
  const repliedTag = ["REPLIED", ...tagsExtra];

  if (options.closeAfterSend) {
    await sql()`
      UPDATE tickets
      SET status = 'closed',
          closure_note = ${message},
          tags = COALESCE(
            (
              SELECT array_agg(DISTINCT e)
              FROM unnest(COALESCE(tags, '{}'::text[]) || ${repliedTag}::text[]) AS e
            ),
            ${repliedTag}::text[]
          ),
          updated_at = now()
      WHERE id = ${ticketId}
    `;
    return;
  }

  await sql()`
    UPDATE tickets
    SET status = CASE WHEN status = 'closed' THEN status ELSE 'in_progress' END,
        tags = COALESCE(
          (
            SELECT array_agg(DISTINCT e)
            FROM unnest(COALESCE(tags, '{}'::text[]) || ${repliedTag}::text[]) AS e
          ),
          ${repliedTag}::text[]
        ),
        updated_at = now()
    WHERE id = ${ticketId}
  `;
}

type TicketRow = {
  id: string;
  sender_email: string;
  subject: string;
  email_message_id: string | null;
  ticket_number: number | null;
};

function replySubjectForTicket(subject: string, ticketNumber: number | null): string {
  const base = subject.trim() || "פנייה ל-Jusic";
  if (ticketNumber == null || !Number.isInteger(ticketNumber)) return base;
  const tag = formatTicketNumber(ticketNumber);
  if (new RegExp(`#?\\s*tk\\s*[-\\s]*${ticketNumber}\\b`, "i").test(base)) return base;
  return `${base} [${tag}]`;
}

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
      subject: replySubjectForTicket(String(ticket.subject ?? ""), ticket.ticket_number),
      message,
      messageId: outboundMessageId,
      inReplyTo: ticket.email_message_id,
      references: parseReferences(ticket.email_message_id)
    });
    await recordOutboundMessageId(outboundMessageId, ticket.id);
    await recordOutboundMessageId(sent.messageId, ticket.id);
    await applyReplyTicketUpdate(ticket.id, message, { closeAfterSend, outboundQueued: false });

    return {
      ok: true,
      queued: false,
      messageId: outboundMessageId,
      closed: closeAfterSend,
      closureNote: closeAfterSend ? message : null
    };
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown send error";

    if (isRetryableSendError(details)) {
      const queueId = await enqueueOutboundEmail({
        to: recipient,
        subject: String(ticket.subject ?? ""),
        message,
        idempotencyKey: `ticket-reply:${ticket.id}:${message.slice(0, 64)}`
      });
      await applyReplyTicketUpdate(ticket.id, message, { closeAfterSend, outboundQueued: true });

      const notePreview = message.length > 120 ? `${message.slice(0, 120)}…` : message;
      return {
        ok: true,
        queued: true,
        queueId,
        closed: closeAfterSend,
        closureNote: closeAfterSend ? message : null,
        message: closeAfterSend
          ? `שליחה נדחתה זמנית — המענה בתור. הפנייה נסגרה עם הערה: «${notePreview}»`
          : "שליחה נדחתה זמנית — המענה בתור."
      };
    }

    throw error;
  }
}
