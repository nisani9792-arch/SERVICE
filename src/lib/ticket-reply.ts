import { replyFromAddress, sendCustomerReply } from "@/lib/email-send";
import { enqueueOutboundEmail } from "@/lib/outbound-email";
import { createOutboundMessageId, recordOutboundMessageId } from "@/lib/outbound-message-ids";
import { extractFreeReplyText } from "@/lib/reply-text-extract";
import { getReplySignature } from "@/lib/reply-signature";
import {
  buildInquiryContextBlock,
  defaultReplyEmailSubject,
  type TicketReplyContextInput
} from "@/lib/ticket-reply-context";
import { recordReplyKnowledge } from "@/lib/reply-knowledge";
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
          category = CASE
            WHEN category = 'pending_triage' THEN 'Customer_Support'
            ELSE category
          END,
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
  body?: string;
  body_cleaned?: string;
  category?: string;
  ai_summary?: string | null;
  message_at?: string | null;
  created_at?: string | null;
  email_message_id: string | null;
  ticket_number: number | null;
};

function ticketContextFromRow(ticket: TicketRow): TicketReplyContextInput {
  return {
    ticketNumber: ticket.ticket_number,
    subject: ticket.subject,
    body: ticket.body,
    bodyCleaned: ticket.body_cleaned,
    aiSummary: ticket.ai_summary,
    messageAt: ticket.message_at,
    createdAt: ticket.created_at
  };
}

async function maybeRecordReplyKnowledge(
  ticket: TicketRow,
  composedMessage: string,
  closed: boolean
): Promise<void> {
  if (!closed) return;
  try {
    await recordReplyKnowledge({
      ticketId: ticket.id,
      subject: String(ticket.subject ?? ""),
      inquiryText: String(ticket.body_cleaned || ticket.body || ""),
      replyText: composedMessage,
      category: String(ticket.category ?? "")
    });
  } catch (error) {
    console.error("[ticket-reply] knowledge record failed", error);
  }
}

function replySubjectForTicket(subject: string, ticketNumber: number | null): string {
  const followUp = defaultReplyEmailSubject();
  const original = subject.trim();
  if (ticketNumber == null || !Number.isInteger(ticketNumber)) {
    return original ? `${followUp}: ${original.slice(0, 60)}` : followUp;
  }
  const tag = formatTicketNumber(ticketNumber);
  return `${followUp} [${tag}]`;
}

function composeCustomerReply(
  message: string,
  ticket: TicketRow,
  signature: Awaited<ReturnType<typeof getReplySignature>>
): string {
  const contextBlock = buildInquiryContextBlock(ticketContextFromRow(ticket));
  const core =
    extractFreeReplyText(message.trim(), signature) || message.trim();
  const opening = signature.opening.trim();
  const closing = signature.closing.trim();
  const parts: string[] = [];
  if (opening) parts.push(opening);
  parts.push(contextBlock, core);
  let text = parts.join("\n\n");
  if (closing && !text.endsWith(closing)) {
    text = `${text}\n\n${closing}`;
  }
  return text;
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
  const signature = await getReplySignature();
  const composedMessage = composeCustomerReply(message, ticket, signature);

  try {
    const sent = await sendCustomerReply({
      to: recipient,
      subject: replySubjectForTicket(String(ticket.subject ?? ""), ticket.ticket_number),
      message: composedMessage,
      messageId: outboundMessageId,
      inReplyTo: ticket.email_message_id,
      references: parseReferences(ticket.email_message_id)
    });
    await recordOutboundMessageId(outboundMessageId, ticket.id);
    await recordOutboundMessageId(sent.messageId, ticket.id);
    await applyReplyTicketUpdate(ticket.id, composedMessage, {
      closeAfterSend,
      outboundQueued: false
    });
    await maybeRecordReplyKnowledge(ticket, composedMessage, closeAfterSend);

    return {
      ok: true,
      queued: false,
      messageId: outboundMessageId,
      closed: closeAfterSend,
      closureNote: closeAfterSend ? composedMessage : null
    };
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown send error";

    if (isRetryableSendError(details)) {
      const queueId = await enqueueOutboundEmail({
        to: recipient,
        subject: replySubjectForTicket(String(ticket.subject ?? ""), ticket.ticket_number),
        message: composedMessage,
        idempotencyKey: `ticket-reply:${ticket.id}:${composedMessage.slice(0, 64)}`
      });
      await applyReplyTicketUpdate(ticket.id, composedMessage, {
        closeAfterSend,
        outboundQueued: true
      });
      await maybeRecordReplyKnowledge(ticket, composedMessage, closeAfterSend);

      const notePreview =
        composedMessage.length > 120 ? `${composedMessage.slice(0, 120)}…` : composedMessage;
      return {
        ok: true,
        queued: true,
        queueId,
        closed: closeAfterSend,
        closureNote: closeAfterSend ? composedMessage : null,
        message: closeAfterSend
          ? `שליחה נדחתה זמנית — המענה בתור. הפנייה נסגרה עם הערה: «${notePreview}»`
          : "שליחה נדחתה זמנית — המענה בתור."
      };
    }

    throw error;
  }
}
