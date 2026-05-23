"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  Inbox,
  Layers,
  LayoutGrid,
  Loader2,
  MessageSquareReply,
  Send,
  ShieldBan,
  Sparkles,
  Trash2,
  Zap
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { MotionPage } from "@/components/ui/Motion";
import { MobileDock } from "@/components/MobileDock";
import { BatchProgressBar } from "@/components/BatchProgressBar";
import { CrmBucketCard } from "@/components/crm/CrmBucketCard";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { runBatchReclassifyWithSse } from "@/lib/firebase";
import { runEmailIngestClient } from "@/lib/email-sync-client";

export function DashboardHub() {
  const { stats, refreshStats } = useDashboardStats();
  const [bundleCount, setBundleCount] = useState<number | null>(null);
  const [openTotal, setOpenTotal] = useState<number | null>(null);
  const [loadingBundles, setLoadingBundles] = useState(true);
  const [sorting, setSorting] = useState(false);
  const [emailSyncing, setEmailSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState({
    visible: false,
    label: "",
    processed: 0,
    total: 0,
    progress: 0
  });

  const loadBundles = useCallback(async () => {
    setLoadingBundles(true);
    try {
      const res = await fetch("/api/tickets/answer-bundles?minSize=3&limit=3000", {
        cache: "no-store",
        credentials: "same-origin"
      });
      if (!res.ok) return;
      const data = (await res.json()) as { bundles: unknown[]; openTotal: number };
      setBundleCount(data.bundles?.length ?? 0);
      setOpenTotal(data.openTotal ?? 0);
    } catch {
      setBundleCount(null);
    } finally {
      setLoadingBundles(false);
    }
  }, []);

  useEffect(() => {
    void loadBundles();
  }, [loadBundles]);

  const sortAllOpen = async () => {
    setSorting(true);
    setBatchProgress({
      visible: true,
      label: "ממיין את כל התור הפתוח…",
      processed: 0,
      total: 0,
      progress: 0
    });
    try {
      const result = await runBatchReclassifyWithSse({
        scope: "active_open",
        limit: 10_000,
        onProgress: (p) =>
          setBatchProgress({
            visible: true,
            label: "ממיין את כל התור הפתוח…",
            processed: p.processed,
            total: p.total,
            progress: p.progress
          })
      });
      await fetch("/api/tickets/answer-bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_tags" }),
        credentials: "same-origin"
      });
      await Promise.all([refreshStats(), loadBundles()]);
      setToast(`מיון הושלם: ${result.processed}/${result.total} פניות.`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "מיון נכשל");
    } finally {
      setSorting(false);
      setBatchProgress((p) => ({ ...p, visible: false }));
    }
  };

  const syncMail = async () => {
    setEmailSyncing(true);
    try {
      await runEmailIngestClient(undefined, { force: true });
      await Promise.all([refreshStats(), loadBundles()]);
      setLastSyncedAt(new Date());
      setToast("סנכרון מיילים הושלם.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "סנכרון נכשל");
    } finally {
      setEmailSyncing(false);
    }
  };

  const triageCount = stats?.pendingTriageCount ?? 0;
  const activeCount = stats?.activeCount ?? (stats?.statusCounts.open ?? 0) + (stats?.statusCounts.in_progress ?? 0);
  const handledCount = stats?.handledCount ?? 0;
  const spamCount = stats?.spamCount ?? 0;
  const outboxCount = stats?.outboxCount ?? 0;
  const deletedCount = stats?.deletedCount ?? 0;

  return (
    <MotionPage className="crm-workspace min-h-screen px-3 pb-24 pt-2 md:px-4 md:pb-8">
      <div className="mx-auto max-w-lg space-y-4">
        <AppHeader
          actions={null}
          refreshing={refreshing}
          lastSyncedAt={lastSyncedAt}
          onRefresh={() => {
            setRefreshing(true);
            void Promise.all([refreshStats(), loadBundles()]).finally(() => {
              setRefreshing(false);
              setLastSyncedAt(new Date());
            });
          }}
          onEmailSync={() => {
            void syncMail();
          }}
          emailSyncing={emailSyncing}
        />

        {toast ? (
          <p className="crm-toast crm-toast-success rounded-xl px-3 py-2 text-xs" role="status">
            {toast}
          </p>
        ) : null}

        <p className="text-center text-sm font-semibold text-on-surface">דליים ומצבי עבודה</p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <CrmBucketCard
            href={"/inbox?bucket=active" as Route}
            label="פעילות"
            count={activeCount}
            hint="פתוחות ובטיפול"
            icon={Zap}
            accentClass="border-sky-200/90 hover:border-sky-400"
          />
          <CrmBucketCard
            href={"/inbox?bucket=handled" as Route}
            label="טופלו"
            count={handledCount}
            hint="סגורות ללא ספאם"
            icon={Archive}
            accentClass="border-emerald-200/90 hover:border-emerald-400"
          />
          <CrmBucketCard
            href={"/inbox?bucket=spam" as Route}
            label="ספאם"
            count={spamCount}
            hint="כולל חסימת שולחים"
            icon={ShieldBan}
            accentClass="border-amber-200/90 hover:border-amber-400"
          />
          <CrmBucketCard
            href={"/inbox?bucket=outbox" as Route}
            label="דואר יוצא"
            count={outboxCount}
            hint="נענו ונסגרו"
            icon={Send}
            accentClass="border-violet-200/90 hover:border-violet-400"
          />
          <CrmBucketCard
            href={"/inbox?bucket=deleted" as Route}
            label="נמחקו"
            count={deletedCount}
            hint="סל מחזור"
            icon={Trash2}
            accentClass="border-rose-200/90 hover:border-rose-400"
          />
          <CrmBucketCard
            href="/triage"
            label="ממתין לסינון"
            count={triageCount}
            hint="פניות חדשות"
            icon={Inbox}
            accentClass="border-fuchsia-200/90 hover:border-fuchsia-400"
          />
        </div>

        <p className="pt-1 text-center text-xs text-on-surface-variant">זרימות עבודה</p>

        <Link
          href="/triage"
          className="glass-panel block rounded-2xl border border-fuchsia-200/80 p-4 transition hover:border-fuchsia-400"
        >
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-fuchsia-100 p-2.5 text-fuchsia-900">
              <Inbox className="size-6" />
            </span>
            <div className="min-w-0 flex-1 text-right">
              <h2 className="text-base font-bold text-on-surface">מיון</h2>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                פניות חדשות + סיווג מהיר · {triageCount.toLocaleString("he-IL")} ממתין
              </p>
              <button
                type="button"
                disabled={sorting}
                onClick={(e) => {
                  e.preventDefault();
                  void sortAllOpen();
                }}
                className="mt-2 text-[11px] font-bold text-fuchsia-800 underline disabled:opacity-50"
              >
                {sorting ? "ממיין תור ישן…" : "מיין את כל התור הפתוח (ישן + חדש)"}
              </button>
            </div>
          </div>
        </Link>

        <Link
          href="/answer-bundles"
          className="glass-panel block rounded-2xl border border-emerald-200/80 p-4 transition hover:border-emerald-400"
        >
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-900">
              <MessageSquareReply className="size-6" />
            </span>
            <div className="min-w-0 flex-1 text-right">
              <h2 className="text-base font-bold text-on-surface">מענה בחבילות</h2>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                תשובה אחת ל-20–30 פניות זהות
              </p>
              <p className="mt-2 text-[11px] font-bold text-emerald-800">
                {loadingBundles ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" />
                    טוען חבילות…
                  </span>
                ) : (
                  <>
                    {bundleCount?.toLocaleString("he-IL") ?? "—"} חבילות ·{" "}
                    {(openTotal ?? activeCount).toLocaleString("he-IL")} פתוחות
                  </>
                )}
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/review"
          className="glass-panel block rounded-2xl border border-primary/25 p-4 transition hover:border-primary/50"
        >
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-primary-soft p-2.5 text-primary">
              <LayoutGrid className="size-6" />
            </span>
            <div className="min-w-0 flex-1 text-right">
              <h2 className="text-base font-bold text-on-surface">סריקת כרטיסים</h2>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                טקסט פנייה אמיתי · מחק / ספאם / מענה מהיר
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/inbox"
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-outline px-3 py-2.5 text-xs font-semibold text-on-surface-variant hover:border-primary/40 hover:text-primary"
        >
          <Layers className="size-4" />
          לוח מתקדם — חיפוש, סינון, פעולות מרובות
        </Link>

        <Link
          href="/rapid-reply"
          className="flex items-center justify-center gap-2 text-[11px] text-on-surface-variant hover:text-primary"
        >
          <Sparkles className="size-3.5" />
          מענה מהיר לפנייה בודדת (חריגים)
        </Link>
      </div>

      <MobileDock
        onSyncMail={() => {
          void syncMail();
        }}
        onTriage={() => {
          window.location.href = "/triage";
        }}
        onAnswerBundles={() => {
          window.location.href = "/answer-bundles";
        }}
        onReview={() => {
          window.location.href = "/review";
        }}
        emailSyncing={emailSyncing}
        triageCount={triageCount}
        bundleCount={bundleCount ?? 0}
      />

      <BatchProgressBar
        visible={batchProgress.visible}
        label={batchProgress.label}
        processed={batchProgress.processed}
        total={batchProgress.total}
        progress={batchProgress.progress}
      />
    </MotionPage>
  );
}
