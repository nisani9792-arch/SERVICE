"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail, Send, X } from "lucide-react";
import { CustomerFollowUpDisplay } from "@/components/CustomerFollowUpDisplay";
import { hasCustomerFollowUp } from "@/lib/customer-followup-text";
import type { ReplyTemplate, Ticket } from "@/lib/types";

interface ReplyTicketModalProps {
  ticket: Ticket | null;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
}

type EmailStatusHint = {
  ok: boolean;
  fromAddress?: string;
  fromFormatted?: string;
  hint?: string;
  replyViaSmtpFallback?: boolean;
  missingGmailEnv?: string[];
  gmailEnv?: { clientId: boolean; clientSecret: boolean; refreshToken: boolean };
};

export function ReplyTicketModal({ ticket, onClose, onSubmit }: ReplyTicketModalProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [emailStatus, setEmailStatus] = useState<EmailStatusHint | null>(null);
  const [signatureOpening, setSignatureOpening] = useState("");
  const [signatureClosing, setSignatureClosing] = useState("");
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
      const [statusRes, sigRes] = await Promise.all([
        fetch("/api/email-status", { cache: "no-store", credentials: "same-origin" }),
        fetch("/api/reply-signature", { cache: "no-store", credentials: "same-origin" })
      ]);
      if (statusRes.ok) {
        setEmailStatus((await statusRes.json()) as EmailStatusHint);
      }
      if (sigRes.ok) {
        const data = (await sigRes.json()) as {
          signature: { opening: string; closing: string };
        };
        setSignatureOpening(data.signature.opening ?? "");
        setSignatureClosing(data.signature.closing ?? "");
      }
    } catch {
      setEmailStatus(null);
    }
  }, []);

  useEffect(() => {
    if (!ticket) {
      setMessage("");
      setError(null);
      return;
    }
    setMessage("");
    setError(null);
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
      await onSubmit(trimmed);
      setMessage("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שליחת המענה נכשלה");
    } finally {
      setIsSending(false);
    }
  }, [message, isSending, ticket, onSubmit, onClose]);

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
    emailStatus?.fromFormatted || emailStatus?.fromAddress || "editor@jusic.co";

  return (
    <ModalOverlay onClose={onClose}>
      <motion.div
        className="glass-panel-strong relative z-10 flex max-h-[min(94dvh,94vh)] w-full max-w-2xl flex-col overflow-hidden"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 30 }}
      >
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

            {hasCustomerFollowUp(ticket.body || "") ? (
              <CustomerFollowUpDisplay body={ticket.body || ""} variant="light" showHistory />
            ) : ticket.body ? (
              <div className="rounded-xl border border-outline/70 bg-surface-container/40 p-3">
                <p className="mb-1.5 text-[11px] font-bold text-on-surface-variant">תוכן הפנייה</p>
                <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-on-surface">
                  {ticket.body}
                </p>
              </div>
            ) : null}

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
              {signatureOpening ? (
                <p className="mt-1.5 rounded-lg border border-outline/60 bg-surface-container/80 px-3 py-2 text-sm text-on-surface-variant">
                  {signatureOpening}
                </p>
              ) : null}
              <textarea
                ref={textareaRef}
                className="mt-1.5 min-h-[9rem] w-full resize-y rounded-xl border border-outline bg-white px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder="כתוב כאן את גוף התשובה. פתיחה וסיום יתווספו אוטומטית. Ctrl+Enter לשליחה."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                disabled={isSending}
              />
              {signatureClosing ? (
                <p className="mt-1.5 rounded-lg border border-outline/60 bg-surface-container/80 px-3 py-2 text-sm text-on-surface-variant">
                  {signatureClosing}
                </p>
              ) : null}
            </label>

            {error ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
                {error}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline/60 bg-surface-high/80 px-4 py-3">
            <p className="text-[11px] text-on-surface-variant">
              {emailStatus?.replyViaSmtpFallback
                ? "SMTP (גיבוי) · Ctrl+Enter"
                : emailStatus?.ok
                  ? "Gmail API · Ctrl+Enter"
                  : "Ctrl+Enter לשליחה"}
            </p>
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
                {isSending ? "שולח…" : "שליחה וסגירה"}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
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
          {emailStatus.ok
            ? emailStatus.replyViaSmtpFallback
              ? "SMTP (גיבוי)"
              : "מוכן לשליחה"
            : emailStatus.hint ||
              (emailStatus.missingGmailEnv?.length
                ? `חסר: ${emailStatus.missingGmailEnv.join(", ")}`
                : "בדוק Gmail API ב-Render")}
        </span>
      ) : null}
    </div>
  );
}
