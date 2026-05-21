"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTicketById, fetchTicketPage, sendTicketReply, updateTicket } from "@/lib/firebase";
import type { Ticket } from "@/lib/types";

const PAGE_SIZE = 50;

export function useRapidReplyQueue() {
  const [items, setItems] = useState<Ticket[]>([]);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [detail, setDetail] = useState<Ticket | null>(null);
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);

  const current = items[index] ?? null;

  const loadPage = useCallback(async (page: number, append: boolean) => {
    const res = await fetchTicketPage({
      page,
      pageSize: PAGE_SIZE,
      status: "active"
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
    if (index < items.length - 8) return;
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

  const skip = useCallback(() => {
    setIndex((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
  }, [items.length]);

  const markSpam = useCallback(async () => {
    if (!current || sending) return;
    setSending(true);
    setError(null);
    try {
      await updateTicket(current.id, { category: "spam", status: "closed" });
      advance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "עדכון נכשל");
    } finally {
      setSending(false);
    }
  }, [advance, current, sending]);

  const sendAndClose = useCallback(
    async (message: string) => {
      if (!current || sending || !message.trim()) return false;
      setSending(true);
      setError(null);
      try {
        await sendTicketReply(current.id, message.trim(), { closeAfterSend: true });
        advance();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "שליחה נכשלה");
        return false;
      } finally {
        setSending(false);
      }
    },
    [advance, current, sending]
  );

  const remaining = Math.max(0, total - index);

  return {
    current,
    detail,
    loading,
    error,
    sending,
    total,
    remaining,
    index,
    skip,
    markSpam,
    sendAndClose,
    refresh
  };
}
