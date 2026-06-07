"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readListStateCache, writeListCache } from "@/lib/dashboard-cache";
import { fetchTicketPage, type TicketListQuery } from "@/lib/firebase";
import type { Ticket, TicketListResponse } from "@/lib/types";

const LIST_CACHE_FRESH_MS = 30_000;

function listUnchanged(prev: TicketListResponse, next: TicketListResponse): boolean {
  if (
    prev.total !== next.total ||
    prev.page !== next.page ||
    prev.pageSize !== next.pageSize ||
    prev.items.length !== next.items.length
  ) {
    return false;
  }
  return prev.items.every(
    (t, i) => t.id === next.items[i]?.id && t.updatedAt === next.items[i]?.updatedAt
  );
}

function isListCacheFresh(queryKey: string): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(`service_dashboard_list_v1:${queryKey}`);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { at?: number };
    return Boolean(parsed?.at && Date.now() - parsed.at < LIST_CACHE_FRESH_MS);
  } catch {
    return false;
  }
}

export function useTicketList(query: TicketListQuery) {
  const qRef = useRef(query);
  qRef.current = query;
  const abortRef = useRef<AbortController | null>(null);
  const loadGenRef = useRef(0);
  const lastFetchAtRef = useRef(0);

  const stableKey = useMemo(
    () =>
      JSON.stringify({
        page: query.page,
        pageSize: query.pageSize,
        category: query.category,
        status: query.status,
        bucket: query.bucket,
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
      query.bucket,
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
  }>(() => {
    const cached = readListStateCache(stableKey);
    return cached ?? { items: [], total: 0, page: 1, pageSize: 25 };
  });

  const [isLoading, setIsLoading] = useState(() => readListStateCache(stableKey) === null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      const gen = ++loadGenRef.current;
      const silent = options?.silent ?? false;
      const cacheFresh = silent && isListCacheFresh(stableKey);

      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      if (!silent) {
        setData((prev) => {
          if (prev.items.length === 0) setIsLoading(true);
          else setIsRefreshing(true);
          return prev;
        });
      } else if (!cacheFresh) {
        setIsRefreshing(true);
      }

      try {
        const res = await fetchTicketPage(qRef.current, controller.signal);
        lastFetchAtRef.current = Date.now();
        if (controller.signal.aborted || gen !== loadGenRef.current) return;

        setData((prev) => {
          const next = {
            items: res.items,
            total: res.total,
            page: res.page,
            pageSize: res.pageSize
          };
          if (listUnchanged(prev, next)) return prev;
          writeListCache(stableKey, res);
          return next;
        });
        setError(null);
      } catch (err) {
        if (controller.signal.aborted || gen !== loadGenRef.current) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setError("טעינת הפניות נכשלה — נסה לרענן את הדף");
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        if (gen === loadGenRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [stableKey]
  );

  useEffect(() => {
    const cached = readListStateCache(stableKey);
    if (cached) {
      setData(cached);
      setIsLoading(false);
      setError(null);
      if (isListCacheFresh(stableKey)) {
        void load({ silent: true });
        return () => {
          loadGenRef.current += 1;
          abortRef.current?.abort();
        };
      }
    } else {
      setData({ items: [], total: 0, page: 1, pageSize: query.pageSize ?? 25 });
      setIsLoading(true);
    }
    void load();
    return () => {
      loadGenRef.current += 1;
      abortRef.current?.abort();
    };
  }, [stableKey, load, query.pageSize]);

  const refresh = useCallback(() => {
    if (Date.now() - lastFetchAtRef.current < 2_000) return Promise.resolve();
    return load({ silent: true });
  }, [load]);

  const patchItem = useCallback((ticketId: string, patch: Partial<Ticket>) => {
    setData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === ticketId
          ? { ...item, ...patch, updatedAt: patch.updatedAt ?? new Date().toISOString() }
          : item
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
