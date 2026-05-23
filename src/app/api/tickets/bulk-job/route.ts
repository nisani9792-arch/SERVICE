import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { getRegisteredDisplayName } from "@/lib/access-state";
import {
  createBulkActionJob,
  getBulkActionJob,
  runBulkActionChunk,
  type BulkActionPayload,
  type BulkActionType
} from "@/lib/bulk-action-runner";
import { invalidateStatsCache } from "@/lib/stats-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      filters?: Record<string, string>;
      action?: BulkActionType;
      category?: string;
      blockSender?: boolean;
      confirm?: boolean;
      jobId?: string;
    };

    if (!body.confirm) {
      return NextResponse.json({ error: "Set confirm: true" }, { status: 400 });
    }

    const operatorName = await getRegisteredDisplayName(request);

    if (body.jobId) {
      const { job, done, chunkSize } = await runBulkActionChunk(body.jobId, operatorName);
      if (done) invalidateStatsCache();
      return NextResponse.json({
        ok: job.status !== "failed",
        jobId: job.id,
        status: job.status,
        total: job.total,
        processed: job.processed,
        done,
        chunkSize,
        error: job.last_error || undefined
      });
    }

    const payload: BulkActionPayload = {
      filters: body.filters ?? {},
      action: body.action ?? "spam",
      category: body.category,
      blockSender: body.blockSender
    };

    const { jobId, total } = await createBulkActionJob(payload);
    if (total === 0) {
      return NextResponse.json({
        ok: true,
        jobId,
        status: "completed",
        total: 0,
        processed: 0,
        done: true
      });
    }

    const { job, done, chunkSize } = await runBulkActionChunk(jobId, operatorName);
    return NextResponse.json({
      ok: job.status !== "failed",
      jobId: job.id,
      status: job.status,
      total: job.total,
      processed: job.processed,
      done,
      chunkSize,
      hint: done ? "complete" : "POST again with jobId for next chunk"
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Bulk job failed",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const job = await getBulkActionJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    total: job.total,
    processed: job.processed,
    action: job.action,
    error: job.last_error || undefined
  });
}
