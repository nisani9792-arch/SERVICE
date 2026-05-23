import { NextRequest } from "next/server";
import { requireGateAccess } from "@/lib/api-guard";
import { getRegisteredDisplayName } from "@/lib/access-state";
import { getBulkActionJob, runBulkActionChunk } from "@/lib/bulk-action-runner";
import { invalidateStatsCache } from "@/lib/stats-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CHUNK_PAUSE_MS = 300;

function sseEncode(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const denied = await requireGateAccess(request);
  if (denied) return denied;

  const operatorName = await getRegisteredDisplayName(request);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sseEncode(event, data)));
      };

      try {
        let job = await getBulkActionJob(params.jobId);
        if (!job) {
          send("error", { message: "Job not found" });
          controller.close();
          return;
        }

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
            ok: job.status === "completed"
          });
          controller.close();
          return;
        }

        let keepRunning = true;
        while (keepRunning) {
          const { job: updated, done, chunkSize } = await runBulkActionChunk(
            params.jobId,
            operatorName
          );
          job = updated;
          const progress = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 100;
          send("progress", {
            jobId: job.id,
            processed: job.processed,
            total: job.total,
            progress,
            chunkSize
          });

          if (done || job.status === "failed") {
            keepRunning = false;
            if (job.status === "completed") invalidateStatsCache();
            send("complete", {
              jobId: job.id,
              processed: job.processed,
              total: job.total,
              status: job.status,
              ok: job.status === "completed",
              error: job.last_error || undefined
            });
          } else {
            await new Promise((r) => setTimeout(r, CHUNK_PAUSE_MS));
          }
        }
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
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    }
  });
}
