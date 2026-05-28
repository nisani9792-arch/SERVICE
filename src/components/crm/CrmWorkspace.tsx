"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardHub } from "@/components/DashboardHub";
import { DashboardInboxPage, type WorkbenchStatusFilter } from "@/components/DashboardInboxPage";
import { TriageMode } from "@/components/TriageMode";
import { RapidReplyMode } from "@/components/RapidReplyMode";
import { ReviewDeskPanel } from "@/components/crm/ReviewDeskPanel";
import { TrashWorkspacePanel } from "@/components/crm/TrashWorkspacePanel";
import { parseTicketBucket } from "@/lib/ticket-buckets";
import { parseWorkspaceView } from "@/lib/crm-workspace-views";

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
