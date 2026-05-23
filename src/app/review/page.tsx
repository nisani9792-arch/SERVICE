"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CrmPageShell } from "@/components/crm/CrmPageShell";
import { TicketReviewGrid, type ReviewFilterMode } from "@/components/TicketReviewGrid";
import { MobileDock } from "@/components/MobileDock";
import { useTicketList } from "@/hooks/useTicketList";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { PENDING_TRIAGE_CATEGORY } from "@/lib/triage";

const FILTERS: Array<{ id: ReviewFilterMode; label: string }> = [
  { id: "active", label: "פעילות" },
  { id: "triage", label: "ממתין לסינון" },
  { id: "all", label: "הכל" }
];

export default function ReviewPage() {
  const [filter, setFilter] = useState<ReviewFilterMode>("active");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const { stats, refreshStats } = useDashboardStats();

  const listQuery = useMemo(() => {
    if (filter === "triage") {
      return { page, pageSize, category: PENDING_TRIAGE_CATEGORY, status: "active" as const };
    }
    if (filter === "all") {
      return { page, pageSize, status: "all" as const };
    }
    return { page, pageSize, bucket: "active" as const };
  }, [filter, page, pageSize]);

  const { items, total, isLoading, refresh } = useTicketList(listQuery);
  const [accumulated, setAccumulated] = useState<typeof items>([]);
  const hasMore = page * pageSize < total;

  useEffect(() => {
    setAccumulated((prev) => {
      if (page <= 1) return items;
      const seen = new Set(prev.map((t) => t.id));
      const merged = [...prev];
      for (const ticket of items) {
        if (!seen.has(ticket.id)) merged.push(ticket);
      }
      return merged;
    });
  }, [items, page]);

  const onMutated = useCallback(async () => {
    await Promise.all([refresh(), refreshStats()]);
  }, [refresh, refreshStats]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) setPage((p) => p + 1);
  }, [hasMore, isLoading]);

  return (
    <>
      <CrmPageShell
        title="סריקת כרטיסים"
        subtitle="מענה · ספאם · מחיקה — בלי כניסה ללוח"
        actions={
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setFilter(f.id);
                  setPage(1);
                  setAccumulated([]);
                }}
                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${
                  filter === f.id
                    ? "bg-primary text-white"
                    : "border border-outline bg-white text-on-surface-variant"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        <TicketReviewGrid
          tickets={accumulated.length > 0 || !isLoading ? accumulated : items}
          isLoading={isLoading}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onMutated={() => void onMutated()}
        />
      </CrmPageShell>

      <MobileDock
        onSyncMail={() => {}}
        onTriage={() => {
          window.location.href = "/triage";
        }}
        onAnswerBundles={() => {
          window.location.href = "/answer-bundles";
        }}
        onReview={() => {
          window.location.href = "/review";
        }}
        emailSyncing={false}
        triageCount={stats?.pendingTriageCount ?? 0}
        bundleCount={0}
        activeReview
      />
    </>
  );
}
