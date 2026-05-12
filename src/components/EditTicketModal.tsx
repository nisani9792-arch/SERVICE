"use client";

import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import { updateTicket } from "@/lib/firebase";
import { CATEGORY_LABELS_HE } from "@/lib/categories";
import { Ticket, TicketCategory, TicketPriority } from "@/lib/types";

interface EditTicketModalProps {
  ticket: Ticket | null;
  onClose: () => void;
}

export function EditTicketModal({ ticket, onClose }: EditTicketModalProps) {
  const [subject, setSubject] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState<TicketCategory>("suggestions");
  const [priority, setPriority] = useState<TicketPriority>(3);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!ticket) {
      return;
    }
    setSubject(ticket.subject);
    setSummary(ticket.aiSummary);
    setCategory(ticket.category);
    setPriority(ticket.priority);
  }, [ticket]);

  if (!ticket) {
    return null;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    await updateTicket(ticket.id, {
      subject,
      aiSummary: summary,
      category,
      priority,
      status: category === "handled" ? "handled" : "open"
    });
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="lux-card w-full max-w-xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">עריכת פנייה</h2>
          <button onClick={onClose} className="lux-button p-2">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full rounded-lg border border-outline px-3 py-2 text-sm outline-none focus:border-primary"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
          />

          <textarea
            className="h-24 w-full resize-none rounded-lg border border-outline px-3 py-2 text-sm outline-none focus:border-primary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            required
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="rounded-lg border border-outline px-3 py-2 text-sm outline-none focus:border-primary"
              value={category}
              onChange={(event) => setCategory(event.target.value as TicketCategory)}
            >
              {(Object.keys(CATEGORY_LABELS_HE) as TicketCategory[]).map((key) => (
                <option key={key} value={key}>
                  {CATEGORY_LABELS_HE[key]}
                </option>
              ))}
            </select>

            <select
              className="rounded-lg border border-outline px-3 py-2 text-sm outline-none focus:border-primary"
              value={priority}
              onChange={(event) =>
                setPriority(Number(event.target.value) as TicketPriority)
              }
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  עדיפות {value}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="lux-button">
              ביטול
            </button>
            <button type="submit" className="lux-button-primary" disabled={isSaving}>
              {isSaving ? "שומר..." : "שמירת שינויים"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
