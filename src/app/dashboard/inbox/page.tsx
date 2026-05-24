"use client";

import { DashboardInboxPage, type WorkbenchStatusFilter } from "@/components/DashboardInboxPage";
import { parseTicketBucket } from "@/lib/ticket-buckets";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

function DashboardInboxInner() {
  const searchParams = useSearchParams();
  const initialBucket = useMemo(
    () => parseTicketBucket(searchParams.get("bucket")),
    [searchParams]
  );
  const initialStatus = useMemo((): WorkbenchStatusFilter | undefined => {
    if (initialBucket) return undefined;
    const status = searchParams.get("status");
    if (
      status === "outbox" ||
      status === "closed" ||
      status === "active" ||
      status === "in_progress"
    ) {
      return status;
    }
    return undefined;
  }, [searchParams, initialBucket]);

  return (
    <DashboardInboxPage initialStatus={initialStatus} initialBucket={initialBucket} />
  );
}

export default function DashboardInboxRoute() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm">טוען לוח עיבוד…</div>}>
      <DashboardInboxInner />
    </Suspense>
  );
}
