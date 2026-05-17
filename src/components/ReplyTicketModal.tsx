"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mail, Send, X } from "lucide-react";
import type { ReplyTemplate, Ticket } from "@/lib/types";

interface ReplyTicketModalProps {
  ticket: Ticket | null;
  onClose: () => void;
  onSubmit: (message: string, options?: { closeAfterSend?: boolean }) => Promise<void>;
}

type EmailStatusHint = {
  ok: boolean;
  fromAddress?: string;
  resendFromFormatted?: string;
  hint?: string;
};

export function ReplyTicketModal({ ticket, onClose, onSubmit }: ReplyTicketModalProps) {
  const [message, setMessage] = useState("");
  const [closeAfterSend, setCloseAfterSend] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [emailStatus, setEmailStatus] = useState<EmailStatusHint | null>(null);
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

  const loadEmailStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/email-status", { cache: "no-store" });
      if (!res.ok) return;
      setEmailStatus((await res.json()) as EmailStatusHint);
    } catch {
      setEmailStatus(null);
    }
  }, []);

  useEffect(() => {
    if (!ticket) {
      setMessage("");
      setError(null);
      setCloseAfterSend(true);
      return;
    }
    setMessage("");
    setError(null);
    setCloseAfterSend(true);
    void loadTemplates();
    void loadEmailStatus();
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [ticket, loadTemplates, loadEmailStatus]);

  const handleSend = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed || isSending || !ticket) return;
    setIsSending(true);
    setError(null);
    try {
      await onSubmit(trimmed, { closeAfterSend });
      setMessage("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שליחת המענה נכשלה");
    } finally {
      setIsSending(false);
    }
  }, [message, isSending, ticket, closeAfterSend, onSubmit, onClose]);

  useEffect(() => {
    if (!ticket) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !isSending) {
        event.preventDefault();
        void handleSend();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ticket, isSending, onClose, handleSend]);

  if (!ticket) return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void handleSend();
  };

  const insertTemplate = (text: string) => {
    setMessage((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
    textareaRef.current?.focus();
  };

  const fromLine =
    emailStatus?.resendFromFormatted || emailStatus?.fromAddress || "editor@jusic.co";

  return (
    <ModalOverlay onClose={onClose}>
      <div className="relative z-10 flex max-h-[min(94dvh,94vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-outline/80 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-outline/60 px-4 py-3">
          <ModalTitle
            title="מענה ללקוח"
            subtitle={`${ticket.senderName || "לקוח"} · ${ticket.senderEmail}`}
            subject={ticket.subject}
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-outline p-2 text-on-surface-variant hover:bg-surface-container"
            aria-label="סגירה"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-3 overflow-y-auto px-4 py-3">
            <div className="rounded-xl border border-outline/70 bg-surface-container/60 px-3 py-2 text-[11px]">
              <ReplyMetaRow fromLine={fromLine} emailStatus={emailStatus} />
            </div>

            {templates.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {templates.slice(0, 6).map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    className="rounded-full border border-outline bg-white px-2.5 py-1 text-[11px] font-semibold text-on-surface hover:border-primary/40 hover:bg-primary-soft/30"
                    onClick={() => insertTemplate(tpl.body)}
                    title={tpl.body.slice(0, 120)}
                  >
                    {tpl.title || tpl.shortcut || "תבנית"}
                  </button>
                ))}
              </div>
            ) : null}

            <label className="block text-xs font-semibold text-on-surface-variant">
              נוסח המענה
              <textarea
                ref={textareaRef}
                className="mt-1.5 min-h-[11rem] w-full resize-y rounded-xl border border-outline bg-white px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder="כתוב כאן את התשובה ללקוח. Ctrl+Enter לשליחה מהירה."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                disabled={isSending}
              />
            </label>

            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-on-surface-variant">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={closeAfterSend}
                onChange={(event) => setCloseAfterSend(event.target.checked)}
                disabled={isSending}
              />
              סגור את הפנייה אחרי שליחה מוצלחת
            </label>

            {error ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
                {error}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline/60 bg-surface-high/80 px-4 py-3">
            <p className="text-[11px] text-on-surface-variant">Resend · Ctrl+Enter לשליחה</p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="lux-button min-h-10" disabled={isSending}>
                ביטול
              </button>
              <button
                type="submit"
                className="lux-button-primary min-h-10 min-w-[7.5rem]"
                disabled={isSending || !message.trim()}
              >
                {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {isSending ? "שולח…" : closeAfterSend ? "שליחה וסגירה" : "שליחה"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}

function ModalOverlay({
  children,
  onClose
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="סגור"
        onClick={onClose}
      />
      <ModalCenter>{children}</ModalCenter>
    </div>
  );
}

function ModalCenter({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 flex h-full items-end justify-center p-2 sm:items-center sm:p-4">
      {children}
    </div>
  );
}

function ModalTitle({
  title,
  subtitle,
  subject
}: {
  title: string;
  subtitle: string;
  subject: string;
}) {
  return (
    <div className="min-w-0">
      <h2 className="text-base font-bold text-on-surface">{title}</h2>
      <p className="truncate text-xs text-on-surface-variant">{subtitle}</p>
      <p className="mt-0.5 line-clamp-2 text-[11px] text-on-surface-variant">{subject}</p>
    </div>
  );
}

function ReplyMetaRow({
  fromLine,
  emailStatus
}: {
  fromLine: string;
  emailStatus: EmailStatusHint | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-on-surface-variant">
      <Mail className="size-3.5 shrink-0 text-primary" />
      <span>
        מ: <span className="font-semibold text-on-surface">{fromLine}</span>
      </span>
      {emailStatus ? (
        <span
          className={`rounded-full px-2 py-0.5 font-semibold ${
            emailStatus.ok ? "bg-success/15 text-success" : "bg-amber-100 text-amber-950"
          }`}
        >
          {emailStatus.ok ? "מוכן לשליחה" : emailStatus.hint || "בדוק Resend"}
        </span>
      ) : null}
    </div>
  );
}
