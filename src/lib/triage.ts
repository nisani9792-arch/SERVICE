/** Inbox for manual sorting — new emails land here before a real category. */
export const PENDING_TRIAGE_CATEGORY = "pending_triage";

export const TRIAGE_ASSIGN_CATEGORIES = [
  "Customer_Support",
  "suggestions",
  "bugs",
  "premium",
  "copyright",
  "artist",
  "Billing",
  "spam"
] as const;

export type TriageAssignCategory = (typeof TRIAGE_ASSIGN_CATEGORIES)[number];

export function isPendingTriage(category: string): boolean {
  return category.trim().toLowerCase() === PENDING_TRIAGE_CATEGORY;
}
