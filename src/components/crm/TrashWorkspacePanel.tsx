"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import {
  deleteTrashTicketsPermanent,
  fetchTrashTickets,
  restoreTrashTickets
} from "@/lib/firebase";
import type { Ticket } from "@/lib/types";
import { CategoryBadge } from "@/components/CategoryBadge";
import { MotionPage } from "@/components/ui/Motion";
import { useDashboardStats } from "@/hooks/useDashboardStats";

export function TrashWorkspacePanel() {
  const { scheduleStatsRefresh } = useDashboardStats();
  const [items, setItems] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setItems(await fetchTrashTickets());
      setSelected(new Set());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const restore = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await restoreTrashTickets(ids);
      await refresh();
      scheduleStatsRefresh();
    } finally {
      setBusy(false);
    }
  };

  const purge = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`למחוק לצמיתות ${ids.length} פניות? לא ניתן לשחזר.`)) return;
    setBusy(true);
    try {
      await deleteTrashTicketsPermanent(ids);
      await refresh();
      scheduleStatsRefresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <MotionPage className="crm-workspace min-h-full w-full px-4 py-4 md:px-8 md:py-6">
      <div className="mx-auto max-w-4xl space-y-3">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h1 className="text-xl font-black text-slate-900">סל מחזור</h1>
            <p className="text-xs text-slate-600">פניות שנמחקו — ניתן לשחזר או למחוק לצמיתות</p>
          </div>
        </header>

        {selected.size > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="crm-btn" disabled={busy} onClick={() => void restore()}>
              <RotateCcw className="size-4" />
              שחזור ({selected.size})
            </button>
            <button
              type="button"
              className="crm-btn border-rose-200 text-rose-800"
              disabled={busy}
              onClick={() => void purge()}
            >
              <Trash2 className="size-4" />
              מחיקה לצמיתות
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <p className="text-center text-slate-600">טוען…</p>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">סל המחזור ריק</p>
        ) : (
          <ul className="space-y-2">
            {items.map((ticket) => (
              <li key={ticket.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-indigo-600"
                  checked={selected.has(ticket.id)}
                  onChange={() => toggle(ticket.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <CategoryBadge category={ticket.category} />
                    <span className="text-[11px] text-slate-500">{ticket.senderEmail}</span>
                  </div>
                  <p className="font-bold text-slate-900">{ticket.subject}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">{ticket.aiSummary || ticket.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MotionPage>
  );
}
