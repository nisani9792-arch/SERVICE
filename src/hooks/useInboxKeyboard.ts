"use client";

import { useEffect } from "react";
import type { Ticket } from "@/lib/types";

type InboxKeyboardHandlers = {
  items: Ticket[];
  activeTicketId: string | null;
  setActiveTicketId: (id: string | null) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  enabled?: boolean;
};

/** Desktop power-user shortcuts: j/k navigate, e archive, d delete. */
export function useInboxKeyboard({
  items,
  activeTicketId,
  setActiveTicketId,
  onArchive,
  onDelete,
  enabled = true
}: InboxKeyboardHandlers) {
  useEffect(() => {
    if (!enabled || items.length === 0) return;

    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const idx = activeTicketId
        ? items.findIndex((t) => t.id === activeTicketId)
        : 0;

      if (event.key === "j" || event.key === "J") {
        event.preventDefault();
        const next = items[Math.min(items.length - 1, idx + 1)];
        if (next) setActiveTicketId(next.id);
      } else if (event.key === "k" || event.key === "K") {
        event.preventDefault();
        const prev = items[Math.max(0, idx - 1)];
        if (prev) setActiveTicketId(prev.id);
      } else if (event.key === "e" || event.key === "E") {
        const id = activeTicketId ?? items[0]?.id;
        if (id) {
          event.preventDefault();
          onArchive(id);
        }
      } else if (event.key === "d" || event.key === "D") {
        const id = activeTicketId ?? items[0]?.id;
        if (id) {
          event.preventDefault();
          onDelete(id);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTicketId, enabled, items, onArchive, onDelete, setActiveTicketId]);
}
