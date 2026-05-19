import { normalizeCategory } from "@/lib/category-normalize";

/** All category values treated as spam (case-insensitive). */
export function isSpamCategory(category: string): boolean {
  const c = normalizeCategory(category).toLowerCase();
  return c === "spam";
}

export const SPAM_CATEGORY_SQL =
  "lower(trim(category)) IN ('spam', 'spam (מובנה)')";
