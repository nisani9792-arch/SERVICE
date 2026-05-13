"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  Download,
  Filter,
  MailCheck,
  MessageSquareText,
  Plus,
  Upload
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { SearchBar } from "@/components/SearchBar";
import { Sidebar } from "@/components/Sidebar";
import { BulkActionBar } from "@/components/BulkActionBar";
import { DashboardStats, type DashboardStatsModel } from "@/components/DashboardStats";
import { TicketKanbanBoard } from "@/components/TicketKanbanBoard";
import { TicketsDataTable } from "@/components/TicketsDataTable";
import {
  deleteTicket,
  deleteTicketsBulk,
  updateTicket,
  updateTicketsBulk
} from "@/lib/firebase";
import { useTicketList } from "@/hooks/useTicketList";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ImportModal } from "@/components/ImportModal";
import { NewTicketModal } from "@/components/NewTicketModal";
import { EditTicketModal } from "@/components/EditTicketModal";
import { ExportContactsModal } from "@/components/ExportContactsModal";
import { ReplyTemplatesModal } from "@/components/ReplyTemplatesModal";
import type { Ticket, TicketStatus } from "@/lib/types";

type EmailSyncResponse = {
  imported?: number;
  skipped?: number;
  scanned?: number;
  error?: string;
  details?: string;
};

export default function DashboardPage() {
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [activeStatus, setActiveStatus] = useState<TicketStatus | "all">("all");
  const [searchValue, setSearchValue] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tagsFilter, setTagsFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(500);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");

  const [showImportModal, setShowImportModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showReplyTemplates, setShowReplyTemplates] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [headerRefreshing, setHeaderRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [emailSyncing, setEmailSyncing] = useState(false);
  const [emailSyncMessage, setEmailSyncMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const debouncedSearch = useDebouncedValue(searchValue, 320);
  const tagTokens = useMemo(
    () =>
      tagsFilter
        .split(/[,;\s]+/)
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsFilter]
  );

  const listQuery = useMemo(
    () => ({
      page,
      pageSize,
      category: activeCategory,
      status: activeStatus,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      tags: tagTokens.length ? tagTokens : undefined,
      q: debouncedSearch || undefined
    }),
    [page, pageSize, activeCategory, activeStatus, dateFrom, dateTo, tagTokens, debouncedSearch]
  );

  const { items, total, isLoading, refresh } = useTicketList(listQuery);

  const [stats, setStats] = useState<DashboardStatsModel | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as DashboardStatsModel;
      setStats(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    if (stats !== null) setLastSyncedAt(new Date());
  }, [stats]);

  const refreshAll = useCallback(async () => {
    await refreshStats();
    await refresh();
  }, [refresh, refreshStats]);

  const handleHeaderRefresh = useCallback(async () => {
    setHeaderRefreshing(true);
    try {
      await refreshAll();
      setLastSyncedAt(new Date());
    } finally {
      setHeaderRefreshing(false);
    }
  }, [refreshAll]);

  const handleEmailSync = useCallback(async () => {
    setEmailSyncing(true);
    setEmailSyncMessage(null);

    try {
      const res = await fetch("/api/email-ingest", {
        method: "POST",
        cache: "no-store"
      });
      const data = (await res.json()) as EmailSyncResponse;

      if (!res.ok) {
        throw new Error(data.details || data.error || "Email sync failed");
      }

      await refreshAll();
      setLastSyncedAt(new Date());
      setEmailSyncMessage({
        kind: "success",
        text: `סנכרון מיילים הושלם: ${data.imported ?? 0} פניות חדשות נוספו, ${data.skipped ?? 0} דולגו.`
      });
    } catch (error) {
      setEmailSyncMessage({
        kind: "error",
        text: `סנכרון המייל נכשל: ${error instanceof Error ? error.message : "שגיאה לא ידועה"}`
      });
    } finally {
      setEmailSyncing(false);
    }
  }, [refreshAll]);

  useEffect(() => {
    setPage(1);
  }, [activeCategory, activeStatus, debouncedSearch, dateFrom, dateTo, tagsFilter]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeCategory, activeStatus, debouncedSearch, dateFrom, dateTo, tagsFilter, page]);

  const onToggleSelect = useCallback((ticketId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) next.delete(ticketId);
      else next.add(ticketId);
      return next;
    });
  }, []);

  const onSelectPage = useCallback(
    (select: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (select) {
          for (const t of items) next.add(t.id);
        } else {
          for (const t of items) next.delete(t.id);
        }
        return next;
      });
    },
    [items]
  );

  const onClearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const onMarkClosed = async (ticketId: string) => {
    await updateTicket(ticketId, { category: "handled" });
    await refreshAll();
  };

  const onSetTicketStatus = async (ticketId: string, status: TicketStatus) => {
    await updateTicket(ticketId, { status });
    await refreshAll();
  };

  const onDelete = async (ticketId: string) => {
    if (!window.confirm("למחוק את הפנייה לצמיתות?")) return;
    await deleteTicket(ticketId);
    await refreshAll();
  };

  const onBulkClose = async () => {
    const ids = Array.from(selectedIds);
    await updateTicketsBulk(ids, { category: "handled" });
    setSelectedIds(new Set());
    await refreshAll();
  };

  const onBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    await deleteTicketsBulk(ids);
    setSelectedIds(new Set());
    await refreshAll();
  };

  const onBulkChangeCategory = async (category: string) => {
    const ids = Array.from(selectedIds);
    await updateTicketsBulk(ids, { category });
    setSelectedIds(new Set());
    await refreshAll();
  };

  const onBulkSetStatus = async (status: TicketStatus) => {
    const ids = Array.from(selectedIds);
    await updateTicketsBulk(ids, { status });
    setSelectedIds(new Set());
    await refreshAll();
  };

  const onBulkAddTags = async (tags: string[]) => {
    const ids = Array.from(selectedIds);
    await updateTicketsBulk(ids, { tags, replaceTags: false });
    setSelectedIds(new Set());
    await refreshAll();
  };

  const onBulkSpam = async () => {
    const ids = Array.from(selectedIds);
    await updateTicketsBulk(ids, { category: "Spam", status: "closed" });
    setSelectedIds(new Set());
    await refreshAll();
  };

  const dynamicCategories = stats?.byCategory ?? [];

  const headerActions = (
    <>
      <button type="button" onClick={onClearSelection} className="lux-button rounded-xl">
        <CheckSquare className="size-4 opacity-80" />
        נקה בחירה
      </button>
      <button
        type="button"
        onClick={() => setShowReplyTemplates(true)}
        className="lux-button rounded-xl"
      >
        <MessageSquareText className="size-4 opacity-80" />
        תבניות
      </button>
      <button type="button" onClick={() => setShowExportModal(true)} className="lux-button rounded-xl">
        <Download className="size-4 opacity-80" />
        ייצוא
      </button>
      <button type="button" onClick={() => setShowImportModal(true)} className="lux-button rounded-xl">
        <Upload className="size-4 opacity-80" />
        יבוא
      </button>
      <button
        type="button"
        onClick={handleEmailSync}
        disabled={emailSyncing}
        className="lux-button rounded-xl disabled:cursor-not-allowed disabled:opacity-60"
      >
        <MailCheck className={`size-4 opacity-80 ${emailSyncing ? "animate-pulse" : ""}`} />
        {emailSyncing ? "מסנכרן מיילים…" : "סנכרן מיילים"}
      </button>
      <button
        type="button"
        onClick={() => setShowNewModal(true)}
        className="lux-button-primary rounded-xl px-4 py-2.5 shadow-md"
      >
        <Plus className="size-4" />
        פנייה חדשה
      </button>
    </>
  );

  return (
    <main className="crm-workspace min-h-screen px-3 pb-28 pt-3 sm:px-4 md:px-6 md:pb-12 md:pt-6">
      <div className="mx-auto max-w-[1680px] space-y-6">
        <AppHeader
          actions={headerActions}
          onRefresh={handleHeaderRefresh}
          refreshing={headerRefreshing}
          lastSyncedAt={lastSyncedAt}
        />

        {emailSyncMessage ? (
          <div
            className={`lux-card rounded-2xl px-4 py-3 text-sm ${
              emailSyncMessage.kind === "success"
                ? "border-success/30 bg-success/10 text-success"
                : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            {emailSyncMessage.text}
          </div>
        ) : null}

        <DashboardStats
          stats={stats}
          activeStatus={activeStatus}
          onStatusFilter={(s) => {
            setActiveStatus(s);
            setPage(1);
          }}
        />

        <section className="grid gap-4 xl:grid-cols-[minmax(0,17.5rem),1fr] xl:gap-5">
          <Sidebar
            activeCategory={activeCategory}
            dynamicCategories={dynamicCategories}
            total={stats?.total ?? 0}
            onSelectCategory={(c) => {
              setActiveCategory(c);
              setPage(1);
            }}
          />

          <div className="min-w-0 space-y-3 md:space-y-4">
            <div className="flex flex-col gap-1 border-b border-outline/50 pb-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-on-surface md:text-xl">זרימת פניות</h2>
                <p className="text-sm text-on-surface-variant">
                  לוח קנבן לטיפול מהיר, עם תוכן הפנייה גלוי כבר בכרטיס
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
                  <Filter className="size-3.5" aria-hidden />
                  <span>
                    {total.toLocaleString("he-IL")} תוצאות · מוצגות{" "}
                    <span className="text-primary">{isLoading ? "…" : items.length}</span>
                  </span>
                </div>
                <div className="inline-flex rounded-full border border-outline bg-white p-1 text-xs shadow-sm">
                  <button
                    type="button"
                    onClick={() => setViewMode("kanban")}
                    className={`rounded-full px-3 py-1.5 font-semibold transition ${
                      viewMode === "kanban"
                        ? "bg-primary text-white"
                        : "text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    קנבן
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`rounded-full px-3 py-1.5 font-semibold transition ${
                      viewMode === "table"
                        ? "bg-primary text-white"
                        : "text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    טבלה
                  </button>
                </div>
              </div>
            </div>

            <SearchBar value={searchValue} onChange={setSearchValue} />

            <div className="lux-card grid gap-3 rounded-2xl p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4">
              <label className="block text-xs font-medium text-on-surface-variant">
                מתאריך
                <input
                  type="date"
                  className="mt-1.5 w-full rounded-xl border border-outline/80 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium text-on-surface-variant">
                עד תאריך
                <input
                  type="date"
                  className="mt-1.5 w-full rounded-xl border border-outline/80 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium text-on-surface-variant sm:col-span-2">
                תגיות (מופרדות בפסיק)
                <input
                  className="mt-1.5 w-full rounded-xl border border-outline/80 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                  placeholder="לדוגמה: vip, billing"
                  value={tagsFilter}
                  onChange={(e) => setTagsFilter(e.target.value)}
                />
              </label>
            </div>

            {viewMode === "kanban" ? (
              <TicketKanbanBoard
                tickets={items}
                isLoading={isLoading}
                onEdit={setEditingTicket}
                onSetStatus={(id, status) => {
                  void onSetTicketStatus(id, status);
                }}
                onMarkClosed={(id) => {
                  void onMarkClosed(id);
                }}
                onDelete={(id) => {
                  void onDelete(id);
                }}
              />
            ) : (
              <TicketsDataTable
                tickets={items}
                total={total}
                page={page}
                pageSize={pageSize}
                isLoading={isLoading}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
                onSelectPage={onSelectPage}
                onPageChange={setPage}
                onEdit={setEditingTicket}
                onMarkClosed={async (id) => {
                  await onMarkClosed(id);
                }}
                onDelete={async (id) => {
                  await onDelete(id);
                }}
              />
            )}

            <BulkActionBar
              count={selectedIds.size}
              onCloseTickets={onBulkClose}
              onDelete={onBulkDelete}
              onChangeCategory={onBulkChangeCategory}
              onSetStatus={onBulkSetStatus}
              onAddTags={onBulkAddTags}
              onMoveToSpam={onBulkSpam}
              onClearSelection={onClearSelection}
            />
          </div>
        </section>
      </div>

      <ImportModal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          void refreshAll();
        }}
      />
      <NewTicketModal
        isOpen={showNewModal}
        onClose={() => {
          setShowNewModal(false);
          void refreshAll();
        }}
      />
      <EditTicketModal
        ticket={editingTicket}
        onClose={() => {
          setEditingTicket(null);
          void refreshAll();
        }}
      />
      <ExportContactsModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />
      <ReplyTemplatesModal isOpen={showReplyTemplates} onClose={() => setShowReplyTemplates(false)} />
    </main>
  );
}
