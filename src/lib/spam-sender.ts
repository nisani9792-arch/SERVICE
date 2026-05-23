import { sql } from "@/lib/neon";

let schemaReady: Promise<void> | null = null;

export async function ensureSpamSenderSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS spam_sender_blocklist (
          sender_email TEXT PRIMARY KEY,
          blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          blocked_by TEXT NOT NULL DEFAULT ''
        )
      `;
      await sql()`
        CREATE INDEX IF NOT EXISTS idx_spam_sender_blocklist_lower
        ON spam_sender_blocklist (lower(sender_email))
      `;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function isSenderBlocked(senderEmail: string): Promise<boolean> {
  const email = normalizeEmail(senderEmail);
  if (!email || !email.includes("@")) return false;
  await ensureSpamSenderSchema();
  const rows = await sql()`
    SELECT 1 FROM spam_sender_blocklist WHERE lower(sender_email) = ${email} LIMIT 1
  `;
  return rows.length > 0;
}

/** Block sender and mark all their non-deleted tickets as spam/closed. */
export async function blockSenderAndCascade(
  senderEmail: string,
  blockedBy = ""
): Promise<{ blocked: boolean; ticketsUpdated: number }> {
  const email = normalizeEmail(senderEmail);
  if (!email || !email.includes("@")) {
    return { blocked: false, ticketsUpdated: 0 };
  }

  await ensureSpamSenderSchema();

  await sql()`
    INSERT INTO spam_sender_blocklist (sender_email, blocked_by, blocked_at)
    VALUES (${email}, ${blockedBy}, now())
    ON CONFLICT (sender_email) DO UPDATE
    SET blocked_at = now(), blocked_by = EXCLUDED.blocked_by
  `;

  const updated = await sql()`
    UPDATE tickets
    SET category = 'spam',
        status = 'closed',
        updated_at = now()
    WHERE deleted_at IS NULL
      AND lower(trim(sender_email)) = ${email}
      AND lower(trim(category)) NOT IN ('spam', 'spam (מובנה)')
    RETURNING id
  `;

  const alsoClosed = await sql()`
    UPDATE tickets
    SET category = 'spam',
        status = 'closed',
        updated_at = now()
    WHERE deleted_at IS NULL
      AND lower(trim(sender_email)) = ${email}
      AND lower(trim(category)) IN ('spam', 'spam (מובנה)')
      AND status NOT IN ('closed', 'handled')
    RETURNING id
  `;

  return {
    blocked: true,
    ticketsUpdated: updated.length + alsoClosed.length
  };
}

export async function blockSendersAndCascade(
  senderEmails: string[],
  blockedBy = ""
): Promise<{ senders: number; ticketsUpdated: number }> {
  let ticketsUpdated = 0;
  const seen = new Set<string>();
  for (const raw of senderEmails) {
    const email = normalizeEmail(raw);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const result = await blockSenderAndCascade(email, blockedBy);
    ticketsUpdated += result.ticketsUpdated;
  }
  return { senders: seen.size, ticketsUpdated };
}
