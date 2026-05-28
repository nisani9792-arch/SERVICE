"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { sendTicketReply } from "@/lib/firebase";
import { cn } from "@/lib/cn";
import type { Ticket } from "@/lib/types";

interface QuickReplyBarProps {
  ticket: Ticket | null;
  onSent: () => void;
  onCancel?: () => void;
  onSubmit?: (message: string) => Promise<void>;
  variant?: "default" | "workbench";
}

export function QuickReplyBar({
  ticket,
  onSent,
  onCancel,
  onSubmit,
  variant = "default"
}: QuickReplyBarProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Array<{ id: string; title: string; body: string }>>(
    []
  );

  const isWorkbench = variant === "workbench";

  useEffect(() => {
    if (!ticket) {
      setMessage("");
      setError(null);
      return;
    }
    void (async () => {
      try {
        const tplRes = await fetch("/api/reply-templates", { cache: "no-store" });
        if (tplRes.ok) {
          const data = (await tplRes.json()) as {
            items: Array<{ id: string; title: string; body: string }>;
          };
          setTemplates(data.items ?? []);
        }
      } catch {
        setTemplates([]);
      }
    })();
  }, [ticket]);

  const submit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      if (!ticket || !message.trim() || sending) return;
      setSending(true);
      setError(null);
      try {
        if (onSubmit) {
          await onSubmit(message.trim());
        } else {
          await sendTicketReply(ticket.id, message.trim());
        }
        setMessage("");
        onSent();
      } catch (err) {
        setError(err instanceof Error ? err.message : "שליחה נכשלה");
      } finally {
        setSending(false);
      }
    },
    [message, onSent, onSubmit, sending, ticket]
  );

  if (!ticket) return null;

  const onTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    void submit();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
      }}
      className={cn(
        isWorkbench
          ? "crm-quick-reply-workbench shrink-0 px-3 py-2"
          : "crm-triage-reply border-t border-outline/70 bg-white p-3"
      )}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "text-[11px] font-bold",
            isWorkbench ? "text-slate-700" : "text-on-surface"
          )}
        >
          מענה מהיר
        </span>
        {templates.slice(0, 4).map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => setMessage(tpl.body)}
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[9px] font-semibold transition",
              isWorkbench
                ? "border-slate-200 bg-white text-indigo-700 hover:bg-indigo-50"
                : "border-outline text-primary hover:bg-primary-soft/30"
            )}
          >
            {tpl.title}
          </button>
        ))}
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className={cn(
              "mr-auto text-[10px]",
              isWorkbench ? "text-slate-500" : "text-on-surface-variant"
            )}
          >
            סגור
          </button>
        ) : null}
      </div>
      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={onTextareaKeyDown}
          rows={isWorkbench ? 2 : 3}
          dir="rtl"
          enterKeyHint="enter"
          placeholder="כתוב תשובה… Ctrl+Enter לשליחה"
          className={cn(
            "min-h-0 flex-1 resize-none rounded-xl border px-2.5 py-2 text-sm outline-none focus:ring-2",
            isWorkbench
              ? "border-slate-200 bg-white focus:border-indigo-400 focus:ring-indigo-100"
              : "crm-input"
          )}
        />
        <button
          type="button"
          disabled={sending || !message.trim()}
          onClick={() => void submit()}
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-1 rounded-xl px-3 text-xs font-bold disabled:opacity-45",
            isWorkbench
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "crm-btn-primary"
          )}
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          שלח
        </button>
      </div>
      {error ? <p className="mt-1 text-[10px] text-red-600">{error}</p> : null}
    </form>
  );
}
