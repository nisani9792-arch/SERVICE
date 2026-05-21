"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { sendTicketReply } from "@/lib/firebase";
import type { Ticket } from "@/lib/types";

interface QuickReplyBarProps {
  ticket: Ticket | null;
  onSent: () => void;
  onCancel: () => void;
}

type Suggestion = {
  id: string;
  subject: string;
  inquirySnippet: string;
  replyText: string;
  matchReason: string;
  recurring: boolean;
};

export function QuickReplyBar({ ticket, onSent, onCancel }: QuickReplyBarProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Array<{ id: string; title: string; body: string }>>(
    []
  );
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (!ticket) {
      setMessage("");
      setError(null);
      setSuggestions([]);
      return;
    }
    void (async () => {
      try {
        const [tplRes, sugRes] = await Promise.all([
          fetch("/api/reply-templates", { cache: "no-store" }),
          fetch(`/api/tickets/${ticket.id}/reply-suggestions`, {
            cache: "no-store",
            credentials: "same-origin"
          })
        ]);
        if (tplRes.ok) {
          const data = (await tplRes.json()) as {
            items: Array<{ id: string; title: string; body: string }>;
          };
          setTemplates(data.items ?? []);
        }
        if (sugRes.ok) {
          const data = (await sugRes.json()) as { suggestions: Suggestion[] };
          setSuggestions(data.suggestions ?? []);
        } else {
          setSuggestions([]);
        }
      } catch {
        setTemplates([]);
        setSuggestions([]);
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
        await sendTicketReply(ticket.id, message.trim());
        setMessage("");
        onSent();
      } catch (err) {
        setError(err instanceof Error ? err.message : "שליחה נכשלה");
      } finally {
        setSending(false);
      }
    },
    [message, onSent, sending, ticket]
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
      className="crm-triage-reply border-t border-outline/70 bg-white p-3"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-on-surface">תשובה מהירה</span>
        {suggestions.slice(0, 3).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMessage(item.replyText)}
            title={`${item.matchReason}\nפנייה: ${item.inquirySnippet}`}
            className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-950 hover:bg-violet-100"
          >
            {item.recurring ? "חוזר" : "רלוונטי"}: {item.replyText.slice(0, 36)}
            {item.replyText.length > 36 ? "…" : ""}
          </button>
        ))}
        {templates.slice(0, 3).map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => setMessage(tpl.body)}
            className="rounded-lg border border-outline px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary-soft/30"
          >
            {tpl.title}
          </button>
        ))}
        <button type="button" onClick={onCancel} className="mr-auto text-[10px] text-on-surface-variant">
          סגור
        </button>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={onTextareaKeyDown}
        rows={3}
        dir="rtl"
        enterKeyHint="enter"
        placeholder="כתוב תשובה… Ctrl+Enter לשליחה (פתיחה וסיום אוטומטיים)"
        className="crm-input mb-2 resize-none text-sm"
      />
      {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
      <button
        type="button"
        disabled={sending || !message.trim()}
        onClick={() => void submit()}
        className="crm-btn-primary w-full gap-2"
      >
        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        שלח תשובה
      </button>
    </form>
  );
}
