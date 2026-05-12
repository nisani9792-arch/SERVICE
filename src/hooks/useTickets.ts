"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeToTickets } from "@/lib/firebase";
import { Ticket, TicketCategory } from "@/lib/types";

export function useTickets(
  activeCategory: TicketCategory | "all",
  queryText: string
) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToTickets((nextTickets) => {
      setTickets(nextTickets);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredTickets = useMemo(() => {
    const normalized = queryText.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const categoryMatch =
        activeCategory === "all" || ticket.category === activeCategory;
      if (!categoryMatch) {
        return false;
      }
      if (!normalized) {
        return true;
      }
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
      base[ticket.category] += 1;
    }

    return base;
  }, [tickets]);

  return { tickets, filteredTickets, counts, isLoading };
}
