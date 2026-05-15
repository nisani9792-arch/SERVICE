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

type WorkbenchStatusFilter = TicketStatus | "active";

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
  const [activeStatus, setActiveStatus] = useState<WorkbenchStatusFilter>("active");
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
    () => items.find((ticket) => ticket.id === activeTicketId) ?? null,
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
        headers: { "x-service-dashboard": "true" },
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
    const key = "jusic:auto-email-sync:v1";
    if (typeof window === "undefined" || window.sessionStorage.getItem(key)) {
      return;
    }

    window.sessionStorage.setItem(key, new Date().toISOString());
    void handleEmailSync();
  }, [handleEmailSync]);

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
    if (activeTicketId && !items.some((ticket) => ticket.id === activeTicketId)) {
      setActiveTicketId(null);
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
  const openCount = stats?.statusCounts.open ?? 0;
  const inProgressCount = stats?.statusCounts.in_progress ?? 0;
  const closedCount = stats?.statusCounts.closed ?? 0;
  const activeCount = openCount + inProgressCount;
  const triageCount =
    dynamicCategories.find((item) => item.category === "Customer_Support")?.count ?? 0;
  const workbenchTitle =
    activeStatus === "closed"
      ? "פניות שנסגרו"
      : activeCategory === "Customer_Support" && activeStatus === "open"
        ? "תור מיון"
        : activeStatus === "in_progress"
          ? "פניות בטיפול"
          : "פניות פעילות";

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
          <div className="rounded-3xl border border-outline/70 bg-white/95 p-3 shadow-sm">
            <div className="grid gap-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("all");
                  setActiveStatus("active");
                  setPage(1);
                }}
                className={`rounded-2xl border p-3 text-right transition ${
                  activeStatus === "active" && activeCategory === "all"
                    ? "border-primary bg-primary text-white shadow-soft"
                    : "border-outline bg-white text-on-surface hover:border-primary/35"
                }`}
              >
                <span className="block text-xs font-semibold opacity-80">עבודה יומית</span>
                <span className="mt-1 block text-lg font-black">פניות פעילות</span>
                <span className="text-xs opacity-80">{activeCount.toLocaleString("he-IL")} פתוחות ובטיפול</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("Customer_Support");
                  setActiveStatus("open");
                  setPage(1);
                }}
                className={`rounded-2xl border p-3 text-right transition ${
                  activeCategory === "Customer_Support" && activeStatus === "open"
                    ? "border-amber-300 bg-amber-100 text-amber-950 shadow-sm"
                    : "border-outline bg-white text-on-surface hover:border-amber-300"
                }`}
              >
                <span className="block text-xs font-semibold opacity-80">כניסה חדשה</span>
                <span className="mt-1 block text-lg font-black">תור מיון</span>
                <span className="text-xs opacity-80">{triageCount.toLocaleString("he-IL")} לשיוך ובדיקה</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("all");
                  setActiveStatus("in_progress");
                  setPage(1);
                }}
                className={`rounded-2xl border p-3 text-right transition ${
                  activeStatus === "in_progress" && activeCategory === "all"
                    ? "border-sky-300 bg-sky-100 text-sky-950 shadow-sm"
                    : "border-outline bg-white text-on-surface hover:border-sky-300"
                }`}
              >
                <span className="block text-xs font-semibold opacity-80">במעקב</span>
                <span className="mt-1 block text-lg font-black">בטיפול</span>
                <span className="text-xs opacity-80">{inProgressCount.toLocaleString("he-IL")} פניות פעילות</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("all");
                  setActiveStatus("closed");
                  setPage(1);
                }}
                className={`rounded-2xl border p-3 text-right transition ${
                  activeStatus === "closed"
                    ? "border-emerald-300 bg-emerald-100 text-emerald-950 shadow-sm"
                    : "border-outline bg-white text-on-surface hover:border-emerald-300"
                }`}
              >
                <span className="block text-xs font-semibold opacity-80">ארכיון</span>
                <span className="mt-1 block text-lg font-black">פניות שנסגרו</span>
                <span className="text-xs opacity-80">{closedCount.toLocaleString("he-IL")} טופלו ונשמרו</span>
              </button>
            </div>

            <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr),auto] lg:items-start">
              <SearchBar value={searchValue} onChange={setSearchValue} />
              <details className="rounded-2xl border border-outline bg-surface-high px-3 py-2 lg:w-72">
                <summary className="cursor-pointer select-none text-xs font-bold text-on-surface">
                  סינון מתקדם וקטגוריות
              </summary>
              <div className="mt-3 space-y-3">
                <label className="block text-[11px] font-medium text-on-surface-variant">
                  קטגוריה
                  <select
                    className="mt-1 w-full rounded-lg border border-outline/80 bg-white px-2 py-2 text-xs outline-none focus:border-primary/50"
                    value={activeCategory}
                    onChange={(event) => {
                      setActiveCategory(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="all">כל הקטגוריות</option>
                    {dynamicCategories.map((item) => (
                      <option key={item.category} value={item.category}>
                        {categoryLabel(item.category)} ({item.count.toLocaleString("he-IL")})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
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
              </div>
            </details>
            </div>
          </div>

          <TicketWorkbench
            title={workbenchTitle}
            subtitle={
              activeStatus === "closed"
                ? "רק פניות שטופלו, נסגרו או קיבלו מענה"
                : "פניות פתוחות ובטיפול בלבד, ללא סגורות"
            }
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
