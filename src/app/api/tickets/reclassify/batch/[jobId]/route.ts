import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { getBatchJob } from "@/lib/ai-batch-runner";

export const dynamic = "force-dynamic";

/** Poll batch re-classification progress. */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  const job = await getBatchJob(params.jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const done = job.status === "completed" || job.status === "failed";
  const progress = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 100;

  return NextResponse.json({
    ok: job.status !== "failed",
    jobId: job.id,
    status: job.status,
    scope: job.scope,
    total: job.total,
    processed: job.processed,
    progress,
    tokenEstimate: job.token_estimate,
    done,
    results: job.results,
    error: job.last_error || undefined
  });
}
