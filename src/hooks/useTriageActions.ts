"use client";

import { useCallback, useState } from "react";
import {
  deleteTicket,
  updateTicket,
  updateTicketsBulk
} from "@/lib/firebase";
import { hapticTap } from "@/lib/haptics";
import { triggerResolveBackgroundAi } from "@/lib/resolve-ticket-client";
import type { Ticket } from "@/lib/types";

export type TriageActionKind = "spam" | "delete" | "archive";

export type TriageUndoState = {
  ticket: Ticket;
  index: number;
  kind: TriageActionKind;
};

type UseTriageActionsOptions = {
  current: Ticket | null;
  index: number;
  advanceOptimistic: () => void;
  restoreTicket: (ticket: Ticket, atIndex: number) => void;
  onOptimisticPatch?: (ticketId: string, patch: Partial<Ticket>) => void;
  onToast?: (payload: { message: string; undo?: TriageUndoState }) => void;
};

export function useTriageActions({
  current,
  index,
  advanceOptimistic,
  restoreTicket,
  onOptimisticPatch,
  onToast
}: UseTriageActionsOptions) {
  const [busy, setBusy] = useState(false);

  const runBackgroundSpamCascade = useCallback((ticketId: string) => {
    void fetch("/api/tickets/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        ids: [ticketId],
        category: "spam",
        status: "closed",
        blockSender: true
      })
    }).catch(() => {
      /* background */
    });
  }, []);

  const handleArchive = useCallback(async () => {
    if (!current || busy) return;
    hapticTap();
    const snapshot: TriageUndoState = { ticket: current, index, kind: "archive" };
    onOptimisticPatch?.(current.id, { status: "closed" });
    advanceOptimistic();
    void updateTicket(current.id, { status: "closed" }).catch(() => {
      restoreTicket(snapshot.ticket, snapshot.index);
    });
  }, [advanceOptimistic, busy, current, index, onOptimisticPatch, restoreTicket]);

  const handleResolve = useCallback(
    async (closureNote: string) => {
      if (!current || busy) return;
      hapticTap();
      const snapshot: TriageUndoState = { ticket: current, index, kind: "archive" };
      const note = closureNote.trim();
      onOptimisticPatch?.(current.id, {
        status: "closed",
        closureNote: note || current.closureNote
      });
      advanceOptimistic();
      triggerResolveBackgroundAi(current.id, note);
      void updateTicket(current.id, {
        status: "closed",
        closureNote: note || undefined
      }).catch(() => {
        restoreTicket(snapshot.ticket, snapshot.index);
      });
    },
    [advanceOptimistic, busy, current, index, onOptimisticPatch, restoreTicket]
  );

  const handleDelete = useCallback(async () => {
    if (!current || busy) return;
    hapticTap();
    const snapshot: TriageUndoState = { ticket: current, index, kind: "delete" };
    setBusy(true);
    advanceOptimistic();
    try {
      await deleteTicket(current.id);
    } catch {
      restoreTicket(snapshot.ticket, snapshot.index);
    } finally {
      setBusy(false);
    }
  }, [advanceOptimistic, busy, current, index, restoreTicket]);

  const handleSpam = useCallback(async () => {
    if (!current || busy) return;
    hapticTap([8, 40, 8]);
    const snapshot: TriageUndoState = { ticket: current, index, kind: "spam" };
    advanceOptimistic();
    onToast?.({
      message: "פנייה נחסמה · השולח נוסף לרשימה השחורה",
      undo: snapshot
    });
    void updateTicketsBulk([current.id], {
      category: "spam",
      status: "closed",
      blockSender: false
    }).catch(() => restoreTicket(snapshot.ticket, snapshot.index));
    runBackgroundSpamCascade(current.id);
  }, [
    advanceOptimistic,
    busy,
    current,
    index,
    onToast,
    restoreTicket,
    runBackgroundSpamCascade
  ]);

  const handleUndo = useCallback(
    async (undo: TriageUndoState) => {
      const { ticket, index: at, kind } = undo;
      restoreTicket(ticket, at);
      try {
        if (kind === "spam") {
          await updateTicket(ticket.id, {
            category: ticket.category,
            status: ticket.status
          });
        } else if (kind === "delete") {
          await fetch("/api/tickets/trash", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ ids: [ticket.id] })
          });
        } else {
          await updateTicket(ticket.id, { status: ticket.status });
        }
      } catch {
        /* best effort */
      }
    },
    [restoreTicket]
  );

  return {
    busy,
    handleArchive,
    handleResolve,
    handleDelete,
    handleSpam,
    handleUndo
  };
}
