"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { WorkbenchStatusFilter } from "@/components/DashboardInboxPage";
import { ResolutionSkeleton } from "@/components/resolution/ResolutionSkeleton";
import { parseTicketBucket } from "@/lib/ticket-buckets";
import { parseWorkspaceView } from "@/lib/crm-workspace-views";

function CrmViewLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col gap-3 p-4">
      <ResolutionSkeleton className="h-10 w-full max-w-md" />
      <ResolutionSkeleton className="min-h-[320px] flex-1" />
    </div>
  );
}

const DashboardInboxPage = dynamic(
  () => import("@/components/DashboardInboxPage").then((m) => ({ default: m.DashboardInboxPage })),
  { loading: () => <CrmViewLoading /> }
);

const TriageMode = dynamic(
  () => import("@/components/TriageMode").then((m) => ({ default: m.TriageMode })),
  { loading: () => <CrmViewLoading /> }
);

const RapidReplyMode = dynamic(
  () => import("@/components/RapidReplyMode").then((m) => ({ default: m.RapidReplyMode })),
  { loading: () => <CrmViewLoading /> }
);

const ReviewDeskPanel = dynamic(
  () => import("@/components/crm/ReviewDeskPanel").then((m) => ({ default: m.ReviewDeskPanel })),
  { loading: () => <CrmViewLoading /> }
);

const TrashWorkspacePanel = dynamic(
  () =>
    import("@/components/crm/TrashWorkspacePanel").then((m) => ({ default: m.TrashWorkspacePanel })),
  { loading: () => <CrmViewLoading /> }
);

const DashboardHub = dynamic(
  () => import("@/components/DashboardHub").then((m) => ({ default: m.DashboardHub })),
  { loading: () => <CrmViewLoading /> }
);

export function CrmWorkspace() {
  const searchParams = useSearchParams();
  const view = useMemo(() => parseWorkspaceView(searchParams.get("view")), [searchParams]);

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

  switch (view) {
    case "workbench":
      return <DashboardInboxPage initialStatus={initialStatus} initialBucket={initialBucket} />;
    case "triage":
      return <TriageMode />;
    case "rapid":
      return <RapidReplyMode />;
    case "review":
      return <ReviewDeskPanel />;
    case "trash":
      return <TrashWorkspacePanel />;
    case "command":
      return <DashboardHub />;
    default:
      return <DashboardInboxPage initialStatus={initialStatus} initialBucket={initialBucket} />;
  }
}
