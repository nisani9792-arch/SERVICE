"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import type { DashboardStatsModel } from "@/components/DashboardStats";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { broadcastCrmStatsInvalidate, subscribeCrmStatsInvalidate } from "@/lib/crm-data-sync";
import { clearSessionStatsCache, readStatsCache, writeStatsCache } from "@/lib/dashboard-cache";

export type CrmStatsContextValue = {
  stats: DashboardStatsModel | null;
  refreshStats: () => Promise<void>;
  scheduleStatsRefresh: () => void;
};

const CrmStatsContext = createContext<CrmStatsContextValue | null>(null);

function useCrmStatsController(): CrmStatsContextValue {
  const [stats, setStats] = useState<DashboardStatsModel | null>(() => readStatsCache());
  const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSigRef = useRef<string | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { "x-service-live": "true" }
      });
      if (!res.ok) return;
      const data = (await res.json()) as DashboardStatsModel;
      const sig = typeof data._statsSig === "string" ? data._statsSig : null;
      if (sig && lastSigRef.current === sig) {
        writeStatsCache(data);
        return;
      }
      lastSigRef.current = sig;
      setStats(data);
      writeStatsCache(data);
    } catch {
      /* ignore */
    }
  }, []);

  const scheduleStatsRefresh = useCallback(() => {
    broadcastCrmStatsInvalidate();
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

  useEffect(() => {
    return subscribeCrmStatsInvalidate(() => {
      clearSessionStatsCache();
      lastSigRef.current = null;
      void refreshStats();
    });
  }, [refreshStats]);

  useLiveRefresh(
    () => {
      void refreshStats();
    },
    22_000,
    true,
    { runWhenHidden: true }
  );

  return useMemo(
    () => ({
      stats,
      refreshStats,
      scheduleStatsRefresh
    }),
    [stats, refreshStats, scheduleStatsRefresh]
  );
}

export function CrmStatsProvider({ children }: { children: ReactNode }) {
  const value = useCrmStatsController();
  return <CrmStatsContext.Provider value={value}>{children}</CrmStatsContext.Provider>;
}

export function useDashboardStats(): CrmStatsContextValue {
  const ctx = useContext(CrmStatsContext);
  if (!ctx) {
    throw new Error("useDashboardStats must be used within CrmStatsProvider");
  }
  return ctx;
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
