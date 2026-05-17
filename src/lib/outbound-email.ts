import { sql } from "@/lib/neon";
import { getEmailDeliveryStatus, sendCustomerReply } from "@/lib/email-send";

export type OutboundEmailInput = {
  to: string;
  subject: string;
  message: string;
  idempotencyKey?: string;
};

export type QueueProcessResult = {
  processed: number;
  sent: number;
  queued: number;
  failed: number;
  waitingDomain: number;
};

let tableReady = false;

async function ensureQueueTable(): Promise<void> {
  if (tableReady) return;
  await sql()`
    CREATE TABLE IF NOT EXISTS outbound_email_queue (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      to_address      TEXT NOT NULL,
      subject         TEXT NOT NULL DEFAULT '',
      body_text       TEXT NOT NULL DEFAULT '',
      status          TEXT NOT NULL DEFAULT 'pending',
      attempt_count   INTEGER NOT NULL DEFAULT 0,
      last_error      TEXT NOT NULL DEFAULT '',
      idempotency_key TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      sent_at         TIMESTAMPTZ,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql()`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_outbound_email_idempotency
    ON outbound_email_queue (idempotency_key)
    WHERE idempotency_key IS NOT NULL
  `;
  await sql()`
    CREATE INDEX IF NOT EXISTS idx_outbound_email_pending
    ON outbound_email_queue (status, next_attempt_at)
    WHERE status IN ('pending', 'waiting_domain')
  `;
  tableReady = true;
}

function isDomainNotReadyError(message: string): boolean {
  return /domain.*not verified|לא מאומת|403|waiting.*domain/i.test(message);
}

export async function enqueueOutboundEmail(input: OutboundEmailInput): Promise<string> {
  await ensureQueueTable();
  const to = input.to.trim();
  const subject = input.subject.trim() || "הודעה מ-SERVICE";
  const body = input.message.trim();
  if (!to || !body) throw new Error("to and message are required");

  if (input.idempotencyKey) {
    const existing = await sql()`
      SELECT id FROM outbound_email_queue
      WHERE idempotency_key = ${input.idempotencyKey}
      LIMIT 1
    `;
    if (existing[0]?.id) return String(existing[0].id);
  }

  const rows = await sql()`
    INSERT INTO outbound_email_queue (to_address, subject, body_text, status, idempotency_key)
    VALUES (${to}, ${subject}, ${body}, 'pending', ${input.idempotencyKey ?? null})
    RETURNING id
  `;
  return String(rows[0]?.id ?? "");
}

export async function processOutboundEmailQueue(limit = 25): Promise<QueueProcessResult> {
  await ensureQueueTable();
  const status = await getEmailDeliveryStatus();
  const fromDomain = status.fromAddress.split("@")[1] ?? "";
  const domainReady =
    status.effectiveProvider !== "resend" ||
    !status.resendKeyConfigured ||
    status.resendDomains?.some(
      (d) => d.name.toLowerCase() === fromDomain.toLowerCase() && d.status === "verified"
    ) ||
    fromDomain === "resend.dev";

  const rows = await sql()`
    SELECT id, to_address, subject, body_text, status, attempt_count
    FROM outbound_email_queue
    WHERE status IN ('pending', 'waiting_domain')
      AND next_attempt_at <= now()
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;

  const result: QueueProcessResult = {
    processed: rows.length,
    sent: 0,
    queued: 0,
    failed: 0,
    waitingDomain: 0
  };

  for (const row of rows) {
    const id = String(row.id);
    const to = String(row.to_address);
    const subject = String(row.subject);
    const body = String(row.body_text);
    const attempt = Number(row.attempt_count ?? 0) + 1;

    if (!domainReady) {
      await sql()`
        UPDATE outbound_email_queue
        SET status = 'waiting_domain',
            attempt_count = ${attempt},
            last_error = 'Resend domain not verified yet',
            next_attempt_at = now() + interval '15 minutes'
        WHERE id = ${id}
      `;
      result.waitingDomain += 1;
      continue;
    }

    try {
      await sendCustomerReply({ to, subject, message: body });
      await sql()`
        UPDATE outbound_email_queue
        SET status = 'sent',
            sent_at = now(),
            attempt_count = ${attempt},
            last_error = ''
        WHERE id = ${id}
      `;
      result.sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const waiting = isDomainNotReadyError(message);
      const nextStatus = waiting ? "waiting_domain" : attempt >= 5 ? "failed" : "pending";
      const backoffMinutes = Math.min(60, 5 * attempt);

      await sql()`
        UPDATE outbound_email_queue
        SET status = ${nextStatus},
            attempt_count = ${attempt},
            last_error = ${message.slice(0, 500)},
            next_attempt_at = now() + (${backoffMinutes} * interval '1 minute')
        WHERE id = ${id}
      `;

      if (waiting) result.waitingDomain += 1;
      else if (nextStatus === "failed") result.failed += 1;
      else result.queued += 1;
    }
  }

  return result;
}
