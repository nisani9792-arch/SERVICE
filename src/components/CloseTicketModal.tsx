"use client";

import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";

interface CloseTicketModalProps {
  isOpen: boolean;
  count: number;
  onCancel: () => void;
  onOptimisticClose?: (closureNote: string) => void;
  onSubmit: (closureNote: string) => Promise<void>;
}

export function CloseTicketModal({
  isOpen,
  count,
  onCancel,
  onOptimisticClose,
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
    const note = closureNote.trim();
    onOptimisticClose?.(note);
    setIsSaving(true);
    try {
      await onSubmit(note);
      onCancel();
    } finally {
      setIsSaving(false);
    }
  };

  const title =
    count > 1
      ? `טיפול וסגירת ${count.toLocaleString("he-IL")} פניות`
      : "טיפול בפניה וסגירת הפנייה";

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="gen-panel w-full max-w-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
          <button type="button" onClick={onCancel} className="lux-button p-2">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs text-on-surface-variant">
            מה נעשה עם הפנייה ולמה היא נסגרת?
            <textarea
              className="gen-reply-textarea mt-1 h-32 w-full resize-none px-3 py-2 text-sm"
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
              {isSaving ? "מסנכרן…" : "סגור פנייה"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
