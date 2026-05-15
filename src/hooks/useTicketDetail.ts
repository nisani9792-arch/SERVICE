"use client";

import { useEffect, useState } from "react";
import { fetchTicketById } from "@/lib/firebase";
import type { Ticket } from "@/lib/types";

/** Loads full ticket body when user opens a row (list returns preview only). */
export function useTicketDetail(listTicket: Ticket | null): Ticket | null {
  const [full, setFull] = useState<Ticket | null>(listTicket);

  useEffect(() => {
    if (!listTicket) {
      setFull(null);
      return;
    }

    setFull(listTicket);
    const controller = new AbortController();

    void fetchTicketById(listTicket.id, controller.signal)
      .then((ticket) => {
        if (!controller.signal.aborted) setFull(ticket);
      })
      .catch(() => {
        /* keep list preview */
      });

    return () => controller.abort();
  }, [listTicket]);

  return full;
}
