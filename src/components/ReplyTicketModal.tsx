"use client";

import { FormEvent, useEffect, useState } from "react";
import { Send, X } from "lucide-react";
import type { Ticket } from "@/lib/types";

interface ReplyTicketModalProps {
  ticket: Ticket | null;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
}

export function ReplyTicketModal({ ticket, onClose, onSubmit }: ReplyTicketModalProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!ticket) {
      setMessage("");
      return;
    }
    setMessage("");
  }, [ticket]);

  if (!ticket) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    setIsSending(true);
    try {
      await onSubmit(trimmed);
      setMessage("");
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3">
      <div className="lux-card w-full max-w-xl rounded-2xl p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">מענה ללקוח וסגירת הפנייה</h2>
            <p className="truncate text-xs text-on-surface-variant">
              אל: {ticket.senderEmail} · {ticket.subject}
            </p>
          </div>
          <button type="button" onClick={onClose} className="lux-button p-2" aria-label="סגירה">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs font-semibold text-on-surface-variant">
            נוסח המענה
            <textarea
              className="mt-1 h-44 w-full resize-none rounded-xl border border-outline bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary"
              placeholder="כתוב כאן את התשובה שתישלח ללקוח דרך Gmail. אחרי שליחה מוצלחת הפנייה תיסגר והטקסט יישמר כהערת טיפול."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              autoFocus
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-on-surface-variant">
              השליחה מתבצעת מהשרת דרך תיבת EDITOR, ולא מהדפדפן.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="lux-button">
                ביטול
              </button>
              <button type="submit" className="lux-button-primary" disabled={isSending || !message.trim()}>
                <Send className="size-4" />
                {isSending ? "שולח..." : "שליחה וסגירה"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
