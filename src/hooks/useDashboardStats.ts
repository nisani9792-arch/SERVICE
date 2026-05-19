"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardStatsModel } from "@/components/DashboardStats";
import { readStatsCache, writeStatsCache } from "@/lib/dashboard-cache";

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStatsModel | null>(() => readStatsCache());
  const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { "x-service-live": "true" }
      });
      if (!res.ok) return;
      const data = (await res.json()) as DashboardStatsModel;
      setStats(data);
      writeStatsCache(data);
    } catch {
      /* ignore */
    }
  }, []);

  const scheduleStatsRefresh = useCallback(() => {
    if (statsTimerRef.current) clearTimeout(statsTimerRef.current);
    statsTimerRef.current = setTimeout(() => {
      void refreshStats();
    }, 400);
  }, [refreshStats]);

  useEffect(() => {
    void refreshStats();
    return () => {
      if (statsTimerRef.current) clearTimeout(statsTimerRef.current);
    };
  }, [refreshStats]);

  return { stats, refreshStats, scheduleStatsRefresh };
}

export function useFocusMode() {
  const [focusMode, setFocusModeState] = useState(false);

  useEffect(() => {
    try {
      setFocusModeState(localStorage.getItem("crm_focus_mode") === "1");
    } catch {
      setFocusModeState(false);
    }
  }, []);

  const setFocusMode = useCallback((value: boolean) => {
    setFocusModeState(value);
    try {
      localStorage.setItem("crm_focus_mode", value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  return { focusMode, setFocusMode };
}
