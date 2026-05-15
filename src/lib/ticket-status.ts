export const CLOSED_STATUSES = ["closed", "handled"] as const;
export const ACTIVE_STATUSES = ["open", "in_progress"] as const;

export function normalizeTicketStatus(raw: string | null | undefined): "open" | "in_progress" | "closed" {
  const s = String(raw ?? "open").toLowerCase();
  if (s === "handled" || s === "closed") return "closed";
  if (s === "in_progress" || s === "in progress") return "in_progress";
  return "open";
}

export function isClosedStatus(raw: string | null | undefined): boolean {
  return normalizeTicketStatus(raw) === "closed";
}
