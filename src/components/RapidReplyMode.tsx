"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, RefreshCw, Send, Trash2 } from "lucide-react";
import { extractInquiryForDisplay } from "@/lib/contact-form-inquiry";
import { useRapidReplyQueue } from "@/hooks/useRapidReplyQueue";

export function RapidReplyMode() {
  const {
    current,
    detail,
    loading,
    error,
    sending,
    total,
    remaining,
    skip,
    markSpam,
    sendAndClose,
    refresh
  } = useRapidReplyQueue();

  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const ticket = detail ?? current;
  const inquiryText = ticket
    ? extractInquiryForDisplay(ticket.bodyCleaned || ticket.body || "", ticket.subject)
    : "";

  useEffect(() => {
    setMessage("");
    textareaRef.current?.focus();
  }, [ticket?.id]);

  const submit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      if (!message.trim() || sending) return;
      const ok = await sendAndClose(message);
      if (ok) setMessage("");
    },
    [message, sendAndClose, sending]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void submit();
      }
    },
    [submit]
  );

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="flex items-center gap-3 border-b border-outline/60 bg-white px-4 py-3">
        <Link
          href="/"
          className="rounded-xl border border-outline p-2 text-on-surface-variant hover:bg-surface-container"
          aria-label="חזרה"
        >
          <ArrowRight className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-on-surface">מענה מהיר</h1>
          <p className="text-[11px] text-on-surface-variant">
            Enter = שליחה וסגירה · Shift+Enter = שורה חדשה · S = דילוג · D = ספאם
          </p>
        </div>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary">
          נותרו {remaining.toLocaleString("he-IL")} / {total.toLocaleString("he-IL")}
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl border border-outline p-2"
          aria-label="רענון"
        >
          <RefreshCw className="size-4" />
        </button>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-on-surface-variant">
          <Loader2 className="size-5 animate-spin" />
          טוען תור…
        </div>
      ) : !ticket ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-sm font-semibold text-on-surface">אין פניות פתוחות בתור</p>
          <Link href="/" className="text-xs text-primary underline">
            חזרה ללוח
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-outline/50 bg-violet-50/40 px-4 py-2 text-[11px] text-on-surface-variant">
            <span className="font-semibold text-on-surface">
              {ticket.senderName || "לקוח"}
            </span>
            {" · "}
            {ticket.senderEmail}
            {ticket.subject ? ` · ${ticket.subject}` : null}
          </div>

          <section className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <p className="mb-2 text-[11px] font-bold text-violet-950">שאלת הלקוח</p>
            <div className="rounded-2xl border border-violet-200/80 bg-white p-4 text-sm leading-relaxed text-on-surface whitespace-pre-wrap">
              {inquiryText}
            </div>
          </section>

          <div className="border-t border-outline/60 bg-white p-4">
            {error ? (
              <p className="mb-2 text-xs font-semibold text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={sending}
              rows={4}
              placeholder="כתוב מענה… Enter לשליחה וסגירה"
              className="w-full resize-y rounded-2xl border border-outline bg-surface-container/30 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={sending || !message.trim()}
                className="crm-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Enter — שליחה וסגירה
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={() => skip()}
                className="rounded-xl border border-outline px-3 py-2 text-xs font-semibold"
              >
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
          </div>
        </form>
      )}

      <GlobalKeys
        enabled={!!ticket && !sending}
        onSkip={skip}
        onSpam={() => void markSpam()}
      />
    </div>
  );
}

function GlobalKeys({
  enabled,
  onSkip,
  onSpam
}: {
  enabled: boolean;
  onSkip: () => void;
  onSpam: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "TEXTAREA" || target?.tagName === "INPUT") {
        if (event.key === "s" || event.key === "S" || event.key === "ד") {
          event.preventDefault();
          onSkip();
        }
        if (event.key === "d" || event.key === "D" || event.key === "Delete") {
          event.preventDefault();
          onSpam();
        }
        return;
      }
      if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        onSkip();
      }
      if (event.key === "d" || event.key === "D") {
        event.preventDefault();
        onSpam();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onSkip, onSpam]);

  return null;
}
