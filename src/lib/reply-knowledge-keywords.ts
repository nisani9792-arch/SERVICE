const STOP_WORDS = new Set([
  "של",
  "על",
  "את",
  "זה",
  "לא",
  "כי",
  "גם",
  "אני",
  "הוא",
  "היא",
  "אתה",
  "the",
  "and",
  "for",
  "you",
  "your",
  "with",
  "from",
  "this",
  "that",
  "have",
  "are",
  "was",
  "jusic",
  "גוזיק",
  "ג",
  "וזיק"
]);

export function extractKeywords(text: string, max = 24): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\u0590-\u05FF@.\s-]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= max) break;
  }
  return out;
}
