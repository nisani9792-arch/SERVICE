import { NextRequest } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import {
  getBatchJob,
  parseBatchJobPayload,
  runBatchJobChunk
} from "@/lib/ai-batch-runner";
import { invalidateStatsCache } from "@/lib/stats-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CHUNK_PAUSE_MS = 400;

function sseEncode(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Server-Sent Events: runs remaining batch chunks until complete or failed. */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseEncode(event, data)));
      };

      try {
        let job = await getBatchJob(params.jobId);
        if (!job) {
          send("error", { message: "Job not found" });
          controller.close();
          return;
        }

        const payload = parseBatchJobPayload(job.payload);
        const scope = payload.classifyScope ?? job.scope;
        const ids = payload.ids ?? [];

        send("started", {
          jobId: job.id,
          total: job.total,
          processed: job.processed,
          status: job.status
        });

        if (job.status === "completed" || job.status === "failed") {
          send("complete", {
            jobId: job.id,
            processed: job.processed,
            total: job.total,
            status: job.status,
            ok: job.status === "completed",
            error: job.last_error || undefined
          });
          controller.close();
          return;
        }

        let keepRunning = true;
        while (keepRunning) {
          const { job: updated, chunkResults, done } = await runBatchJobChunk(params.jobId, {
            scope,
            ids,
            chunkSize: job.chunk_size
          });
          job = updated;

          const progress = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 100;
          send("progress", {
            jobId: job.id,
            processed: job.processed,
            total: job.total,
            progress,
            chunkUpdated: chunkResults.length,
            status: job.status,
            tokenEstimate: job.token_estimate
          });

          keepRunning =
            !done && job.status !== "completed" && job.status !== "failed";
          if (!keepRunning) break;
          await new Promise((r) => setTimeout(r, CHUNK_PAUSE_MS));
        }

        if (job.status === "completed") invalidateStatsCache();

        send("complete", {
          jobId: job.id,
          processed: job.processed,
          total: job.total,
          status: job.status,
          ok: job.status === "completed",
          error: job.last_error || undefined
        });
      } catch (error) {
        send("error", {
          message: error instanceof Error ? error.message : "Stream failed"
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
