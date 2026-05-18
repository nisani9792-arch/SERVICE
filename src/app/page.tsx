"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { readStatsCache, writeStatsCache } from "@/lib/dashboard-cache";
import { AiAgentPanel } from "@/components/AiAgentPanel";
import { BatchProgressBar } from "@/components/BatchProgressBar";
import { TicketWorkbench } from "@/components/TicketWorkbench";
import { ReplyTicketModal } from "@/components/ReplyTicketModal";
import {
  deleteTicket,
  deleteTicketsBulk,
  runAgentCommand,
  runBatchReclassifyWithSse,
  saveInquiryForAction,
  streamBatchJobWithSse,
  sendBulkTicketReply,
  sendTicketReply,
  updateTicket,
  updateTicketsBulk
} from "@/lib/firebase";
import { useTicketList } from "@/hooks/useTicketList";
import { useListPageSize } from "@/hooks/useListPageSize";
import {
  EMAIL_SYNC_EVENT,
  runEmailIngestClient,
  type EmailSyncResult
} from "@/lib/email-sync-client";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { PENDING_TRIAGE_CATEGORY } from "@/lib/triage";
import { ImportModal } from "@/components/ImportModal";
import { NewTicketModal } from "@/components/NewTicketModal";
import { EditTicketModal } from "@/components/EditTicketModal";
import { ExportContactsModal } from "@/components/ExportContactsModal";
import { ReplyTemplatesModal } from "@/components/ReplyTemplatesModal";
import { BulkReplyModal } from "@/components/BulkReplyModal";
import { CloseTicketModal } from "@/components/CloseTicketModal";
import { categoryLabel } from "@/lib/categories";
import type { Ticket, TicketStatus } from "@/lib/types";

type WorkbenchStatusFilter = TicketStatus | "active";

export default function DashboardPage() {
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");
  const [activeStatus, setActiveStatus] = useState<WorkbenchStatusFilter>("active");
  const [searchValue, setSearchValue] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tagsFilter, setTagsFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = useListPageSize(25, 12);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showReplyTemplates, setShowReplyTemplates] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [replyingTicket, setReplyingTicket] = useState<Ticket | null>(null);
  const [closingTicketIds, setClosingTicketIds] = useState<string[] | null>(null);
  const [showBulkReply, setShowBulkReply] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  const [headerRefreshing, setHeaderRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [lastEmailSyncedAt, setLastEmailSyncedAt] = useState<Date | null>(null);
  const [emailSyncing, setEmailSyncing] = useState(false);
  const [emailSyncMessage, setEmailSyncMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [aiReclassifying, setAiReclassifying] = useState(false);
  const [batchProgress, setBatchProgress] = useState({
    visible: false,
    label: "",
    processed: 0,
    total: 0,
    progress: 0
  });

  const debouncedSearch = useDebouncedValue(searchValue, 220);
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

  const {
    items,
    total,
    isLoading,
    isRefreshing,
    error: listError,
    refresh,
    patchItem,
    removeItem,
    upsertItem
  } = useTicketList(listQuery);
  const statsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTicket = useMemo(
    () => items.find((ticket) => ticket.id === activeTicketId) ?? null,
    [activeTicketId, items]
  );
  const [stats, setStats] = useState<DashboardStatsModel | null>(() => readStatsCache());

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

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshStats(), refresh()]);
    setLastSyncedAt(new Date());
  }, [refresh, refreshStats]);

  const afterMutation = useCallback(
    async (options?: { full?: boolean }) => {
      if (options?.full) {
        await refreshAll();
        return;
      }
      void refresh();
      scheduleStatsRefresh();
      setLastSyncedAt(new Date());
    },
    [refresh, refreshAll, scheduleStatsRefresh]
  );

  useEffect(() => {
    void refreshStats();
    return () => {
      if (statsTimerRef.current) clearTimeout(statsTimerRef.current);
    };
  }, [refreshStats]);

  useLiveRefresh(() => {
    void refresh();
    scheduleStatsRefresh();
    setLastSyncedAt(new Date());
  }, 300_000);

  const applyEmailSyncResult = useCallback(
    (result: EmailSyncResult, source: "auto" | "manual") => {
      setLastEmailSyncedAt(new Date());

      if (!result.ok) {
        if (source === "manual") {
          setEmailSyncMessage({
            kind: "error",
            text: `סנכרון המייל נכשל: ${result.details || result.error || "שגיאה לא ידועה"}`
          });
        }
        return;
      }

      void refreshAll();

      if ((result.imported ?? 0) > 0) {
        setEmailSyncMessage({
          kind: "success",
          text:
            source === "auto"
              ? `סנכרון אוטומטי: ${result.imported} פניות חדשות ממייל.`
              : `סנכרון מיילים הושלם: ${result.imported} פניות חדשות נוספו, ${result.skipped ?? 0} דולגו, ${result.archived ?? 0} הועברו לארכיון במייל${result.archiveMailbox ? ` (${result.archiveMailbox})` : ""}.`
        });
        return;
      }

      if (source === "manual") {
        setEmailSyncMessage({
          kind: "success",
          text: `סנכרון מיילים הושלם: לא נמצאו פניות חדשות (${result.scanned ?? 0} מיילים נסרקו, ${result.skipped ?? 0} דולגו).`
        });
      }
    },
    [refreshAll]
  );

  useEffect(() => {
    const onAutoSync = (event: Event) => {
      const detail = (event as CustomEvent<EmailSyncResult>).detail;
      if (!detail) return;
      applyEmailSyncResult(detail, "auto");
    };

    window.addEventListener(EMAIL_SYNC_EVENT, onAutoSync);
    return () => window.removeEventListener(EMAIL_SYNC_EVENT, onAutoSync);
  }, [applyEmailSyncResult]);

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
      const result = await runEmailIngestClient(controller.signal);
      setLastSyncedAt(new Date());
      applyEmailSyncResult(result, "manual");
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
  }, [applyEmailSyncResult]);

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
    await afterMutation({ full: true });
  };

  const onSetTicketStatus = async (ticketId: string, status: TicketStatus) => {
    patchItem(ticketId, { status });
    try {
      const updated = await updateTicket(ticketId, { status });
      upsertItem(updated);
      await afterMutation();
    } catch {
      await afterMutation({ full: true });
    }
  };

  const onDelete = async (ticketId: string) => {
    if (!window.confirm("למחוק את הפנייה לצמיתות?")) return;
    removeItem(ticketId);
    if (activeTicketId === ticketId) setActiveTicketId(null);
    try {
      await deleteTicket(ticketId);
      await afterMutation();
    } catch {
      await afterMutation({ full: true });
    }
  };

  const onBulkClose = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setClosingTicketIds(ids);
  };

  const onBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`למחוק ${ids.length.toLocaleString("he-IL")} פניות לצמיתות?`)) return;
    await deleteTicketsBulk(ids);
    setSelectedIds(new Set());
    await afterMutation({ full: true });
  };

  const onBulkChangeCategory = async (category: string) => {
    const ids = Array.from(selectedIds);
    await updateTicketsBulk(ids, { category });
    setSelectedIds(new Set());
    await afterMutation({ full: true });
  };

  const onBulkSetStatus = async (status: TicketStatus) => {
    const ids = Array.from(selectedIds);
    await updateTicketsBulk(ids, { status });
    setSelectedIds(new Set());
    await afterMutation({ full: true });
  };

  const onBulkAddTags = async (tags: string[]) => {
    const ids = Array.from(selectedIds);
    await updateTicketsBulk(ids, { tags, replaceTags: false });
    setSelectedIds(new Set());
    await afterMutation({ full: true });
  };

  const onBulkSpam = async () => {
    const ids = Array.from(selectedIds);
    await updateTicketsBulk(ids, { category: "Spam", status: "closed" });
    setSelectedIds(new Set());
    await afterMutation({ full: true });
  };

  const onChangeSingleCategory = async (ticketId: string, category: string) => {
    patchItem(ticketId, { category });
    try {
      const updated = await updateTicket(ticketId, { category });
      upsertItem(updated);
      await afterMutation();
    } catch {
      await afterMutation({ full: true });
    }
  };

  const onTriageAssign = async (ticketId: string, category: string) => {
    const currentIndex = items.findIndex((ticket) => ticket.id === ticketId);
    const nextTicket = items[currentIndex + 1] ?? items[currentIndex - 1] ?? null;

    removeItem(ticketId);
    if (nextTicket && nextTicket.id !== ticketId) {
      setActiveTicketId(nextTicket.id);
    } else {
      setActiveTicketId(null);
    }

    try {
      await updateTicket(ticketId, { category, status: "open" });
      await afterMutation();
    } catch {
      setActiveTicketId(ticketId);
      await afterMutation({ full: true });
    }
  };

  const showBatchProgress = (label: string, processed: number, total: number) => {
    const progress = total > 0 ? Math.round((processed / total) * 100) : 0;
    setBatchProgress({ visible: true, label, processed, total, progress });
  };

  const hideBatchProgress = () => {
    setBatchProgress((prev) => ({ ...prev, visible: false }));
  };

  const runBatchAi = async (
    scope: "spam" | "pending_triage" | "ids",
    options?: { ids?: string[]; limit?: number; confirmMessage?: string }
  ) => {
    if (options?.confirmMessage && !window.confirm(options.confirmMessage)) return;

    setAiReclassifying(true);
    showBatchProgress("סיווג AI…", 0, 0);

    try {
      const result = await runBatchReclassifyWithSse({
        scope,
        ids: options?.ids,
        limit: options?.limit ?? (scope === "ids" ? options?.ids?.length : 150),
        onProgress: (p) => showBatchProgress("סיווג AI…", p.processed, p.total)
      });

      await refreshAll();
      setEmailSyncMessage({
        kind: "success",
        text: `סיווג AI הושלם: ${result.processed} מתוך ${result.total} פניות.`
      });
    } catch (error) {
      setEmailSyncMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "סיווג AI נכשל"
      });
    } finally {
      setAiReclassifying(false);
      hideBatchProgress();
    }
  };

  const onBulkAiClassify = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await runBatchAi("ids", {
      ids,
      confirmMessage: `לסווג מחדש ${ids.length} פניות עם AI (בפעימות)?`
    });
    setSelectedIds(new Set());
  };

  const onReclassifyPendingTriage = async () => {
    await runBatchAi("pending_triage", {
      limit: 150,
      confirmMessage: "לסווג מחדש את תור ממתין לסינון עם AI (בפעימות)?"
    });
  };

  const onReclassifySpamWithAi = async () => {
    await runBatchAi("spam", {
      limit: 150,
      confirmMessage:
        "לסרוק מחדש פניות שסומנו כספאם עם AI? פניות אמיתיות יועברו לקטגוריה מתאימה."
    });
  };

  const onAgentCommand = async (text: string) => {
    setAiReclassifying(true);
    try {
      const result = await runAgentCommand(text, Array.from(selectedIds));

      if (result.jobId) {
        showBatchProgress("סוכן AI ממשיך סיווג…", 0, 0);
        const batch = await streamBatchJobWithSse(result.jobId, {
          onProgress: (p) => showBatchProgress("סוכן AI ממשיך סיווג…", p.processed, p.total)
        });
        await refreshAll();
        return {
          reply: `${result.reply}\n\nסיווג באצ' הושלם: ${batch.processed}/${batch.total}.`
        };
      }

      await refreshAll();
      return { reply: result.reply };
    } catch (error) {
      const message = error instanceof Error ? error.message : "פקודת סוכן נכשלה";
      setEmailSyncMessage({ kind: "error", text: message });
      return { reply: message };
    } finally {
      setAiReclassifying(false);
      hideBatchProgress();
    }
  };

  const onSendReply = async (message: string, options?: { closeAfterSend?: boolean }) => {
    if (!replyingTicket) return;
    const result = await sendTicketReply(replyingTicket.id, message, options);
    if (result.closureNote && replyingTicket) {
      patchItem(replyingTicket.id, {
        closureNote: result.closureNote,
        status: result.closed ? "closed" : "in_progress"
      });
    }
    await afterMutation({ full: true });
    if (result.queued && result.message) {
      setEmailSyncMessage({ kind: "success", text: result.message });
    } else if (result.sent) {
      setEmailSyncMessage({
        kind: "success",
        text: result.closed
          ? `המענה נשלח והפנייה נסגרה. הערת טיפול נשמרה.`
          : "המענה נשלח ללקוח."
      });
    }
  };

  const onBulkSendReply = async (message: string, options?: { closeAfterSend?: boolean }) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const result = await sendBulkTicketReply(ids, message, options);
    setSelectedIds(new Set());
    await afterMutation({ full: true });
    const parts = [
      result.sent ? `${result.sent} נשלחו` : "",
      result.queued ? `${result.queued} בתור` : "",
      result.failed.length ? `${result.failed.length} נכשלו` : ""
    ].filter(Boolean);
    window.alert(`מענה מרובה: ${parts.join(" · ")}`);
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
  const triageCount = stats?.pendingTriageCount ?? 0;
  const workbenchTitle =
    activeCategory === PENDING_TRIAGE_CATEGORY
      ? "ממתין לסינון"
      : activeStatus === "closed"
        ? "פניות שנסגרו"
        : activeStatus === "in_progress"
          ? "פניות בטיפול"
          : "פניות פעילות";
  const workbenchSubtitle =
    activeCategory === PENDING_TRIAGE_CATEGORY
      ? "פניות חדשות ממייל — בחר קטגוריה בלחיצה אחת"
      : activeStatus === "closed"
        ? `מציג ${total.toLocaleString("he-IL")} פניות סגורות (כולל טופלו בעבר)`
        : undefined;

  const headerActions = (
    <>
      <div className="hidden flex-wrap items-center gap-2 md:flex">
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
          <button
            type="button"
            disabled={aiReclassifying}
            onClick={() => {
              void onReclassifySpamWithAi();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-right text-xs hover:bg-surface-container disabled:opacity-50"
          >
            <MessageSquareText className="size-3.5 opacity-80" />
            {aiReclassifying ? "מסווג מחדש…" : "סיווג מחדש (AI) — ספאם"}
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
      </div>

      <details className="relative md:hidden">
        <summary className="lux-button cursor-pointer list-none rounded-xl px-3 py-2 text-xs font-semibold">
          תפריט
        </summary>
        <div className="absolute left-0 z-50 mt-2 w-44 rounded-xl border border-outline bg-white p-1 shadow-card">
          <button
            type="button"
            onClick={() => setShowReplyTemplates(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-right text-xs hover:bg-surface-container"
          >
            תבניות מענה
          </button>
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-right text-xs hover:bg-surface-container"
          >
            ייצוא אנשי קשר
          </button>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-right text-xs hover:bg-surface-container"
          >
            יבוא פניות
          </button>
          <Link
            href="/saved-inquiries"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-right text-xs hover:bg-surface-container"
          >
            פניות שמורות
          </Link>
          <button
            type="button"
            onClick={handleEmailSync}
            disabled={emailSyncing}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-right text-xs hover:bg-surface-container disabled:opacity-50"
          >
            <MailCheck className="size-3.5 opacity-80" />
            {emailSyncing ? "מסנכרן…" : "סנכרן מיילים"}
          </button>
        </div>
      </details>

      <button
        type="button"
        onClick={() => setShowNewModal(true)}
        className="lux-button-primary fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-30 size-12 rounded-full p-0 shadow-lg md:hidden"
        aria-label="פנייה חדשה"
      >
        <Plus className="size-5" />
      </button>
    </>
  );

  return (
    <main className="crm-workspace crm-mobile-bottom-bar min-h-screen px-2 pb-24 pt-2 text-[13px] sm:px-3 md:px-4 md:pb-8">
      <div className="mx-auto max-w-[1380px] space-y-2">
        <AppHeader
          actions={headerActions}
          onRefresh={handleHeaderRefresh}
          refreshing={headerRefreshing}
          lastSyncedAt={lastEmailSyncedAt ?? lastSyncedAt}
        />

        {listError ? (
          <div className="lux-card flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            <span>{listError}</span>
            <button
              type="button"
              className="crm-touch-target rounded-lg border border-danger/40 bg-white px-3 py-1 text-xs font-semibold text-danger"
              onClick={() => {
                void refreshAll();
              }}
            >
              נסה שוב
            </button>
          </div>
        ) : null}

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
            <div className="crm-kpi-scroll flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("all");
                  setActiveStatus("active");
                  setPage(1);
                }}
                className={`crm-kpi-card min-w-[9.5rem] shrink-0 rounded-2xl border p-3 text-right transition lg:min-w-0 ${
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
                  setActiveCategory(PENDING_TRIAGE_CATEGORY);
                  setActiveStatus("active");
                  setPage(1);
                }}
                className={`min-w-[9.5rem] shrink-0 rounded-2xl border p-3 text-right transition lg:min-w-0 ${
                  activeCategory === PENDING_TRIAGE_CATEGORY
                    ? "border-fuchsia-400 bg-fuchsia-100 text-fuchsia-950 shadow-sm"
                    : "border-outline bg-white text-on-surface hover:border-fuchsia-300"
                }`}
              >
                <span className="block text-xs font-semibold opacity-80">כניסה חדשה</span>
                <span className="mt-1 block text-lg font-black">ממתין לסינון</span>
                <span className="text-xs opacity-80">{triageCount.toLocaleString("he-IL")} לשיוך ובדיקה</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("all");
                  setActiveStatus("in_progress");
                  setPage(1);
                }}
                className={`min-w-[9.5rem] shrink-0 rounded-2xl border p-3 text-right transition lg:min-w-0 ${
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
                className={`min-w-[9.5rem] shrink-0 rounded-2xl border p-3 text-right transition lg:min-w-0 ${
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

          <details className="crm-agent-panel rounded-2xl border border-primary/15 bg-white/90">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-bold text-on-surface">
              סוכן AI (אופציונלי)
            </summary>
            <div className="border-t border-outline/50 p-2">
              <AiAgentPanel
                selectedCount={selectedIds.size}
                busy={aiReclassifying}
                onRun={onAgentCommand}
              />
            </div>
          </details>

          {activeCategory === PENDING_TRIAGE_CATEGORY ? (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={aiReclassifying}
                onClick={() => {
                  void onReclassifyPendingTriage();
                }}
                className="crm-touch-target lux-button border-violet-200 bg-violet-50 text-violet-950"
              >
                {aiReclassifying ? "מסווג עם AI…" : "סיווג AI — כל התור (SSE)"}
              </button>
            </div>
          ) : null}

          <TicketWorkbench
            title={workbenchTitle}
            subtitle={workbenchSubtitle}
            tickets={items}
            total={total}
            page={page}
            pageSize={pageSize}
            isLoading={isLoading}
            isRefreshing={isRefreshing}
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
            onTriageAssign={(id, category) => {
              void onTriageAssign(id, category);
            }}
          />

          <BulkActionBar
            count={selectedIds.size}
            onReply={() => setShowBulkReply(true)}
            onAiClassify={() => {
              void onBulkAiClassify();
            }}
            aiBusy={aiReclassifying}
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
      <BulkReplyModal
        isOpen={showBulkReply}
        count={selectedIds.size}
        onClose={() => setShowBulkReply(false)}
        onSubmit={onBulkSendReply}
      />

      <BatchProgressBar
        visible={batchProgress.visible}
        label={batchProgress.label}
        processed={batchProgress.processed}
        total={batchProgress.total}
        progress={batchProgress.progress}
      />
    </main>
  );
}
