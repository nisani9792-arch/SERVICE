"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import type { ReplyTemplate } from "@/lib/types";

interface BulkReplyModalProps {
  isOpen: boolean;
  count: number;
  onClose: () => void;
  onSubmit: (message: string, options?: { closeAfterSend?: boolean }) => Promise<void>;
}

export function BulkReplyModal({ isOpen, count, onClose, onSubmit }: BulkReplyModalProps) {
  const [message, setMessage] = useState("");
  const [closeAfterSend, setCloseAfterSend] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/reply-templates", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: ReplyTemplate[] };
      setTemplates(data.items ?? []);
    } catch {
      setTemplates([]);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setMessage("");
    setError(null);
    setCloseAfterSend(true);
    void loadTemplates();
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [isOpen, loadTemplates]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || isSending) return;
    if (
      !window.confirm(
        `לשלוח את אותו מענה ל-${count.toLocaleString("he-IL")} לקוחות? פעולה זו לא ניתנת לביטול.`
      )
    ) {
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      await onSubmit(trimmed, { closeAfterSend });
      setMessage("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שליחה מרובה נכשלה");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="סגור" onClick={onClose} />
      <ModalCenter>
        <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-outline/80 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-outline/60 px-4 py-3">
            <div>
              <h2 className="text-base font-bold">מענה מרובה</h2>
              <p className="text-xs text-on-surface-variant">
                {count.toLocaleString("he-IL")} פניות · אותו נוסח לכל הנמענים
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl border border-outline p-2" aria-label="סגור">
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 px-4 py-3">
            {templates.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {templates.slice(0, 5).map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    className="rounded-full border border-outline bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-primary-soft/30"
                    onClick={() =>
                      setMessage((prev) => (prev.trim() ? `${prev.trim()}\n\n${tpl.body}` : tpl.body))
                    }
                  >
                    {tpl.title || "תבנית"}
                  </button>
                ))}
              </div>
            ) : null}

            <textarea
              ref={textareaRef}
              className="min-h-[10rem] w-full rounded-xl border border-outline px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="נוסח המענה לכל הלקוחות שנבחרו"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSending}
            />

            <label className="inline-flex items-center gap-2 text-xs text-on-surface-variant">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={closeAfterSend}
                onChange={(e) => setCloseAfterSend(e.target.checked)}
                disabled={isSending}
              />
              סגור פניות אחרי שליחה
            </label>

            {error ? (
              <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pb-1">
              <button type="button" className="lux-button" onClick={onClose} disabled={isSending}>
                ביטול
              </button>
              <button type="submit" className="lux-button-primary" disabled={isSending || !message.trim()}>
                {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {isSending ? "שולח…" : closeAfterSend ? "שלח וסגור הכל" : "שלח לכולם"}
              </button>
            </div>
          </form>
        </div>
      </ModalCenter>
    </div>
  );
}

function ModalCenter({ children }: { children: React.ReactNode }) {
  return <div className="relative z-10 flex h-full items-center justify-center p-3">{children}</div>;
}
