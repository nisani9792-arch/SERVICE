"use client";

import { useCallback, useRef, useState } from "react";
import { CategoryBadge } from "@/components/CategoryBadge";
import { TriageAssignBar } from "@/components/TriageAssignBar";
import { categoryLabel } from "@/lib/categories";
import { displayTicketDate } from "@/lib/ticket-row";
import { formatTicketNumber } from "@/lib/ticket-sequence";
import type { Ticket } from "@/lib/types";

const SWIPE_THRESHOLD = 72;

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

function bodyPreview(ticket: Ticket, detail: Ticket | null): string {
  const raw = detail?.bodyCleaned || detail?.body || ticket.body || ticket.aiSummary || "";
  return raw.replace(/\s+/g, " ").trim().slice(0, 480);
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

  const suggested = ticket.aiSuggestedCategory;
  const confidence = ticket.classificationConfidence;
  const confidencePct =
    confidence != null ? Math.round(Math.min(100, Math.max(0, confidence * 100))) : null;

  const onPointerDown = (event: React.PointerEvent) => {
    startRef.current = { x: event.clientX, y: event.clientY, active: true };
    setDragging(true);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!startRef.current.active) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    setOffsetX(dx);
    setOffsetY(dy);
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
      // RTL: swipe right (positive dx) = approve
      if (dx > 0) {
        if (suggested) onApprove();
        else onSkip();
      } else {
        onSpam();
      }
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } else if (dy < -SWIPE_THRESHOLD) {
      onSkip();
    } else if (dy > SWIPE_THRESHOLD) {
      onReplyOpen();
    }

    resetDrag();
  };

  const approveTint =
    offsetX > SWIPE_THRESHOLD * 0.5 ? "ring-2 ring-emerald-400 bg-emerald-50/80" : "";
  const spamTint =
    offsetX < -SWIPE_THRESHOLD * 0.5 ? "ring-2 ring-red-400 bg-red-50/80" : "";

  return (
    <div className="relative mx-auto w-full max-w-xl px-2">
      <div className="crm-swipe-hint pointer-events-none absolute inset-x-4 top-2 z-0 flex justify-between text-[10px] font-bold">
        <span className="text-red-600">← ספאם</span>
        <span className="text-emerald-600">אישור AI →</span>
      </div>

      <article
        className={`crm-triage-card relative z-10 touch-pan-y rounded-2xl border border-outline/80 bg-white p-4 shadow-lg transition-shadow ${approveTint} ${spamTint} ${busy ? "opacity-60" : ""}`}
        style={{
          transform: dragging
            ? `translate(${offsetX}px, ${offsetY}px) rotate(${offsetX * 0.02}deg)`
            : undefined,
          transition: dragging ? "none" : "transform 0.25s var(--crm-ease)"
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={resetDrag}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {ticket.ticketNumber != null ? (
              <span className="rounded-md bg-primary-soft/50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                {formatTicketNumber(ticket.ticketNumber)}
              </span>
            ) : null}
            <CategoryBadge category={ticket.category} />
          </div>
          <span className="text-[11px] text-on-surface-variant">
            {displayTicketDate(ticket).toLocaleString("he-IL", {
              dateStyle: "short",
              timeStyle: "short"
            })}
          </span>
        </div>

        <h2 className="mb-1 text-base font-bold leading-snug text-on-surface">{ticket.subject}</h2>
        <p className="mb-2 text-xs text-on-surface-variant">
          {ticket.senderName || "ללא שם"} · {ticket.senderEmail}
        </p>
        <p className="mb-3 line-clamp-4 text-sm leading-relaxed text-on-surface">
          {bodyPreview(ticket, detail)}
        </p>

        {suggested ? (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
            <p className="mb-1 text-[11px] font-bold text-emerald-900">הצעת AI</p>
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={suggested} />
              <span className="text-xs font-semibold text-emerald-900">
                {categoryLabel(suggested)}
              </span>
              {confidencePct != null ? (
                <span className="text-[10px] text-emerald-800">{confidencePct}% ביטחון</span>
              ) : null}
            </div>
            {confidencePct != null ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mb-3 rounded-lg bg-surface-container px-2 py-1.5 text-xs text-on-surface-variant">
            {ticket.aiSummary || "אין הצעת AI — בחר קטגוריה ידנית"}
          </p>
        )}

        <TriageAssignBar disabled={busy} onAssign={onAssign} />

        <p className="mt-3 text-center text-[10px] text-on-surface-variant md:hidden">
          סוויפ ימין = אישור · שמאל = ספאם · למעלה = דילוג · למטה = תשובה
        </p>
      </article>
    </div>
  );
}
