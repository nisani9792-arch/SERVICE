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
  Smartphone,
  Sparkles,
  Trash2,
  Zap
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { MotionPage } from "@/components/ui/Motion";
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
  const activeCount =
    stats?.activeCount ?? (stats?.statusCounts.open ?? 0) + (stats?.statusCounts.in_progress ?? 0);
  const handledCount = stats?.handledCount ?? 0;
  const spamCount = stats?.spamCount ?? 0;
  const outboxCount = stats?.outboxCount ?? 0;
  const deletedCount = stats?.deletedCount ?? 0;

  return (
    <MotionPage className="crm-workspace min-h-full w-full px-4 py-4 md:px-8 md:py-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="glass-panel rounded-2xl border border-outline/50 p-4 md:p-5">
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
        </div>

        {toast ? (
          <p className="crm-toast crm-toast-success rounded-xl px-4 py-2 text-sm" role="status">
            {toast}
          </p>
        ) : null}

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold text-on-surface md:text-xl">מרכז פיקוד</h1>
              <p className="text-xs text-on-surface-variant md:text-sm">
                ניטור דליים — לעיבוד עבור ל
                <Link href="/dashboard/inbox" className="mx-1 font-semibold text-primary underline">
                  לוח העיבוד
                </Link>
              </p>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              סה״כ במערכת: {(stats?.total ?? 0).toLocaleString("he-IL")} פניות
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <CrmBucketCard
              href={"/dashboard/inbox?bucket=active" as Route}
              label="פעילות"
              count={activeCount}
              hint="פתוחות ובטיפול"
              icon={Zap}
              accentClass="border-sky-200/90 hover:border-sky-400"
              size="lg"
            />
            <CrmBucketCard
              href={"/dashboard/inbox?bucket=handled" as Route}
              label="טופלו"
              count={handledCount}
              hint="סגורות ללא ספאם"
              icon={Archive}
              accentClass="border-emerald-200/90 hover:border-emerald-400"
              size="lg"
            />
            <CrmBucketCard
              href={"/dashboard/inbox?bucket=spam" as Route}
              label="ספאם"
              count={spamCount}
              hint="כולל חסימת שולחים"
              icon={ShieldBan}
              accentClass="border-amber-200/90 hover:border-amber-400"
              size="lg"
            />
            <CrmBucketCard
              href={"/dashboard/inbox?bucket=outbox" as Route}
              label="דואר יוצא"
              count={outboxCount}
              hint="נענו ונסגרו"
              icon={Send}
              accentClass="border-violet-200/90 hover:border-violet-400"
              size="lg"
            />
            <CrmBucketCard
              href={"/dashboard/inbox?bucket=deleted" as Route}
              label="נמחקו"
              count={deletedCount}
              hint="סל מחזור"
              icon={Trash2}
              accentClass="border-rose-200/90 hover:border-rose-400"
              size="lg"
            />
            <CrmBucketCard
              href={"/triage" as Route}
              label="ממתין לסינון"
              count={triageCount}
              hint="פניות חדשות"
              icon={Inbox}
              accentClass="border-fuchsia-200/90 hover:border-fuchsia-400"
              size="lg"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold text-on-surface md:text-base">זרימות עבודה</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Link
              href={"/dashboard/inbox" as Route}
              className="glass-panel flex min-h-[7rem] items-start gap-4 rounded-2xl border-2 border-primary/30 p-5 transition hover:border-primary/60 hover:shadow-glow-sm"
            >
              <span className="rounded-xl bg-primary-soft p-3 text-primary">
                <Layers className="size-7" />
              </span>
              <div className="min-w-0 flex-1 text-right">
                <h2 className="text-lg font-bold text-on-surface">לוח עיבוד (Desktop)</h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  חיפוש, סינון, פרטי פנייה, AI, פעולות מרובות · קיצורי מקלדת j/k/e/d
                </p>
                <p className="mt-2 text-xs font-bold text-primary">
                  {activeCount.toLocaleString("he-IL")} פעילות ממתינות
                </p>
              </div>
            </Link>

            <Link
              href={"/mobile/triage?queue=active" as Route}
              className="glass-panel flex min-h-[7rem] items-start gap-4 rounded-2xl border border-outline p-5 transition hover:border-primary/40"
            >
              <span className="rounded-xl bg-surface-container p-3 text-on-surface">
                <Smartphone className="size-7" />
              </span>
              <div className="min-w-0 flex-1 text-right">
                <h2 className="text-lg font-bold text-on-surface">מצב סריקה (נייד / טאבלט)</h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  כרטיס מלא, סווייפ, מענה מהיר — לשטח או לטלפון
                </p>
              </div>
            </Link>

            <Link
              href="/answer-bundles"
              className="glass-panel block rounded-2xl border border-emerald-200/80 p-5 transition hover:border-emerald-400"
            >
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-900">
                  <MessageSquareReply className="size-6" />
                </span>
                <div className="min-w-0 flex-1 text-right">
                  <h2 className="text-base font-bold text-on-surface">מענה בחבילות</h2>
                  <p className="mt-0.5 text-sm text-on-surface-variant">
                    תשובה אחת ל-20–30 פניות זהות
                  </p>
                  <p className="mt-2 text-xs font-bold text-emerald-800">
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

            <div className="glass-panel rounded-2xl border border-fuchsia-200/80 p-5">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-fuchsia-100 p-2.5 text-fuchsia-900">
                  <Inbox className="size-6" />
                </span>
                <div className="min-w-0 flex-1 text-right">
                  <h2 className="text-base font-bold text-on-surface">מיון AI + תור ישן</h2>
                  <p className="mt-0.5 text-sm text-on-surface-variant">
                    סיווג אצווה לכל התור הפתוח · {triageCount.toLocaleString("he-IL")} ממתין לסינון
                  </p>
                  <button
                    type="button"
                    disabled={sorting}
                    onClick={() => void sortAllOpen()}
                    className="mt-3 rounded-lg bg-fuchsia-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {sorting ? "ממיין…" : "מיין את כל התור הפתוח"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-center gap-4 border-t border-outline/40 pt-4 text-sm">
          <Link
            href="/rapid-reply"
            className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary"
          >
            <Sparkles className="size-4" />
            מענה מהיר (חריג)
          </Link>
          <Link
            href={"/mobile/triage?queue=active" as Route}
            className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary"
          >
            <LayoutGrid className="size-4" />
            פתח סריקת כרטיסים
          </Link>
        </div>
      </div>

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
