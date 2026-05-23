export type BulkJobProgress = {
  jobId: string;
  processed: number;
  total: number;
  progress: number;
  chunkSize?: number;
};

export type BulkJobComplete = {
  jobId: string;
  processed: number;
  total: number;
  status: string;
  ok: boolean;
  error?: string;
};

export function streamBulkJobWithSse(
  jobId: string,
  options?: { onProgress?: (data: BulkJobProgress) => void }
): Promise<BulkJobComplete> {
  return new Promise((resolve, reject) => {
    const source = new EventSource(
      `/api/tickets/bulk-job/${encodeURIComponent(jobId)}/stream`
    );

    const finish = (payload: BulkJobComplete) => {
      source.close();
      resolve(payload);
    };

    source.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as BulkJobProgress;
        options?.onProgress?.(data);
      } catch {
        /* ignore */
      }
    });

    source.addEventListener("complete", (event) => {
      try {
        finish(JSON.parse((event as MessageEvent).data) as BulkJobComplete);
      } catch {
        reject(new Error("Invalid complete event"));
      }
    });

    source.addEventListener("error", (event) => {
      source.close();
      if (event instanceof MessageEvent && event.data) {
        try {
          const data = JSON.parse(event.data) as { message?: string };
          reject(new Error(data.message ?? "Bulk job stream error"));
        } catch {
          reject(new Error("Bulk job stream error"));
        }
      } else {
        reject(new Error("Bulk job stream disconnected"));
      }
    });
  });
}

export async function startBulkJobWithSse(
  payload: {
    filters: Record<string, string>;
    action: "spam" | "delete" | "close" | "category";
    category?: string;
    blockSender?: boolean;
  },
  options?: { onProgress?: (data: BulkJobProgress) => void }
): Promise<BulkJobComplete> {
  const res = await fetch("/api/tickets/bulk-job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ ...payload, confirm: true })
  });
  const data = (await res.json()) as { jobId?: string; done?: boolean; error?: string };
  if (!res.ok || !data.jobId) {
    throw new Error(data.error ?? "Failed to start bulk job");
  }
  if (data.done) {
    return {
      jobId: data.jobId,
      processed: 0,
      total: 0,
      status: "completed",
      ok: true
    };
  }
  return streamBulkJobWithSse(data.jobId, options);
}
