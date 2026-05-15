"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchTicketPage, type TicketListQuery } from "@/lib/firebase";
import type { Ticket } from "@/lib/types";

export function useTicketList(query: TicketListQuery) {
  const qRef = useRef(query);
  qRef.current = query;
  const abortRef = useRef<AbortController | null>(null);
  const pendingSilentRef = useRef(false);

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
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (abortRef.current) {
      pendingSilentRef.current = Boolean(options?.silent);
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    if (!options?.silent) {
      setIsLoading(true);
    }

    try {
      const res = await fetchTicketPage(qRef.current, controller.signal);
      if (controller.signal.aborted) return;
      setData({
        items: res.items,
        total: res.total,
        page: res.page,
        pageSize: res.pageSize
      });
      setError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof Error && err.name === "AbortError") return;
      setError("טעינת הפניות נכשלה");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsLoading(false);

      if (pendingSilentRef.current) {
        pendingSilentRef.current = false;
        void load({ silent: true });
      }
    }
  }, []);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [stableKey, load]);

  const refresh = useCallback(() => load({ silent: true }), [load]);

  return { ...data, isLoading, error, refresh };
}
