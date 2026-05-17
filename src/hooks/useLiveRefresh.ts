"use client";

import { useEffect, useRef } from "react";

/** Single combined refresh interval — avoids duplicate timers and overlapping fetches. */
export function useLiveRefresh(callback: () => void, intervalMs: number, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    const tick = () => {
      if (document.visibilityState === "visible") {
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
  }, [intervalMs, enabled]);
}
