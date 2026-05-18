/** All category values treated as spam (case-insensitive). */
export function isSpamCategory(category: string): boolean {
  const c = category.trim().toLowerCase();
  return c === "spam" || c === "spam (מובנה)";
}

export const SPAM_CATEGORY_SQL =
  "lower(trim(category)) IN ('spam', 'spam (מובנה)')";
