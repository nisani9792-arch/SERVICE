import { sql } from "@/lib/neon";

export const DEFAULT_REPLY_OPENING = "היי. בהמשך לפנייתך לאפליקציית ג'וזיק:";
export const DEFAULT_REPLY_CLOSING = "בברכה, ישי מג'וזיק.";

export type ReplySignature = {
  opening: string;
  closing: string;
  updatedAt: string | null;
};

let schemaReady: Promise<void> | null = null;

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.map((v) => v?.trim()).find(Boolean);
}

export async function ensureReplySignatureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS reply_signature (
          id TEXT PRIMARY KEY DEFAULT 'default',
          opening TEXT NOT NULL DEFAULT '',
          closing TEXT NOT NULL DEFAULT '',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;
      await sql()`
        INSERT INTO reply_signature (id, opening, closing)
        VALUES (
          'default',
          ${process.env.EMAIL_REPLY_OPENING?.trim() || DEFAULT_REPLY_OPENING},
          ${process.env.EMAIL_REPLY_CLOSING?.trim() || DEFAULT_REPLY_CLOSING}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

function defaultsFromEnv(): ReplySignature {
  return {
    opening: firstNonEmpty(process.env.EMAIL_REPLY_OPENING) ?? DEFAULT_REPLY_OPENING,
    closing: firstNonEmpty(process.env.EMAIL_REPLY_CLOSING) ?? DEFAULT_REPLY_CLOSING,
    updatedAt: null
  };
}

export async function getReplySignature(): Promise<ReplySignature> {
  await ensureReplySignatureSchema();
  const rows = await sql()`
    SELECT opening, closing, updated_at
    FROM reply_signature
    WHERE id = 'default'
    LIMIT 1
  `;
  if (!rows.length) return defaultsFromEnv();

  const row = rows[0] as { opening: string; closing: string; updated_at: string | null };
  const opening = String(row.opening ?? "").trim();
  const closing = String(row.closing ?? "").trim();

  return {
    opening: opening || defaultsFromEnv().opening,
    closing: closing || defaultsFromEnv().closing,
    updatedAt: row.updated_at ? String(row.updated_at) : null
  };
}

export async function saveReplySignature(
  opening: string,
  closing: string
): Promise<ReplySignature> {
  await ensureReplySignatureSchema();
  const open = opening.trim() || DEFAULT_REPLY_OPENING;
  const close = closing.trim() || DEFAULT_REPLY_CLOSING;

  const rows = await sql()`
    INSERT INTO reply_signature (id, opening, closing, updated_at)
    VALUES ('default', ${open}, ${close}, now())
    ON CONFLICT (id) DO UPDATE
    SET opening = EXCLUDED.opening,
        closing = EXCLUDED.closing,
        updated_at = now()
    RETURNING opening, closing, updated_at
  `;

  const row = rows[0] as { opening: string; closing: string; updated_at: string };
  return {
    opening: String(row.opening),
    closing: String(row.closing),
    updatedAt: String(row.updated_at)
  };
}

/** Wrap customer reply body with fixed opening/closing (skips if already present). */
export function composeReplyMessage(
  body: string,
  signature: Pick<ReplySignature, "opening" | "closing">
): string {
  const core = body.trim();
  if (!core) return "";

  const opening = signature.opening.trim();
  const closing = signature.closing.trim();
  let text = core;

  if (opening && !text.startsWith(opening)) {
    text = `${opening}\n\n${text}`;
  }
  if (closing && !text.endsWith(closing)) {
    text = `${text}\n\n${closing}`;
  }
  return text;
}
