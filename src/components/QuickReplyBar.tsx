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

export function QuickReplyBar({ ticket, onSent, onCancel }: QuickReplyBarProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Array<{ id: string; title: string; body: string }>>(
    []
  );

  useEffect(() => {
    if (!ticket) {
      setMessage("");
      setError(null);
      return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/reply-templates", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { items: Array<{ id: string; title: string; body: string }> };
        setTemplates(data.items ?? []);
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

  return (
    <form onSubmit={submit} className="crm-triage-reply border-t border-outline/70 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-on-surface">תשובה מהירה</span>
        {templates.slice(0, 4).map((tpl) => (
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
        rows={3}
        dir="rtl"
        placeholder="כתוב תשובה..."
        className="crm-input mb-2 resize-none text-sm"
      />
      {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={sending || !message.trim()}
        className="crm-btn-primary w-full gap-2"
      >
        {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        שלח תשובה
      </button>
    </form>
  );
}
