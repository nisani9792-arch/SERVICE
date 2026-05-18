export type InboundSkipReason =
  | "system"
  | "own_outgoing"
  | "reply_to_us"
  | "duplicate"
  | "insert_conflict"
  | "error";

const SKIP_REASON_LABELS: Record<InboundSkipReason, string> = {
  system: "הודעת מערכת/ניוזלטר",
  own_outgoing: "מייל יוצא מהחשבון שלנו",
  reply_to_us: "תשובה למייל ששלחנו",
  duplicate: "כבר קיימת במערכת",
  insert_conflict: "כפילות במסד הנתונים",
  error: "שגיאת עיבוד"
};

export function formatSkipReasons(reasons: string[] | undefined): string {
  if (!reasons?.length) return "";
  const counts = new Map<string, number>();
  for (const reason of reasons) {
    const label = SKIP_REASON_LABELS[reason as InboundSkipReason] ?? reason;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => (count > 1 ? `${label} (${count})` : label))
    .join(" · ");
}
