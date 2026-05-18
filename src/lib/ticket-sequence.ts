import { sql } from "@/lib/neon";
import { ensureTicketUpgradeSchema } from "@/lib/ticket-schema";

const SEQ_ID = "default";
const START_NUMBER = 10000;

export function formatTicketNumber(n: number): string {
  return `#TK-${n}`;
}

export function parseTicketNumberQuery(q: string): number | null {
  const m = q.trim().match(/^#?tk-?(\d+)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Find all #TK-12345 / TK-12345 mentions in subject or body. */
export function extractTicketNumbersFromText(text: string): number[] {
  const seen = new Set<number>();
  const patterns = [/#\s*tk\s*[-\s]*(\d+)/gi, /\btk\s*[-\s]*(\d{4,})\b/gi];
  for (const pattern of patterns) {
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const n = Number(match[1]);
      if (Number.isInteger(n) && n > 0) seen.add(n);
    }
  }
  return Array.from(seen);
}

/** Allocates the next sequential ticket number (atomic). */
export async function allocateNextTicketNumber(): Promise<number> {
  await ensureTicketUpgradeSchema();

  const rows = await sql()`
    UPDATE ticket_number_seq
    SET last_number = last_number + 1
    WHERE id = ${SEQ_ID}
    RETURNING last_number
  `;

  if (rows.length > 0) {
    return Number((rows[0] as { last_number: number }).last_number);
  }

  await sql()`
    INSERT INTO ticket_number_seq (id, last_number)
    VALUES (${SEQ_ID}, ${START_NUMBER + 1})
    ON CONFLICT (id) DO NOTHING
  `;

  const retry = await sql()`
    UPDATE ticket_number_seq
    SET last_number = last_number + 1
    WHERE id = ${SEQ_ID}
    RETURNING last_number
  `;

  return Number((retry[0] as { last_number: number }).last_number);
}
