"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchTicketPage } from "@/lib/firebase";
import type { Ticket } from "@/lib/types";
import { TicketReviewGrid } from "@/components/TicketReviewGrid";
import { MotionPage } from "@/components/ui/Motion";
import { useDashboardStats } from "@/hooks/useDashboardStats";

const PAGE_SIZE = 24;

export function ReviewDeskPanel() {
  const { scheduleStatsRefresh } = useDashboardStats();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadPage = useCallback(async (p: number, append: boolean) => {
    setIsLoading(true);
    try {
      const res = await fetchTicketPage({
        page: p,
        pageSize: PAGE_SIZE,
        bucket: "active"
      });
      setTotal(res.total);
      setPage(p);
      setTickets((prev) => (append ? [...prev, ...res.items] : res.items));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(1, false);
  }, [loadPage]);

  const onLoadMore = useCallback(() => {
    if (isLoading || tickets.length >= total) return;
    void loadPage(page + 1, true);
  }, [isLoading, tickets.length, total, page, loadPage]);

  const onMutated = useCallback(() => {
    scheduleStatsRefresh();
    void loadPage(1, false);
  }, [loadPage, scheduleStatsRefresh]);

  return (
    <MotionPage className="crm-workspace min-h-full w-full px-4 py-4 md:px-8 md:py-6">
      <div className="mx-auto max-w-[1600px] space-y-3">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">סקירת פניות פעילות</h1>
          <p className="text-xs text-slate-600">כרטיסים מהירים — R מענה · D ספאם · X מחק</p>
        </header>
        <TicketReviewGrid
          tickets={tickets}
          isLoading={isLoading}
          hasMore={tickets.length < total}
          onLoadMore={onLoadMore}
          onMutated={onMutated}
        />
      </div>
    </MotionPage>
  );
}
