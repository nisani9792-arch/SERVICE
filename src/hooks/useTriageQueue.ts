"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTicketById, fetchTicketPage, updateTicket } from "@/lib/firebase";
import { isSpamCategory } from "@/lib/spam-category";
import type { Ticket } from "@/lib/types";

const PAGE_SIZE = 40;

export function useTriageQueue() {
  const [items, setItems] = useState<Ticket[]>([]);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Ticket | null>(null);
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);

  const current = items[index] ?? null;

  const loadPage = useCallback(async (page: number, append: boolean) => {
    const res = await fetchTicketPage({
      page,
      pageSize: PAGE_SIZE,
      status: "active",
      queue: "triage",
      sort: "triage"
    });
    setTotal(res.total);
    setItems((prev) => (append ? [...prev, ...res.items] : res.items));
    pageRef.current = page;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadPage(1, false);
      setIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "טעינה נכשלה");
    } finally {
      setLoading(false);
    }
  }, [loadPage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!current) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const full = await fetchTicketById(current.id);
        if (!cancelled) setDetail(full);
      } catch {
        if (!cancelled) setDetail(current);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current]);

  const ensureMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    if (items.length >= total) return;
    if (index < items.length - 5) return;
    loadingMoreRef.current = true;
    try {
      await loadPage(pageRef.current + 1, true);
    } finally {
      loadingMoreRef.current = false;
    }
  }, [index, items.length, loadPage, total]);

  useEffect(() => {
    void ensureMore();
  }, [ensureMore, index]);

  const advance = useCallback(() => {
    if (!current) return;
    setItems((prev) => {
      const next = prev.filter((t) => t.id !== current.id);
      setIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
    setTotal((t) => Math.max(0, t - 1));
  }, [current]);

  const assignCategory = useCallback(
    async (category: string) => {
      if (!current || busy) return;
      setBusy(true);
      setError(null);
      try {
        const closed = isSpamCategory(category);
        await updateTicket(current.id, {
          category,
          status: closed ? "closed" : "open",
          aiSuggestedCategory: null,
          classificationConfidence: null
        });
        advance();
      } catch (err) {
        setError(err instanceof Error ? err.message : "עדכון נכשל");
      } finally {
        setBusy(false);
      }
    },
    [advance, busy, current]
  );

  const approveSuggestion = useCallback(async () => {
    if (!current?.aiSuggestedCategory) return;
    await assignCategory(current.aiSuggestedCategory);
  }, [assignCategory, current]);

  const markSpam = useCallback(async () => {
    await assignCategory("spam");
  }, [assignCategory]);

  const skip = useCallback(() => {
    setIndex((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
  }, [items.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
  }, [items.length]);

  const remaining = Math.max(0, total - index);

  return {
    current,
    detail,
    loading,
    error,
    busy,
    total,
    remaining,
    index,
    assignCategory,
    approveSuggestion,
    markSpam,
    skip,
    goPrev,
    goNext,
    refresh
  };
}
