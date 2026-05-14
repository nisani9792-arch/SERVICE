"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  MailCheck,
  MessageSquareText,
  Plus,
  Upload
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { SearchBar } from "@/components/SearchBar";
import { BulkActionBar } from "@/components/BulkActionBar";
import type { DashboardStatsModel } from "@/components/DashboardStats";
import { TicketWorkbench } from "@/components/TicketWorkbench";
import { ReplyTicketModal } from "@/components/ReplyTicketModal";
import {
  deleteTicket,
  deleteTicketsBulk,
  saveInquiryForAction,
  sendTicketReply,
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
import { CloseTicketModal } from "@/components/CloseTicketModal";
import { categoryLabel } from "@/lib/categories";
import type { Ticket, TicketStatus } from "@/lib/types";

type EmailSyncResponse = {
  imported?: number;
  skipped?: number;
  scanned?: number;
  deleted?: number;
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
  const [pageSize] = useState(80);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showReplyTemplates, setShowReplyTemplates] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [replyingTicket, setReplyingTicket] = useState<Ticket | null>(null);
  const [closingTicketIds, setClosingTicketIds] = useState<string[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

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
  const activeTicket = useMemo(
    () => items.find((ticket) => ticket.id === activeTicketId) ?? items[0] ?? null,
    [activeTicketId, items]
  );
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
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch("/api/email-ingest", {
        method: "POST",
        cache: "no-store",
        signal: controller.signal
      });
      const data = (await res.json()) as EmailSyncResponse;

      if (!res.ok) {
        throw new Error(data.details || data.error || "Email sync failed");
      }

      await refreshAll();
      setLastSyncedAt(new Date());
      setEmailSyncMessage({
        kind: "success",
        text: `סנכרון מיילים הושלם: ${data.imported ?? 0} פניות חדשות נוספו, ${data.skipped ?? 0} דולגו, ${data.deleted ?? 0} נמחקו מהאינבוקס.`
      });
    } catch (error) {
      setEmailSyncMessage({
        kind: "error",
        text: `סנכרון המייל נכשל: ${
          error instanceof Error && error.name === "AbortError"
            ? "הפעולה נתקעה מעל דקה. בדוק את הגדרות Gmail/Render ונסה שוב."
            : error instanceof Error
              ? error.message
              : "שגיאה לא ידועה"
        }`
      });
    } finally {
      window.clearTimeout(timeout);
      setEmailSyncing(false);
    }
  }, [refreshAll]);

  useEffect(() => {
    setPage(1);
  }, [activeCategory, activeStatus, debouncedSearch, dateFrom, dateTo, tagsFilter]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeCategory, activeStatus, debouncedSearch, dateFrom, dateTo, tagsFilter, page]);

  useEffect(() => {
    if (items.length === 0) {
      setActiveTicketId(null);
      return;
    }
    if (!activeTicketId || !items.some((ticket) => ticket.id === activeTicketId)) {
      setActiveTicketId(items[0].id);
    }
  }, [activeTicketId, items]);

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

  const onMarkClosed = (ticketId: string) => {
    setClosingTicketIds([ticketId]);
  };

  const onSubmitCloseTickets = async (closureNote: string) => {
    const ids = closingTicketIds ?? [];
    if (ids.length === 0) return;

    if (ids.length === 1) {
      await updateTicket(ids[0], { category: "handled", closureNote });
    } else {
      await updateTicketsBulk(ids, { category: "handled", closureNote });
      setSelectedIds(new Set());
    }

    setClosingTicketIds(null);
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
    if (ids.length === 0) return;
    setClosingTicketIds(ids);
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

  const onChangeSingleCategory = async (ticketId: string, category: string) => {
    await updateTicket(ticketId, { category });
    await refreshAll();
  };

  const onSendReply = async (message: string) => {
    if (!replyingTicket) return;
    await sendTicketReply(replyingTicket.id, message);
    await refreshAll();
  };

  const onSaveInquiry = async (ticket: Ticket) => {
    await saveInquiryForAction(ticket);
    window.alert("הפנייה נשמרה לרשימת דברים לביצוע ותובנות.");
  };

  const dynamicCategories = stats?.byCategory ?? [];
  const statusFilters: { id: TicketStatus | "all"; label: string; count: number }[] = [
    { id: "all", label: "הכל", count: stats?.total ?? 0 },
    { id: "open", label: "פתוחות", count: stats?.statusCounts.open ?? 0 },
    { id: "in_progress", label: "בטיפול", count: stats?.statusCounts.in_progress ?? 0 },
    { id: "closed", label: "סגורות", count: stats?.statusCounts.closed ?? 0 }
  ];

  const headerActions = (
    <>
      <details className="relative">
        <summary className="lux-button cursor-pointer list-none rounded-xl px-3 py-1.5 text-xs">
          כלים
        </summary>
        <div className="absolute left-0 z-50 mt-2 w-36 rounded-xl border border-outline bg-white p-1 shadow-card">
          <button
            type="button"
            onClick={() => setShowReplyTemplates(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-right text-xs hover:bg-surface-container"
          >
            <MessageSquareText className="size-3.5 opacity-80" />
            תבניות
          </button>
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-right text-xs hover:bg-surface-container"
          >
            <Download className="size-3.5 opacity-80" />
            ייצוא
          </button>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-right text-xs hover:bg-surface-container"
          >
            <Upload className="size-3.5 opacity-80" />
            יבוא
          </button>
        </div>
      </details>
      <Link href="/saved-inquiries" className="lux-button rounded-xl px-3 py-1.5 text-xs">
        פניות שמורות
      </Link>
      <button
        type="button"
        onClick={handleEmailSync}
        disabled={emailSyncing}
        className="lux-button rounded-xl px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
      >
        <MailCheck className={`size-4 opacity-80 ${emailSyncing ? "animate-pulse" : ""}`} />
        {emailSyncing ? "מסנכרן מיילים…" : "סנכרן מיילים"}
      </button>
      <button
        type="button"
        onClick={() => setShowNewModal(true)}
        className="lux-button-primary rounded-xl px-3 py-1.5 text-xs shadow-md"
      >
        <Plus className="size-4" />
        פנייה חדשה
      </button>
    </>
  );

  return (
    <main className="crm-workspace min-h-screen px-2 pb-16 pt-2 text-[13px] sm:px-3 md:px-4 md:pb-8">
      <div className="mx-auto max-w-[1380px] space-y-2">
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

        <section className="space-y-2">
          <div className="rounded-2xl border border-outline/70 bg-white/95 p-2 shadow-sm">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <SearchBar value={searchValue} onChange={setSearchValue} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {statusFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => {
                      setActiveStatus(filter.id);
                      setPage(1);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      activeStatus === filter.id
                        ? "border-primary bg-primary text-white"
                        : "border-outline bg-white text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    {filter.label} · {filter.count.toLocaleString("he-IL")}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("all");
                  setPage(1);
                }}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${
                  activeCategory === "all"
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-outline bg-white text-on-surface-variant"
                }`}
              >
                כל הקטגוריות
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("Customer_Support");
                  setActiveStatus("open");
                  setPage(1);
                }}
                className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-950"
              >
                תור מיון
              </button>
              {dynamicCategories.slice(0, 10).map((item) => (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => {
                    setActiveCategory(item.category);
                    setPage(1);
                  }}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${
                    activeCategory === item.category
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-outline bg-white text-on-surface-variant"
                  }`}
                >
                  {categoryLabel(item.category)} · {item.count.toLocaleString("he-IL")}
                </button>
              ))}
            </div>

            <details className="mt-1">
              <summary className="cursor-pointer select-none px-2 py-1 text-[11px] font-semibold text-on-surface-variant">
                סינון מתקדם
              </summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <label className="block text-[11px] font-medium text-on-surface-variant">
                  מתאריך
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-outline/80 bg-white px-2 py-2 text-xs outline-none focus:border-primary/50"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </label>
                <label className="block text-[11px] font-medium text-on-surface-variant">
                  עד תאריך
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-outline/80 bg-white px-2 py-2 text-xs outline-none focus:border-primary/50"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </label>
                <label className="block text-[11px] font-medium text-on-surface-variant">
                  תגיות
                  <input
                    className="mt-1 w-full rounded-lg border border-outline/80 bg-white px-2 py-2 text-xs outline-none focus:border-primary/50"
                    placeholder="vip, billing"
                    value={tagsFilter}
                    onChange={(e) => setTagsFilter(e.target.value)}
                  />
                </label>
              </div>
            </details>
          </div>

          <TicketWorkbench
            tickets={items}
            total={total}
            page={page}
            pageSize={pageSize}
            isLoading={isLoading}
            selectedIds={selectedIds}
            activeTicket={activeTicket}
            onSetActiveTicket={(ticket) => setActiveTicketId(ticket.id)}
            onToggleSelect={onToggleSelect}
            onSelectPage={onSelectPage}
            onPageChange={setPage}
            onEdit={setEditingTicket}
            onMarkClosed={onMarkClosed}
            onDelete={(id) => {
              void onDelete(id);
            }}
            onSetStatus={(id, status) => {
              void onSetTicketStatus(id, status);
            }}
            onChangeCategory={(id, category) => {
              void onChangeSingleCategory(id, category);
            }}
            onReply={setReplyingTicket}
            onSaveInquiry={(ticket) => {
              void onSaveInquiry(ticket);
            }}
          />

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
      <ReplyTicketModal
        ticket={replyingTicket}
        onClose={() => setReplyingTicket(null)}
        onSubmit={onSendReply}
      />
      <CloseTicketModal
        isOpen={closingTicketIds !== null}
        count={closingTicketIds?.length ?? 0}
        onCancel={() => setClosingTicketIds(null)}
        onSubmit={onSubmitCloseTickets}
      />
      <ExportContactsModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />
      <ReplyTemplatesModal isOpen={showReplyTemplates} onClose={() => setShowReplyTemplates(false)} />
    </main>
  );
}
