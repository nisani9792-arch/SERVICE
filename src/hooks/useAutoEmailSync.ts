"use client";

import { useEffect, useRef } from "react";
import {
  dispatchEmailSyncEvent,
  EMAIL_SYNC_PERIODIC_MS,
  runEmailIngestClient
} from "@/lib/email-sync-client";

/**
 * Sync inbox on every app entry (route/mount) and when returning to the tab.
 */
export function useAutoEmailSync(enabled = true, entryKey = "default") {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const run = async () => {
      if (!enabledRef.current || cancelled) return;

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 120_000);

      try {
        const result = await runEmailIngestClient(controller.signal, { force: true });
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
      void run();
    }, 100);

    let lastVisibilitySync = 0;
    const onVisible = () => {
      if (document.visibilityState !== "visible" || cancelled) return;
      const now = Date.now();
      if (now - lastVisibilitySync < EMAIL_SYNC_PERIODIC_MS) return;
      lastVisibilitySync = now;
      void run();
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(entryTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, entryKey]);
}
