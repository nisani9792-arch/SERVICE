"use client";

import { useEffect, useState } from "react";
import { fetchTicketById } from "@/lib/firebase";
import type { Ticket } from "@/lib/types";

function mergeListIntoFull(prev: Ticket, listTicket: Ticket): Ticket {
  const keepBody =
    prev.body.length > (listTicket.body?.length ?? 0) ? prev.body : listTicket.body;
  return { ...listTicket, body: keepBody };
}

/** Loads full ticket body when user opens a row (list returns preview only). */
export function useTicketDetail(listTicket: Ticket | null): Ticket | null {
  const ticketId = listTicket?.id ?? null;
  const [full, setFull] = useState<Ticket | null>(listTicket);

  useEffect(() => {
    if (!ticketId) {
      setFull(null);
      return;
    }

    if (listTicket) {
      setFull((prev) => (prev?.id === ticketId ? prev : listTicket));
    }

    const controller = new AbortController();
    void fetchTicketById(ticketId, controller.signal)
      .then((ticket) => {
        if (!controller.signal.aborted) setFull(ticket);
      })
      .catch(() => {
        /* keep list preview */
      });

    return () => controller.abort();
    // Fetch only when the selected ticket id changes — not on list poll refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listTicket is read for initial preview on id change
  }, [ticketId]);

  useEffect(() => {
    if (!ticketId || !listTicket) return;
    setFull((prev) => {
      if (!prev || prev.id !== ticketId) return prev;
      return mergeListIntoFull(prev, listTicket);
    });
  }, [listTicket, ticketId]);

  return full;
}
