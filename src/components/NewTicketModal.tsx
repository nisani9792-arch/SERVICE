"use client";

import { FormEvent, useState } from "react";
import { X } from "lucide-react";
import { createTicket } from "@/lib/firebase";
import { GeminiClassification } from "@/lib/types";

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_CLASSIFICATION: GeminiClassification = {
  category: "suggestions",
  priority: 3,
  summary: "פנייה חדשה שנוצרה ידנית וממתינה לטיפול."
};

export function NewTicketModal({ isOpen, onClose }: NewTicketModalProps) {
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) {
    return null;
  }

  const reset = () => {
    setSenderEmail("");
    setSenderName("");
    setSubject("");
    setBody("");
    setError("");
    setIsSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      const response = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderEmail,
          subject,
          content: body
        })
      });

      const classification = response.ok
        ? ((await response.json()) as GeminiClassification)
        : DEFAULT_CLASSIFICATION;

      await createTicket({
        senderEmail,
        senderName,
        subject,
        body,
        source: "manual",
        category: classification.category ?? DEFAULT_CLASSIFICATION.category,
        priority: classification.priority ?? DEFAULT_CLASSIFICATION.priority,
        aiSummary: classification.summary ?? DEFAULT_CLASSIFICATION.summary
      });

      handleClose();
    } catch {
      setError("שמירת הפנייה נכשלה. נסה שוב.");
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="lux-card w-full max-w-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">יצירת פנייה חדשה</h2>
          <button onClick={handleClose} className="lux-button p-2">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="rounded-lg border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="אימייל שולח"
              value={senderEmail}
              onChange={(event) => setSenderEmail(event.target.value)}
              type="email"
              required
            />
            <input
              className="rounded-lg border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="שם שולח (אופציונלי)"
              value={senderName}
              onChange={(event) => setSenderName(event.target.value)}
            />
          </div>

          <input
            className="w-full rounded-lg border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="נושא"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
          />

          <textarea
            className="h-32 w-full resize-none rounded-lg border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="תוכן הפנייה"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
          />

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="lux-button"
              disabled={isSaving}
            >
              ביטול
            </button>
            <button type="submit" className="lux-button-primary" disabled={isSaving}>
              {isSaving ? "שומר..." : "שמור פנייה"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
