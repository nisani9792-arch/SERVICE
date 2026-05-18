export type BatchSseProgress = {
  jobId: string;
  processed: number;
  total: number;
  progress: number;
  chunkUpdated?: number;
  status: string;
  tokenEstimate?: number;
};

export type BatchSseComplete = {
  jobId: string;
  processed: number;
  total: number;
  status: string;
  ok: boolean;
  error?: string;
};

export type RunBatchReclassifyOptions = {
  scope: "spam" | "pending_triage" | "ids";
  limit?: number;
  ids?: string[];
  chunkSize?: number;
  onProgress?: (data: BatchSseProgress) => void;
};

/** Stream an existing batch job until complete (SSE). */
export function streamBatchJobWithSse(
  jobId: string,
  options?: { onProgress?: (data: BatchSseProgress) => void }
): Promise<BatchSseComplete> {
  return new Promise((resolve, reject) => {
    const source = new EventSource(
      `/api/tickets/reclassify/batch/${encodeURIComponent(jobId)}/stream`
    );

    const finish = (payload: BatchSseComplete) => {
      source.close();
      resolve(payload);
    };

    source.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as BatchSseProgress;
        options?.onProgress?.(data);
      } catch {
        /* ignore */
      }
    });

    source.addEventListener("complete", (event) => {
      try {
        finish(JSON.parse((event as MessageEvent).data) as BatchSseComplete);
      } catch {
        finish({ jobId, processed: 0, total: 0, status: "completed", ok: true });
      }
    });

    source.addEventListener("error", (event) => {
      source.close();
      if (event instanceof MessageEvent && event.data) {
        try {
          const data = JSON.parse(event.data) as { message?: string };
          reject(new Error(data.message || "SSE error"));
          return;
        } catch {
          /* fall through */
        }
      }
      reject(new Error("חיבור SSE נותק"));
    });

    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) return;
      source.close();
      reject(new Error("שגיאת רשת בזמן סיווג באצ'"));
    };
  });
}

/** Starts batch job then streams remaining chunks via SSE until complete. */
export async function runBatchReclassifyWithSse(
  options: RunBatchReclassifyOptions
): Promise<BatchSseComplete> {
  const startRes = await fetch("/api/tickets/reclassify/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope: options.scope === "ids" ? "spam" : options.scope,
      limit: options.limit ?? 100,
      ids: options.ids,
      chunkSize: options.chunkSize ?? 25
    })
  });

  if (!startRes.ok) {
    const err = (await startRes.json().catch(() => null)) as { details?: string; error?: string } | null;
    throw new Error(err?.details || err?.error || "Failed to start batch job");
  }

  const start = (await startRes.json()) as {
    jobId: string | null;
    processed: number;
    total: number;
    done: boolean;
    status: string;
    ok: boolean;
    error?: string;
  };

  if (!start.jobId) {
    return {
      jobId: "",
      processed: 0,
      total: 0,
      status: "completed",
      ok: true
    };
  }

  options.onProgress?.({
    jobId: start.jobId,
    processed: start.processed,
    total: start.total,
    progress: start.total > 0 ? Math.round((start.processed / start.total) * 100) : 100,
    status: start.status
  });

  if (start.done) {
    return {
      jobId: start.jobId,
      processed: start.processed,
      total: start.total,
      status: start.status,
      ok: start.ok,
      error: start.error
    };
  }

  return new Promise((resolve, reject) => {
    const source = new EventSource(
      `/api/tickets/reclassify/batch/${encodeURIComponent(start.jobId!)}/stream`
    );

    const finish = (payload: BatchSseComplete) => {
      source.close();
      resolve(payload);
    };

    source.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as BatchSseProgress;
        options.onProgress?.(data);
      } catch {
        /* ignore parse errors */
      }
    });

    source.addEventListener("complete", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as BatchSseComplete;
        finish(data);
      } catch {
        finish({
          jobId: start.jobId!,
          processed: start.processed,
          total: start.total,
          status: "completed",
          ok: true
        });
      }
    });

    source.addEventListener("error", (event) => {
      source.close();
      if (event instanceof MessageEvent && event.data) {
        try {
          const data = JSON.parse(event.data) as { message?: string };
          reject(new Error(data.message || "SSE error"));
          return;
        } catch {
          /* fall through */
        }
      }
      reject(new Error("חיבור SSE נותק"));
    });

    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) return;
      source.close();
      reject(new Error("שגיאת רשת בזמן סיווג באצ'"));
    };
  });
}
