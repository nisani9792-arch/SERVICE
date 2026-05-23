"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Loader2,
  RefreshCw,
  Send,
  SkipForward,
  Sparkles,
  Trash2,
  Zap
} from "lucide-react";
import {
  sendBulkTicketReply,
  updateTicketsBulk
} from "@/lib/firebase";
export type AnswerBundleClient = {
  bundleKey: string;
  topicLabel: string;
  count: number;
  ticketIds: string[];
  samples: Array<{
    id: string;
    subject: string;
    senderEmail: string;
    inquirySnippet: string;
  }>;
  suggestedReply: string | null;
  easy: boolean;
  easyScore: number;
};

type BundlesPayload = {
  bundles: AnswerBundleClient[];
  openTotal: number;
  scanned: number;
};

export function AnswerBundlesMode() {
  const [data, setData] = useState<BundlesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bundleIndex, setBundleIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const bundles = data?.bundles ?? [];
  const current = bundles[bundleIndex] ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tickets/answer-bundles?minSize=3&limit=3000", {
        cache: "no-store",
        credentials: "same-origin"
      });
      if (!res.ok) throw new Error("טעינת חבילות נכשלה");
      const payload = (await res.json()) as BundlesPayload;
      setData(payload);
      setBundleIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!current) {
      setMessage("");
      return;
    }
    setMessage(current.suggestedReply ?? "");
    textareaRef.current?.focus();
  }, [current]);

  const advance = useCallback(() => {
    setBundleIndex((i) => Math.min(i + 1, Math.max(0, bundles.length - 1)));
  }, [bundles.length]);

  const removeCurrentBundle = useCallback(() => {
    if (!current) return;
    setData((prev) => {
      if (!prev) return prev;
      const nextBundles = prev.bundles.filter((b) => b.bundleKey !== current.bundleKey);
      return { ...prev, bundles: nextBundles };
    });
    setBundleIndex((i) => Math.max(0, i));
  }, [current]);

  const submit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      if (!current || !message.trim() || sending) return;

      const ids = current.ticketIds.slice(0, 30);
      if (
        !window.confirm(
          `לשלוח את אותה תשובה ל-${ids.length.toLocaleString("he-IL")} לקוחות ולסגור את הפניות?`
        )
      ) {
        return;
      }

      setSending(true);
      setError(null);
      try {
        const result = await sendBulkTicketReply(ids, message.trim(), { closeAfterSend: true });
        if (result.failed.length > 0) {
          setError(`נשלחו ${result.sent}, נכשלו ${result.failed.length}`);
        }
        removeCurrentBundle();
        setMessage("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "שליחה נכשלה");
      } finally {
        setSending(false);
      }
    },
    [current, message, removeCurrentBundle, sending]
  );

  const markSpam = useCallback(async () => {
    if (!current || sending) return;
    if (!window.confirm(`לסמן ${current.count} פניות כספאם ולסגור?`)) return;
    setSending(true);
    setError(null);
    try {
      await updateTicketsBulk(current.ticketIds.slice(0, 30), {
        category: "spam",
        status: "closed"
      });
      removeCurrentBundle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "עדכון נכשל");
    } finally {
      setSending(false);
    }
  }, [current, removeCurrentBundle, sending]);

  const trySubmitFromKeyboard = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      void submit();
    },
    [submit]
  );

  useEffect(() => {
    if (!current || sending) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "TEXTAREA" || target?.tagName === "INPUT") {
        if (event.key === "s" || event.key === "S") {
          event.preventDefault();
          advance();
        }
        if (event.key === "d" || event.key === "D") {
          event.preventDefault();
          void markSpam();
        }
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [advance, current, markSpam, sending]);

  const remainingBundles = Math.max(0, bundles.length - bundleIndex);

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="flex flex-wrap items-center gap-3 border-b border-outline/60 bg-white px-4 py-3">
        <Link
          href="/"
          className="rounded-xl border border-outline p-2 text-on-surface-variant hover:bg-surface-container"
          aria-label="חזרה"
        >
          <ArrowRight className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-on-surface">חבילות מענה</h1>
          <p className="text-[11px] text-on-surface-variant">
            תשובה אחת לכל החבילה · Ctrl+Enter שליחה · S דילוג · D ספאם
          </p>
        </div>
        {data ? (
          <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary">
            {remainingBundles} חבילות · {data.openTotal.toLocaleString("he-IL")} פתוחות
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-outline p-2"
          aria-label="רענון"
        >
          <RefreshCw className="size-4" />
        </button>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-on-surface-variant">
          <Loader2 className="size-5 animate-spin" />
          מקבץ פניות לפי נושא…
        </div>
      ) : bundles.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm font-semibold text-on-surface">אין חבילות עם 3+ פניות דומות</p>
          <p className="text-xs text-on-surface-variant">
            נסה למיין את התור הפתוח מהמסך הראשי, או השתמש במענה מהיר לפנייה בודדת.
          </p>
          <Link href="/" className="text-xs text-primary underline">
            חזרה למרכז העבודה
          </Link>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(11rem,16rem),minmax(0,1fr)]">
          <aside className="border-b border-outline/60 bg-white md:border-b-0 md:border-l">
            <div className="max-h-[28vh] overflow-y-auto p-2 md:max-h-none md:h-full">
              {bundles.map((bundle, index) => {
                const active = index === bundleIndex;
                return (
                  <button
                    key={bundle.bundleKey}
                    type="button"
                    onClick={() => setBundleIndex(index)}
                    className={`mb-1 flex w-full flex-col rounded-xl border px-2.5 py-2 text-right transition ${
                      active
                        ? "border-primary bg-primary-soft/60"
                        : "border-outline/70 bg-surface-container/30 hover:border-primary/30"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span className="line-clamp-2 text-[11px] font-bold text-on-surface">
                        {bundle.topicLabel}
                      </span>
                      {bundle.easy ? (
                        <Zap className="size-3 shrink-0 text-amber-600" aria-label="קל" />
                      ) : null}
                    </span>
                    <span className="mt-0.5 text-[10px] text-on-surface-variant">
                      {bundle.count.toLocaleString("he-IL")} פניות
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {current ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-outline/50 bg-violet-50/30 px-4 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-on-surface">{current.topicLabel}</h2>
                  {current.easy ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                      קל ומהיר
                    </span>
                  ) : null}
                  <span className="text-[11px] text-on-surface-variant">
                    {current.count.toLocaleString("he-IL")} פניות בחבילה
                  </span>
                </div>
              </div>

              <section className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <p className="mb-2 text-[11px] font-bold text-violet-950">דוגמאות מהלקוחות</p>
                <div className="space-y-2">
                  {current.samples.map((sample) => (
                    <div
                      key={sample.id}
                      className="rounded-xl border border-outline/70 bg-white p-3 text-xs leading-relaxed"
                    >
                      <p className="mb-1 font-semibold text-on-surface-variant">
                        {sample.senderEmail || "לקוח"}
                        {sample.subject ? ` · ${sample.subject}` : ""}
                      </p>
                      <p className="whitespace-pre-wrap text-on-surface">{sample.inquirySnippet}</p>
                    </div>
                  ))}
                </div>
                {current.suggestedReply ? (
                  <p className="mt-3 inline-flex items-center gap-1 text-[10px] text-violet-800">
                    <Sparkles className="size-3" />
                    הצעה ממענה קודם דומה
                  </p>
                ) : null}
              </section>

              <div className="border-t border-outline/60 bg-white p-4">
                {error ? (
                  <p className="mb-2 text-xs font-semibold text-red-600" role="alert">
                    {error}
                  </p>
                ) : null}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                  }}
                >
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={trySubmitFromKeyboard}
                    disabled={sending}
                    rows={5}
                    enterKeyHint="enter"
                    placeholder="תשובה אחת לכל החבילה… Ctrl+Enter לשליחה"
                    className="w-full resize-y rounded-2xl border border-outline bg-surface-container/30 px-3 py-2.5 text-sm outline-none focus:border-primary"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={sending || !message.trim()}
                      onClick={() => void submit()}
                      className="crm-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
                    >
                      {sending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      שלח ל-{Math.min(current.count, 30).toLocaleString("he-IL")}
                    </button>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={advance}
                      className="inline-flex items-center gap-1 rounded-xl border border-outline px-3 py-2 text-xs font-semibold"
                    >
                      <SkipForward className="size-3.5" />
                      דילוג (S)
                    </button>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => void markSpam()}
                      className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800"
                    >
                      <Trash2 className="size-3.5" />
                      ספאם (D)
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
