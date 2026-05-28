"use client";

import { useCallback, useRef, useState } from "react";
import { Check, MessageSquare, ShieldBan, SkipForward } from "lucide-react";
import { CompactCategoryChip } from "@/components/crm/CompactCategoryChip";
import { CustomerFollowUpDisplay } from "@/components/CustomerFollowUpDisplay";
import { TriageAssignBar } from "@/components/TriageAssignBar";
import { categoryLabel } from "@/lib/categories";
import { hasCustomerFollowUp } from "@/lib/customer-followup-text";
import { displayTicketDate } from "@/lib/ticket-row";
import { formatTicketNumber } from "@/lib/ticket-sequence";
import { cn } from "@/lib/cn";
import type { Ticket } from "@/lib/types";

const SWIPE_THRESHOLD = 64;

interface TriageCardProps {
  ticket: Ticket;
  detail: Ticket | null;
  busy?: boolean;
  onApprove: () => void;
  onSpam: () => void;
  onSkip: () => void;
  onReplyOpen: () => void;
  onAssign: (category: string) => void;
}

function inquiryBody(ticket: Ticket, detail: Ticket | null): string {
  return (detail?.bodyCleaned || detail?.body || ticket.body || ticket.aiSummary || "").trim();
}

export function TriageCard({
  ticket,
  detail,
  busy,
  onApprove,
  onSpam,
  onSkip,
  onReplyOpen,
  onAssign
}: TriageCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, y: 0, active: false });

  const body = inquiryBody(ticket, detail);
  const followUp = hasCustomerFollowUp(body);
  const suggested = ticket.aiSuggestedCategory;
  const confidence = ticket.classificationConfidence;
  const confidencePct =
    confidence != null ? Math.round(Math.min(100, Math.max(0, confidence * 100))) : null;

  const onPointerDown = (event: React.PointerEvent) => {
    if ((event.target as HTMLElement).closest("button, select, textarea, input")) return;
    startRef.current = { x: event.clientX, y: event.clientY, active: true };
    setDragging(true);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!startRef.current.active) return;
    setOffsetX(event.clientX - startRef.current.x);
    setOffsetY(event.clientY - startRef.current.y);
  };

  const resetDrag = useCallback(() => {
    startRef.current.active = false;
    setDragging(false);
    setOffsetX(0);
    setOffsetY(0);
  }, []);

  const onPointerUp = () => {
    if (!startRef.current.active) return;
    const dx = offsetX;
    const dy = offsetY;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx > 0) {
        if (suggested) onApprove();
        else onSkip();
      } else {
        onSpam();
      }
      navigator.vibrate?.(10);
    } else if (dy < -SWIPE_THRESHOLD) {
      onSkip();
    } else if (dy > SWIPE_THRESHOLD) {
      onReplyOpen();
    }
    resetDrag();
  };

  return (
    <div className="relative mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col px-2">
      <article
        className={cn(
          "crm-triage-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm",
          busy && "opacity-60",
          offsetX > SWIPE_THRESHOLD * 0.5 && "ring-2 ring-emerald-300",
          offsetX < -SWIPE_THRESHOLD * 0.5 && "ring-2 ring-rose-300"
        )}
        style={{
          transform: dragging ? `translate(${offsetX}px, ${offsetY}px)` : undefined,
          transition: dragging ? "none" : "transform 0.2s ease"
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={resetDrag}
      >
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
          {ticket.ticketNumber != null ? (
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-700">
              {formatTicketNumber(ticket.ticketNumber)}
            </span>
          ) : null}
          <CompactCategoryChip category={ticket.category} />
          <span className="ms-auto text-[10px] tabular-nums text-slate-400">
            {displayTicketDate(ticket).toLocaleString("he-IL", {
              dateStyle: "short",
              timeStyle: "short"
            })}
          </span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <h2 className="mb-0.5 text-sm font-bold leading-snug text-slate-900">{ticket.subject}</h2>
          <p className="mb-2 text-[11px] text-slate-500">
            {ticket.senderName || "ללא שם"} · {ticket.senderEmail || "ללא אימייל"}
          </p>

          {followUp ? (
            <div className="mb-2">
              <CustomerFollowUpDisplay body={body} variant="light" showHistory />
            </div>
          ) : null}

          <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-[13px] leading-relaxed text-slate-800">
            {body || "אין תוכן"}
          </div>

          {suggested ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5">
              <span className="text-[10px] font-bold text-emerald-800">AI</span>
              <CompactCategoryChip category={suggested} />
              <span className="text-[11px] font-semibold text-emerald-900">
                {categoryLabel(suggested)}
              </span>
              {confidencePct != null ? (
                <span className="text-[10px] text-emerald-700">{confidencePct}%</span>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={onApprove}
                className="ms-auto inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                title="Enter"
              >
                <Check className="size-3" />
                אשר
                <kbd className="rounded bg-emerald-500 px-1 font-mono text-[9px]">↵</kbd>
              </button>
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-slate-500">
              {ticket.aiSummary || "אין הצעת AI — בחר קטגוריה (1–8)"}
            </p>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-100 bg-slate-50/50 px-3 py-2">
          <div className="mb-2 flex flex-wrap gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={onSpam}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-900"
            >
              <ShieldBan className="size-3" />
              ספאם
              <kbd className="rounded bg-amber-100 px-1 font-mono text-[9px]">S</kbd>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onSkip}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700"
            >
              <SkipForward className="size-3" />
              דילוג
              <kbd className="rounded bg-slate-100 px-1 font-mono text-[9px]">␣</kbd>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onReplyOpen}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-800"
            >
              <MessageSquare className="size-3" />
              מענה
              <kbd className="rounded bg-indigo-100 px-1 font-mono text-[9px]">R</kbd>
            </button>
          </div>
          <TriageAssignBar compact disabled={busy} onAssign={onAssign} />
        </footer>
      </article>

      <p className="mt-1 text-center text-[9px] text-slate-400 md:hidden">
        סוויפ: ימין אישור · שמאל ספאם · למעלה דילוג · למטה מענה
      </p>
    </div>
  );
}
