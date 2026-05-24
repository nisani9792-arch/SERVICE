"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTicketById } from "@/lib/firebase";
import type { TriageQueueKey } from "@/lib/ticket-bucket-view";
import type { Ticket } from "@/lib/types";

const PREFETCH_AHEAD = 3;
const BATCH_LIMIT = 4;
const DETAIL_PREFETCH = 3;

type BatchResponse = {
  items: Ticket[];
  total: number;
  bucketCounts: Record<string, number>;
};

async function fetchBatch(
  queue: TriageQueueKey,
  offset: number,
  signal?: AbortSignal
): Promise<BatchResponse> {
  const sp = new URLSearchParams({
    queue,
    offset: String(offset),
    limit: String(BATCH_LIMIT)
  });
  const res = await fetch(`/api/tickets/triage-batch?${sp}`, {
    cache: "no-store",
    credentials: "same-origin",
    signal
  });
  if (!res.ok) throw new Error("טעינת תור נכשלה");
  return res.json() as Promise<BatchResponse>;
}

export function useUnifiedTriageQueue(queue: TriageQueueKey) {
  const [items, setItems] = useState<Ticket[]>([]);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [bucketCounts, setBucketCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Ticket | null>(null);
  const detailCacheRef = useRef<Map<string, Ticket>>(new Map());
  const offsetRef = useRef(0);
  const prefetchingRef = useRef(false);

  const current = items[index] ?? null;
  const nextCards = items.slice(index + 1, index + 3);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    offsetRef.current = 0;
    try {
      const data = await fetchBatch(queue, 0);
      setItems(data.items);
      setTotal(data.total);
      setBucketCounts(data.bucketCounts);
      setIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "טעינה נכשלה");
    } finally {
      setLoading(false);
    }
  }, [queue]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!current) {
      setDetail(null);
      return;
    }
    const cached = detailCacheRef.current.get(current.id);
    if (cached) {
      setDetail(cached);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const full = await fetchTicketById(current.id);
        detailCacheRef.current.set(current.id, full);
        if (!cancelled) setDetail(full);
      } catch {
        if (!cancelled) setDetail(current);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current]);

  useEffect(() => {
    const upcoming = items.slice(index + 1, index + 1 + DETAIL_PREFETCH);
    for (const ticket of upcoming) {
      if (detailCacheRef.current.has(ticket.id)) continue;
      void fetchTicketById(ticket.id)
        .then((full) => {
          detailCacheRef.current.set(ticket.id, full);
        })
        .catch(() => {
          detailCacheRef.current.set(ticket.id, ticket);
        });
    }
  }, [index, items]);

  const prefetchMore = useCallback(async () => {
    if (prefetchingRef.current) return;
    if (items.length >= total) return;
    if (index + PREFETCH_AHEAD < items.length) return;
    prefetchingRef.current = true;
    try {
      const nextOffset = items.length;
      const data = await fetchBatch(queue, nextOffset);
      setItems((prev) => {
        const seen = new Set(prev.map((t) => t.id));
        const merged = [...prev];
        for (const t of data.items) {
          if (!seen.has(t.id)) merged.push(t);
        }
        return merged;
      });
      setTotal(data.total);
      setBucketCounts(data.bucketCounts);
    } catch {
      /* silent prefetch */
    } finally {
      prefetchingRef.current = false;
    }
  }, [index, items.length, queue, total]);

  useEffect(() => {
    void prefetchMore();
  }, [prefetchMore, index]);

  const advanceOptimistic = useCallback(() => {
    if (!current) return;
    setItems((prev) => {
      const next = prev.filter((t) => t.id !== current.id);
      setIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
    setTotal((t) => Math.max(0, t - 1));
  }, [current]);

  const restoreTicket = useCallback((ticket: Ticket, atIndex: number) => {
    setItems((prev) => {
      if (prev.some((t) => t.id === ticket.id)) return prev;
      const copy = [...prev];
      copy.splice(Math.min(atIndex, copy.length), 0, ticket);
      return copy;
    });
    setTotal((t) => t + 1);
    setIndex(atIndex);
  }, []);

  return {
    queue,
    current,
    nextCards,
    detail,
    total,
    remaining: Math.max(0, total - index),
    bucketCounts,
    loading,
    error,
    index,
    reload,
    advanceOptimistic,
    restoreTicket
  };
}
