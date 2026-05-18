"use client";

import { useEffect, useRef } from "react";
import {
  dispatchEmailSyncEvent,
  EMAIL_SYNC_PERIODIC_MS,
  runEmailIngestClient,
  shouldRunPeriodicEmailSync
} from "@/lib/email-sync-client";

export type AutoEmailSyncResult = {
  imported: number;
  skipped: number;
  scanned: number;
};

/**
 * Immediate Gmail ingest when the operator enters the app, then every 2 hours
 * while the session stays open.
 */
export function useAutoEmailSync(enabled = true) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const run = async (force: boolean) => {
      if (!enabledRef.current || cancelled) return;
      if (!force && !shouldRunPeriodicEmailSync()) return;

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 120_000);

      try {
        const result = await runEmailIngestClient(controller.signal);
        if (!cancelled) {
          dispatchEmailSyncEvent(result);
        }
      } catch {
        if (!cancelled) {
          dispatchEmailSyncEvent({
            ok: false,
            imported: 0,
            skipped: 0,
            scanned: 0,
            error: "Email sync failed"
          });
        }
      } finally {
        window.clearTimeout(timeout);
      }
    };

    const entryTimer = window.setTimeout(() => {
      void run(true);
    }, 300);

    const periodicTimer = window.setInterval(() => {
      void run(false);
    }, EMAIL_SYNC_PERIODIC_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(entryTimer);
      window.clearInterval(periodicTimer);
    };
  }, [enabled]);
}
