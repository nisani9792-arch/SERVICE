"use client";

import { useCallback, useRef, useState } from "react";
import { Archive, ShieldBan } from "lucide-react";
import { hapticTap } from "@/lib/haptics";
import { CategoryBadge } from "@/components/CategoryBadge";
import { listInquiryPreview } from "@/lib/inquiry-preview";
import { displayTicketDate } from "@/lib/ticket-row";
import { formatTicketNumber } from "@/lib/ticket-sequence";
import type { Ticket } from "@/lib/types";

const SWIPE_THRESHOLD = 72;

type FocusTriageCardProps = {
  ticket: Ticket;
  detail: Ticket | null;
  stackIndex: number;
  isTop: boolean;
  busy?: boolean;
  /** Full-height mobile card — hides inline action row (FAB only). */
  tall?: boolean;
  onArchive: () => void;
  onDelete: () => void;
  onSpam: () => void;
  onReply: () => void;
};

export function FocusTriageCard({
  ticket,
  detail,
  stackIndex,
  isTop,
  busy,
  tall = false,
  onArchive,
  onDelete,
  onSpam,
  onReply
}: FocusTriageCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, y: 0, active: false });

  const preview = listInquiryPreview(detail ?? ticket, 520);
  const scale = 1 - stackIndex * 0.04;
  const yOffset = stackIndex * 10;

  const onPointerDown = (event: React.PointerEvent) => {
    if (!isTop || busy) return;
    startRef.current = { x: event.clientX, y: event.clientY, active: true };
    setDragging(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!startRef.current.active) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
      event.preventDefault();
    }
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
    if (!startRef.current.active || !isTop || busy) return;
    const dx = offsetX;
    const dy = offsetY;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx > 0) {
        hapticTap();
        onArchive();
      } else {
        hapticTap([8, 32, 8]);
        onSpam();
      }
    } else if (dy > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
      hapticTap();
      onReply();
    }

    resetDrag();
  };

  const archiveTint =
    offsetX > SWIPE_THRESHOLD * 0.5 ? "ring-2 ring-emerald-400 bg-emerald-50/80" : "";
  const spamTint =
    offsetX < -SWIPE_THRESHOLD * 0.5 ? "ring-2 ring-amber-400 bg-amber-50/80" : "";
  const replyTint =
    offsetY > SWIPE_THRESHOLD * 0.5 ? "ring-2 ring-primary/40 bg-primary-soft/40" : "";

  return (
    <article
      className={`absolute inset-x-0 mx-auto w-full max-w-md select-none ${
        isTop ? "z-20" : "z-10 pointer-events-none"
      }`}
      style={{
        transform: `translateY(${yOffset}px) scale(${scale})${
          isTop && dragging
            ? ` translate(${offsetX}px, ${offsetY}px) rotate(${offsetX * 0.04}deg)`
            : ""
        }`,
        transition: dragging ? "none" : "transform 0.25s var(--crm-ease)"
      }}
    >
      {isTop ? (
        <>
          <div
            className="pointer-events-none absolute inset-2 z-0 flex items-center justify-start rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/80 ps-6 opacity-0 transition-opacity"
            style={{ opacity: Math.min(1, Math.max(0, offsetX / SWIPE_THRESHOLD)) }}
          >
            <Archive className="size-8 text-emerald-600" />
          </div>
          <div
            className="pointer-events-none absolute inset-2 z-0 flex items-center justify-end rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50/80 pe-6"
            style={{ opacity: Math.min(1, Math.max(0, -offsetX / SWIPE_THRESHOLD)) }}
          >
            <ShieldBan className="size-8 text-amber-700" />
          </div>
          <div className="crm-swipe-hint pointer-events-none absolute inset-x-4 top-1 z-30 flex justify-between text-[10px] font-bold">
            <span className="text-amber-800">← ספאם</span>
            <span className="text-emerald-700">ארכיון →</span>
          </div>
        </>
      ) : null}

      <div
        className={`glass-panel-strong relative z-10 overflow-hidden rounded-3xl border border-outline/60 p-4 shadow-xl touch-pan-y ${
          busy ? "opacity-60" : ""
        } ${archiveTint} ${spamTint} ${replyTint}`}
        onPointerDown={isTop ? onPointerDown : undefined}
        onPointerMove={isTop ? onPointerMove : undefined}
        onPointerUp={isTop ? onPointerUp : undefined}
        onPointerCancel={isTop ? resetDrag : undefined}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {ticket.ticketNumber != null ? (
              <span className="rounded-md bg-primary-soft/50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                {formatTicketNumber(ticket.ticketNumber)}
              </span>
            ) : null}
            <CategoryBadge category={ticket.category} />
          </div>
          <span className="text-[10px] text-on-surface-variant">
            {displayTicketDate(ticket).toLocaleString("he-IL", {
              dateStyle: "short",
              timeStyle: "short"
            })}
          </span>
        </div>

        <p className="mb-1 truncate text-xs font-bold text-on-surface">{ticket.senderEmail}</p>
        <h2 className="mb-2 text-base font-bold leading-snug text-on-surface">{ticket.subject}</h2>
        <p
          className={`overflow-y-auto text-sm leading-relaxed text-on-surface ${
            tall ? "max-h-[42dvh]" : "mb-4 max-h-48"
          }`}
        >
          {preview}
        </p>

        {isTop && tall ? (
          <p className="mt-2 text-center text-[10px] text-on-surface-variant">
            סוויפ ימין = ארכיון · שמאל = ספאם · למטה = מענה
          </p>
        ) : null}

        {isTop && !tall ? (
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="crm-touch-target rounded-xl border border-rose-200 bg-rose-50 py-2 text-[10px] font-bold text-rose-800"
            >
              מחק
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onSpam}
              className="crm-touch-target rounded-xl border border-amber-200 bg-amber-50 py-2 text-[10px] font-bold text-amber-900"
            >
              ספאם
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onArchive}
              className="crm-touch-target rounded-xl border border-emerald-200 bg-emerald-50 py-2 text-[10px] font-bold text-emerald-900"
            >
              ארכיון
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
