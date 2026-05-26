const CHANNEL = "jusic-crm-stats-sync-v1";

export type CrmStatsBroadcastMessage = { type: "invalidate-stats" };

export function broadcastCrmStatsInvalidate(): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.postMessage({ type: "invalidate-stats" } satisfies CrmStatsBroadcastMessage);
    bc.close();
  } catch {
    /* ignore */
  }
}

export function subscribeCrmStatsInvalidate(onMessage: () => void): () => void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return () => {};
  }
  try {
    const bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = (ev: MessageEvent<CrmStatsBroadcastMessage>) => {
      if (ev.data?.type === "invalidate-stats") onMessage();
    };
    return () => {
      bc.onmessage = null;
      bc.close();
    };
  } catch {
    return () => {};
  }
}
