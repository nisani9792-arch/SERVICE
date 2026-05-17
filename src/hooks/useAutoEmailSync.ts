"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "service_last_email_sync_at";
const COOLDOWN_MS = 3 * 60 * 1000;

export type AutoEmailSyncResult = {
  imported: number;
  skipped: number;
  scanned: number;
};

/**
 * Background Gmail ingest when the dashboard opens (throttled per browser).
 */
export function useAutoEmailSync(
  onComplete: (result?: AutoEmailSyncResult) => void,
  enabled = true
) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const run = async () => {
      const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
      const stale = Date.now() - last >= COOLDOWN_MS;

      if (!stale) {
        onCompleteRef.current();
        return;
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 55_000);

      try {
        const res = await fetch("/api/email-ingest", {
          method: "POST",
          headers: { "x-service-dashboard": "true" },
          cache: "no-store",
          signal: controller.signal
        });
        const data = (await res.json().catch(() => ({}))) as AutoEmailSyncResult & {
          error?: string;
        };

        if (!cancelled && res.ok) {
          localStorage.setItem(STORAGE_KEY, String(Date.now()));
          onCompleteRef.current({
            imported: data.imported ?? 0,
            skipped: data.skipped ?? 0,
            scanned: data.scanned ?? 0
          });
          return;
        }
      } catch {
        /* background sync — non-blocking */
      } finally {
        window.clearTimeout(timeout);
      }

      if (!cancelled) onCompleteRef.current();
    };

    const timer = window.setTimeout(() => {
      void run();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled]);
}
