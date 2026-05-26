"use client";

import { useEffect, useRef } from "react";

type LiveRefreshOptions = {
  /** When true, interval ticks also fire while the tab is in the background (for stats / sync). */
  runWhenHidden?: boolean;
};

/** Single combined refresh interval — avoids duplicate timers and overlapping fetches. */
export function useLiveRefresh(
  callback: () => void,
  intervalMs: number,
  enabled = true,
  options?: LiveRefreshOptions
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const runWhenHidden = options?.runWhenHidden ?? false;

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    const tick = () => {
      if (document.visibilityState === "visible" || runWhenHidden) {
        callbackRef.current();
      }
    };

    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, enabled, runWhenHidden]);
}
