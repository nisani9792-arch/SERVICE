"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchTicketPage, type TicketListQuery } from "@/lib/firebase";
import type { Ticket } from "@/lib/types";

const POLL_INTERVAL_MS = 12000;

export function useTicketList(query: TicketListQuery) {
  const qRef = useRef(query);
  qRef.current = query;

  const stableKey = useMemo(
    () =>
      JSON.stringify({
        page: query.page,
        pageSize: query.pageSize,
        category: query.category,
        status: query.status,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        tags: query.tags,
        q: query.q,
        email: query.email
      }),
    [
      query.page,
      query.pageSize,
      query.category,
      query.status,
      query.dateFrom,
      query.dateTo,
      query.tags,
      query.q,
      query.email
    ]
  );

  const [data, setData] = useState<{
    items: Ticket[];
    total: number;
    page: number;
    pageSize: number;
  }>({ items: [], total: 0, page: 1, pageSize: 25 });

  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchTicketPage(qRef.current);
      setData({
        items: res.items,
        total: res.total,
        page: res.page,
        pageSize: res.pageSize
      });
    } catch {
      /* keep stale */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [stableKey, load]);

  useEffect(() => {
    const t = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [load]);

  return { ...data, isLoading, refresh: load };
}
