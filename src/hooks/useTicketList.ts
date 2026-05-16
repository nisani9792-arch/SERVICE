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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (abortRef.current) {
      pendingSilentRef.current = Boolean(options?.silent);
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    if (!options?.silent) {
      setData((prev) => {
        if (prev.items.length === 0) setIsLoading(true);
        else setIsRefreshing(true);
        return prev;
      });
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
      setIsRefreshing(false);

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

  const patchItem = useCallback((ticketId: string, patch: Partial<Ticket>) => {
    setData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === ticketId ? { ...item, ...patch, updatedAt: patch.updatedAt ?? new Date().toISOString() } : item
      )
    }));
  }, []);

  const removeItem = useCallback((ticketId: string) => {
    setData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== ticketId),
      total: Math.max(0, prev.total - 1)
    }));
  }, []);

  const upsertItem = useCallback((ticket: Ticket) => {
    setData((prev) => {
      const idx = prev.items.findIndex((item) => item.id === ticket.id);
      if (idx === -1) return prev;
      const items = [...prev.items];
      items[idx] = ticket;
      return { ...prev, items };
    });
  }, []);

  return {
    ...data,
    isLoading,
    isRefreshing,
    error,
    refresh,
    patchItem,
    removeItem,
    upsertItem
  };
}
