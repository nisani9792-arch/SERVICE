"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fetchTicketById } from "@/lib/firebase";
import type { Ticket } from "@/lib/types";

/** Sync active ticket with ?ticket= URL param — no full page reload. */
export function useTicketUrlSync(
  activeTicketId: string | null,
  setActiveTicketId: (id: string | null) => void,
  items: Ticket[]
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hydratedRef = useRef(false);
  const skipNextPushRef = useRef(false);

  useEffect(() => {
    const urlTicket = searchParams.get("ticket");
    if (!urlTicket) {
      hydratedRef.current = true;
      return;
    }

    const inList = items.find((t) => t.id === urlTicket);
    if (inList) {
      skipNextPushRef.current = true;
      setActiveTicketId(urlTicket);
      hydratedRef.current = true;
      return;
    }

    if (!hydratedRef.current && items.length > 0) {
      hydratedRef.current = true;
      void fetchTicketById(urlTicket)
        .then(() => {
          skipNextPushRef.current = true;
          setActiveTicketId(urlTicket);
        })
        .catch(() => {
          /* ticket not found — ignore */
        });
    }
  }, [items, searchParams, setActiveTicketId]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (skipNextPushRef.current) {
      skipNextPushRef.current = false;
      return;
    }

    const sp = new URLSearchParams(searchParams.toString());
    if (activeTicketId) sp.set("ticket", activeTicketId);
    else sp.delete("ticket");

    const next = sp.toString();
    const current = searchParams.toString();
    if (next === current) return;

    router.replace(`${pathname}${next ? `?${next}` : ""}` as never, { scroll: false });
  }, [activeTicketId, pathname, router, searchParams]);
}

/** Prefetch full ticket bodies for adjacent rows (j/k navigation). */
export function useTicketPrefetch(items: Ticket[], activeTicketId: string | null) {
  const prefetchAdjacent = useCallback(() => {
    if (!activeTicketId || items.length === 0) return;
    const idx = items.findIndex((t) => t.id === activeTicketId);
    if (idx < 0) return;

    const neighbors = [items[idx - 1], items[idx + 1], items[idx + 2]].filter(Boolean) as Ticket[];
    for (const ticket of neighbors) {
      void fetchTicketById(ticket.id).catch(() => {
        /* silent prefetch */
      });
    }
  }, [activeTicketId, items]);

  useEffect(() => {
    prefetchAdjacent();
  }, [prefetchAdjacent]);

  return { prefetchAdjacent };
}
