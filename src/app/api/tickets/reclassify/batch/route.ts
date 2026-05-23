import { NextRequest, NextResponse } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import {
  countBatchTargets,
  createBatchJob,
  runBatchJobChunk
} from "@/lib/ai-batch-runner";
import { invalidateStatsCache } from "@/lib/stats-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_IDS = 200;
const MAX_ALL_SCOPE = 10_000;
const DEFAULT_CHUNK = 25;

/** Start or continue a chunked AI re-classification job (never all tickets at once). */
export async function POST(request: NextRequest) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      scope?: string;
      limit?: number;
      ids?: string[];
      chunkSize?: number;
      jobId?: string;
    };

    const scope = (body.scope ?? "spam").trim().toLowerCase();
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean).slice(0, MAX_IDS) : [];
    const chunkSize = Math.min(50, Math.max(1, Number(body.chunkSize) || DEFAULT_CHUNK));
    const jobId = body.jobId?.trim();

    if (jobId) {
      const { job, chunkResults, done } = await runBatchJobChunk(jobId, { scope, ids, chunkSize });
      if (done) invalidateStatsCache();
      return NextResponse.json({
        ok: job.status !== "failed",
        jobId: job.id,
        status: job.status,
        total: job.total,
        processed: job.processed,
        tokenEstimate: job.token_estimate,
        done,
        chunkUpdated: chunkResults.length,
        results: chunkResults,
        error: job.last_error || undefined
      });
    }

    const largeScope = scope === "all" || scope === "active_open";
    const defaultLimit = largeScope ? MAX_ALL_SCOPE : 100;
    const maxCap = largeScope ? MAX_ALL_SCOPE : MAX_IDS;
    const cap = Math.min(maxCap, Math.max(1, Number(body.limit) || defaultLimit));
    const total = Math.min(cap, await countBatchTargets(scope, ids));
    if (total === 0) {
      return NextResponse.json({
        ok: true,
        jobId: null,
        status: "completed",
        total: 0,
        processed: 0,
        done: true,
        chunkUpdated: 0,
        results: []
      });
    }

    const jobScope = ids.length > 0 ? "ids" : scope;
    const newJobId = await createBatchJob(jobScope, total, chunkSize, {
      ids,
      classifyScope: scope
    });
    const { job, chunkResults, done } = await runBatchJobChunk(newJobId, { scope, ids, chunkSize });
    if (done) invalidateStatsCache();

    return NextResponse.json({
      ok: job.status !== "failed",
      jobId: job.id,
      status: job.status,
      total: job.total,
      processed: job.processed,
      tokenEstimate: job.token_estimate,
      done,
      chunkUpdated: chunkResults.length,
      results: chunkResults,
      error: job.last_error || undefined,
      hint: done
        ? "Job complete"
        : "POST again with the same jobId to process the next chunk"
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Batch reclassify failed",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}
