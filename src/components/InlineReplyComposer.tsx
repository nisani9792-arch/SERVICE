"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useSmartCompose } from "@/hooks/useSmartCompose";
import { cn } from "@/lib/cn";
import type { Ticket } from "@/lib/types";

export type InlineReplyComposerProps = {
  ticket: Ticket;
  onSubmit: (message: string) => Promise<void>;
  onSent?: () => void;
  variant?: "inline" | "expanded";
  className?: string;
};

export function InlineReplyComposer({
  ticket,
  onSubmit,
  onSent,
  variant = "inline",
  className
}: InlineReplyComposerProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { chips, loading, refreshAiDraft } = useSmartCompose(ticket.id);

  useEffect(() => {
    setMessage("");
    setError(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [ticket.id]);

  useEffect(() => {
    const onFocus = () => textareaRef.current?.focus();
    window.addEventListener("resolution:focus-reply", onFocus);
    return () => window.removeEventListener("resolution:focus-reply", onFocus);
  }, []);

  const submit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      const trimmed = message.trim();
      if (!trimmed || sending) return;
      setSending(true);
      setError(null);
      try {
        await onSubmit(trimmed);
        setMessage("");
        onSent?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "שליחה נכשלה");
      } finally {
        setSending(false);
      }
    },
    [message, onSent, onSubmit, sending]
  );

  const onTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    void submit();
  };

  const isExpanded = variant === "expanded";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className={cn(
        "gen-reply-composer shrink-0",
        isExpanded ? "px-4 py-3" : "px-3 py-2",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-on-surface">
          <Sparkles className="size-3.5 text-primary" aria-hidden />
          מענה חכם
        </span>
        <button
          type="button"
          onClick={() => void refreshAiDraft()}
          disabled={loading}
          className="text-[10px] font-semibold text-primary hover:underline disabled:opacity-50"
        >
          {loading ? "טוען…" : "רענן AI"}
        </button>
      </div>

      {chips.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5" role="list" aria-label="הצעות מענה">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              role="listitem"
              title={chip.body.slice(0, 160)}
              onClick={() => {
                setMessage(chip.body);
                textareaRef.current?.focus();
              }}
              className={cn(
                "gen-compose-chip max-w-full truncate rounded-full px-2.5 py-1 text-[10px] font-semibold transition",
                chip.source === "ai" && "gen-compose-chip-ai"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="gen-reply-input-row flex gap-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={onTextareaKeyDown}
          rows={isExpanded ? 5 : 2}
          dir="rtl"
          disabled={sending}
          placeholder="כתוב מענה… Ctrl+Enter לשליחה"
          className="gen-reply-textarea min-h-0 flex-1 resize-none rounded-xl2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          disabled={sending || !message.trim()}
          onClick={() => void submit()}
          className="gen-reply-send inline-flex shrink-0 items-center justify-center gap-1 rounded-xl2 px-3 text-xs font-bold disabled:opacity-45"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          שלח
        </button>
      </div>
      {error ? <p className="mt-1.5 text-[10px] font-medium text-danger">{error}</p> : null}
    </form>
  );
}
