/** Confirm spam action; blockSender defaults true (recommended). */
export function confirmSpamWithBlockSender(label = "לסמן כספאם?"): {
  ok: boolean;
  blockSender: boolean;
} {
  const ok = window.confirm(label);
  if (!ok) return { ok: false, blockSender: true };
  const onlySelection = window.confirm(
    "לסמן רק את הפניות שנבחרו, בלי לחסום את השולח?\n\nביטול = חסום שולח וסמן את כל פניותיו (מומלץ)"
  );
  return { ok: true, blockSender: !onlySelection };
}
