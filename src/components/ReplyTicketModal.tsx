"use client";

import { X } from "lucide-react";
import { motion } from "framer-motion";
import { CustomerFollowUpDisplay } from "@/components/CustomerFollowUpDisplay";
import { InlineReplyComposer } from "@/components/InlineReplyComposer";
import { hasCustomerFollowUp } from "@/lib/customer-followup-text";
import type { Ticket } from "@/lib/types";

interface ReplyTicketModalProps {
  ticket: Ticket | null;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
}

export function ReplyTicketModal({ ticket, onClose, onSubmit }: ReplyTicketModalProps) {
  if (!ticket) return null;

  return (
    <div className="fixed inset-0 z-modal">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="סגור"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-full items-end justify-center p-2 sm:items-center sm:p-4">
        <motion.div
          className="gen-surface-strong relative flex max-h-[min(94dvh,94vh)] w-full max-w-2xl flex-col overflow-hidden rounded-xl3 shadow-float"
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 360, damping: 30 }}
        >
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-on-surface">מענה ללקוח</h2>
              <p className="truncate text-xs text-on-surface-variant">
                {ticket.senderName || "לקוח"} · {ticket.senderEmail}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-on-surface-variant">
                {ticket.subject}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl2 bg-surface-container p-2 text-on-surface-variant hover:bg-primary-soft/40"
              aria-label="סגירה"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-2">
            {hasCustomerFollowUp(ticket.body || "") ? (
              <CustomerFollowUpDisplay body={ticket.body || ""} variant="light" showHistory />
            ) : ticket.body ? (
              <div className="gen-panel !p-3">
                <p className="mb-1.5 text-[11px] font-bold text-on-surface-variant">תוכן הפנייה</p>
                <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-on-surface">
                  {ticket.body}
                </p>
              </div>
            ) : null}
          </div>

          <InlineReplyComposer
            ticket={ticket}
            variant="expanded"
            onSubmit={async (message) => {
              await onSubmit(message);
              onClose();
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
