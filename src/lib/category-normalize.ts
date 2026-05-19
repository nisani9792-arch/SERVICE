/** Single source of truth for category string normalization. */

export const CANONICAL_CATEGORIES = [
  "suggestions",
  "bugs",
  "premium",
  "copyright",
  "artist",
  "Customer_Support",
  "Billing",
  "spam",
  "pending_triage",
  "customer_followup"
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

const CATEGORY_ALIASES: Record<string, string> = {
  spam: "spam",
  "spam (מובנה)": "spam",
  spam_m: "spam",
  customer_support: "Customer_Support",
  "customer support": "Customer_Support",
  billing: "Billing",
  handled: "Customer_Support"
};

export function normalizeCategory(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "suggestions";

  const lower = trimmed.toLowerCase();
  if (lower in CATEGORY_ALIASES) {
    return CATEGORY_ALIASES[lower];
  }

  const underscored = trimmed.replace(/\s+/g, "_");
  if (underscored in CATEGORY_ALIASES) {
    return CATEGORY_ALIASES[underscored];
  }

  if (CANONICAL_CATEGORIES.includes(underscored as CanonicalCategory)) {
    return underscored;
  }

  if (underscored === "Spam") return "spam";
  if (trimmed === "Customer_Support") return "Customer_Support";

  return trimmed;
}
