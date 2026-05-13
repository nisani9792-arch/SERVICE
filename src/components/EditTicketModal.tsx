"use client";

import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import { updateTicket } from "@/lib/firebase";
import { ACTIVE_CATEGORIES, CATEGORY_LABELS_HE } from "@/lib/categories";
import type { LegacyTicketCategory, Ticket, TicketPriority, TicketStatus } from "@/lib/types";

interface EditTicketModalProps {
  ticket: Ticket | null;
  onClose: () => void;
}

export function EditTicketModal({ ticket, onClose }: EditTicketModalProps) {
  const [subject, setSubject] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<TicketPriority>(3);
  const [status, setStatus] = useState<TicketStatus>("open");
  const [tags, setTags] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!ticket) {
      return;
    }
    setSubject(ticket.subject);
    setSummary(ticket.aiSummary);
    setBody(ticket.body);
    setCategory(ticket.category);
    setPriority(ticket.priority);
    setStatus(ticket.status);
    setTags(ticket.tags.join(", "));
    setAssignedTo(ticket.assignedTo);
  }, [ticket]);

  if (!ticket) {
    return null;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    const tagList = tags
      .split(/[,;\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    await updateTicket(ticket.id, {
      subject,
      body,
      aiSummary: summary,
      category,
      priority,
      status,
      tags: tagList,
      assignedTo: assignedTo.trim()
    });
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="lux-card max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">עריכת פנייה</h2>
          <button type="button" onClick={onClose} className="lux-button p-2">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full rounded-xl border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
          />

          <textarea
            className="h-20 w-full resize-none rounded-xl border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="סיכום / תקציר"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            required
          />

          <textarea
            className="h-28 w-full resize-none rounded-xl border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            placeholder="גוף ההודעה"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
          />

          <label className="block text-xs text-on-surface-variant">
            קטגוריה
            <input
              className="mt-1 w-full rounded-xl border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              list="category-preset"
            />
            <datalist id="category-preset">
              {ACTIVE_CATEGORIES.map((key) => (
                <option key={key} value={key} label={CATEGORY_LABELS_HE[key as LegacyTicketCategory]} />
              ))}
            </datalist>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-on-surface-variant">
              סטטוס
              <select
                className="mt-1 w-full rounded-xl border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                value={status}
                onChange={(event) => setStatus(event.target.value as TicketStatus)}
              >
                <option value="open">פתוח</option>
                <option value="in_progress">בטיפול</option>
                <option value="closed">סגור</option>
              </select>
            </label>

            <label className="block text-xs text-on-surface-variant">
              עדיפות
              <select
                className="mt-1 w-full rounded-xl border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
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
            </label>
          </div>

          <label className="block text-xs text-on-surface-variant">
            תגיות (מופרדות בפסיק)
            <input
              className="mt-1 w-full rounded-xl border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </label>

          <label className="block text-xs text-on-surface-variant">
            הוקצה ל
            <input
              className="mt-1 w-full rounded-xl border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
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
