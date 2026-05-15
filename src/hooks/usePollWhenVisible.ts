"use client";

import { useEffect } from "react";

/** Runs callback on interval only while the tab is visible. */
export function usePollWhenVisible(callback: () => void, intervalMs: number) {
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") {
        callback();
      }
    };

    tick();
    const id = window.setInterval(tick, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [callback, intervalMs]);
}
