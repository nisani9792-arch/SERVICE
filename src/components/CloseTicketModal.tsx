"use client";

import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";

interface CloseTicketModalProps {
  isOpen: boolean;
  count: number;
  onCancel: () => void;
  onSubmit: (closureNote: string) => Promise<void>;
}

export function CloseTicketModal({
  isOpen,
  count,
  onCancel,
  onSubmit
}: CloseTicketModalProps) {
  const [closureNote, setClosureNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setClosureNote("");
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await onSubmit(closureNote.trim());
    } finally {
      setIsSaving(false);
    }
  };

  const title =
    count > 1
      ? `טיפול וסגירת ${count.toLocaleString("he-IL")} פניות`
      : "טיפול בפניה וסגירת הפנייה";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="lux-card w-full max-w-lg rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onCancel} className="lux-button p-2">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs text-on-surface-variant">
            מה נעשה עם הפנייה ולמה היא נסגרת?
            <textarea
              className="mt-1 h-32 w-full resize-none rounded-xl border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="לדוגמה: חזרנו ללקוח, הבעיה טופלה, אין צורך בהמשך טיפול."
              value={closureNote}
              onChange={(event) => setClosureNote(event.target.value)}
              autoFocus
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCancel} className="lux-button">
              ביטול
            </button>
            <button type="submit" className="lux-button-primary" disabled={isSaving}>
              {isSaving ? "סוגר..." : "סגור פנייה"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
