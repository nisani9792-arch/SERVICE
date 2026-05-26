"use client";

import { useEffect, useRef } from "react";
import { useDashboardStats } from "@/hooks/useDashboardStats";

const STORAGE_KEY = "jusic-crm-notify-last-sig";

/** Desktop notifications when headline KPIs change while the tab is in the background. */
export function BrowserTicketNotifications() {
  const { stats } = useDashboardStats();
  const primedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const sig = stats?._statsSig;
    if (!sig) return;

    let prev: string | null = null;
    try {
      prev = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      prev = null;
    }

    if (!primedRef.current) {
      primedRef.current = true;
      try {
        sessionStorage.setItem(STORAGE_KEY, sig);
      } catch {
        /* ignore */
      }
      return;
    }

    if (prev && prev !== sig && document.visibilityState === "hidden" && Notification.permission === "granted") {
      const active = stats.activeCount ?? stats.statusCounts.open + stats.statusCounts.in_progress;
      const urgent = stats.highPriorityOpen ?? 0;
      const body =
        urgent > 0
          ? `עדכון תור: ${active.toLocaleString("he-IL")} פתוחות · ${urgent} דחופות`
          : `עדכון תור: ${active.toLocaleString("he-IL")} פניות פתוחות/בטיפול`;
      try {
        new Notification("Jusic CRM — פעילות חדשה", {
          body,
          lang: "he",
          tag: "crm-stats"
        });
      } catch {
        /* ignore */
      }
    }

    try {
      sessionStorage.setItem(STORAGE_KEY, sig);
    } catch {
      /* ignore */
    }
  }, [stats]);

  return null;
}
