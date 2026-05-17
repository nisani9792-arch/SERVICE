"use client";

import { useEffect, useRef, useState } from "react";
import { fetchTicketById } from "@/lib/firebase";
import type { Ticket } from "@/lib/types";

/** Loads full ticket body when user opens a row (list returns preview only). */
export function useTicketDetail(listTicket: Ticket | null): Ticket | null {
  const ticketId = listTicket?.id ?? null;
  const listMetaRef = useRef<string | null>(null);
  const [full, setFull] = useState<Ticket | null>(listTicket);

  useEffect(() => {
    if (!ticketId) {
      setFull(null);
      listMetaRef.current = null;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch only when id changes
  }, [ticketId]);

  useEffect(() => {
    if (!ticketId || !listTicket) return;
    const meta = `${listTicket.updatedAt}|${listTicket.status}|${listTicket.category}|${listTicket.closureNote ?? ""}`;
    if (listMetaRef.current === meta) return;
    listMetaRef.current = meta;

    setFull((prev) => {
      if (!prev || prev.id !== ticketId) return prev;
      return {
        ...listTicket,
        body: prev.body.length > (listTicket.body?.length ?? 0) ? prev.body : listTicket.body
      };
    });
  }, [listTicket, ticketId]);

  return full;
}
