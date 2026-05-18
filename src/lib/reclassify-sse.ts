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
  scope: "spam" | "pending_triage" | "ids" | "all";
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

function defaultBatchLimit(scope: RunBatchReclassifyOptions["scope"]): number {
  if (scope === "all") return 10_000;
  if (scope === "ids") return 200;
  return 500;
}

/** Polls batch chunks until complete — reliable on Render (no long-lived SSE). */
export async function runBatchReclassifyWithPolling(
  options: RunBatchReclassifyOptions
): Promise<BatchSseComplete> {
  const scope =
    options.scope === "ids" ? "spam" : options.scope === "all" ? "all" : options.scope;

  const startRes = await fetch("/api/tickets/reclassify/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      scope,
      limit: options.limit ?? defaultBatchLimit(options.scope),
      ids: options.ids,
      chunkSize: options.chunkSize ?? 25
    })
  });

  if (!startRes.ok) {
    const err = (await startRes.json().catch(() => null)) as { details?: string; error?: string } | null;
    throw new Error(err?.details || err?.error || "Failed to start batch job");
  }

  let payload = (await startRes.json()) as {
    jobId: string | null;
    processed: number;
    total: number;
    done: boolean;
    status: string;
    ok: boolean;
    error?: string;
  };

  if (!payload.jobId) {
    return {
      jobId: "",
      processed: payload.processed,
      total: payload.total,
      status: payload.status,
      ok: payload.ok,
      error: payload.error
    };
  }

  const report = () => {
    options.onProgress?.({
      jobId: payload.jobId!,
      processed: payload.processed,
      total: payload.total,
      progress:
        payload.total > 0 ? Math.round((payload.processed / payload.total) * 100) : 100,
      status: payload.status
    });
  };

  report();

  while (!payload.done && payload.jobId) {
    await new Promise((r) => setTimeout(r, 350));

    const chunkRes = await fetch("/api/tickets/reclassify/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        jobId: payload.jobId,
        scope,
        ids: options.ids,
        chunkSize: options.chunkSize ?? 25
      })
    });

    if (!chunkRes.ok) {
      const err = (await chunkRes.json().catch(() => null)) as {
        details?: string;
        error?: string;
      } | null;
      throw new Error(err?.details || err?.error || "Batch chunk failed");
    }

    payload = (await chunkRes.json()) as typeof payload;
    report();
  }

  return {
    jobId: payload.jobId ?? "",
    processed: payload.processed,
    total: payload.total,
    status: payload.status,
    ok: payload.ok !== false && payload.status !== "failed",
    error: payload.error
  };
}

/** Continue an existing batch job via polling (e.g. after AI agent). */
export async function continueBatchJobWithPolling(
  jobId: string,
  options?: { onProgress?: (data: BatchSseProgress) => void; chunkSize?: number }
): Promise<BatchSseComplete> {
  let payload = {
    jobId,
    processed: 0,
    total: 0,
    done: false,
    status: "running",
    ok: true as boolean,
    error: undefined as string | undefined
  };

  const report = () => {
    options?.onProgress?.({
      jobId: payload.jobId,
      processed: payload.processed,
      total: payload.total,
      progress: payload.total > 0 ? Math.round((payload.processed / payload.total) * 100) : 0,
      status: payload.status
    });
  };

  while (!payload.done) {
    const chunkRes = await fetch("/api/tickets/reclassify/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        jobId: payload.jobId,
        chunkSize: options?.chunkSize ?? 25
      })
    });

    if (!chunkRes.ok) {
      const err = (await chunkRes.json().catch(() => null)) as {
        details?: string;
        error?: string;
      } | null;
      throw new Error(err?.details || err?.error || "Batch chunk failed");
    }

    payload = (await chunkRes.json()) as typeof payload;
    report();
    if (payload.done) break;
    await new Promise((r) => setTimeout(r, 350));
  }

  return {
    jobId: payload.jobId,
    processed: payload.processed,
    total: payload.total,
    status: payload.status,
    ok: payload.ok !== false && payload.status !== "failed",
    error: payload.error
  };
}

/** Uses HTTP polling (works on Render); name kept for compatibility. */
export async function runBatchReclassifyWithSse(
  options: RunBatchReclassifyOptions
): Promise<BatchSseComplete> {
  return runBatchReclassifyWithPolling(options);
}
