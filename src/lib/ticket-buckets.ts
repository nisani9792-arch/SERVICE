/** Home / inbox bucket identifiers for filtered ticket lists. */
export type TicketBucket = "active" | "handled" | "spam" | "outbox" | "deleted";

export function parseTicketBucket(raw: string | null): TicketBucket | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (
    v === "active" ||
    v === "handled" ||
    v === "spam" ||
    v === "outbox" ||
    v === "deleted"
  ) {
    return v;
  }
  return null;
}

export const BUCKET_LABELS: Record<TicketBucket, string> = {
  active: "פעילות",
  handled: "טופלו",
  spam: "ספאם",
  outbox: "דואר יוצא",
  deleted: "נמחקו"
};
