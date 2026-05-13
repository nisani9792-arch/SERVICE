"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchTickets } from "@/lib/firebase";
import { Ticket, TicketCategory } from "@/lib/types";

const POLL_INTERVAL_MS = 5000;

export function useTickets(
  activeCategory: TicketCategory | "all",
  queryText: string
) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchTickets();
      setTickets(data);
    } catch {
      /* keep stale data on error */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const filteredTickets = useMemo(() => {
    const normalized = queryText.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const categoryMatch =
        activeCategory === "all" || ticket.category === activeCategory;
      if (!categoryMatch) return false;
      if (!normalized) return true;
      const haystack =
        `${ticket.senderEmail} ${ticket.subject} ${ticket.body}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [activeCategory, tickets, queryText]);

  const counts = useMemo(() => {
    const base: Record<TicketCategory | "all", number> = {
      all: tickets.length,
      suggestions: 0,
      bugs: 0,
      premium: 0,
      copyright: 0,
      artist: 0,
      spam: 0,
      handled: 0
    };

    for (const ticket of tickets) {
      if (ticket.category in base) {
        base[ticket.category] += 1;
      } else {
        base.suggestions += 1;
      }
    }

    return base;
  }, [tickets]);

  return { tickets, filteredTickets, counts, isLoading, refresh: load };
}
