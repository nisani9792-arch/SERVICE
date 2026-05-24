"use client";

import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { Archive, ShieldBan } from "lucide-react";
import { hapticTap } from "@/lib/haptics";
import { CategoryBadge } from "@/components/CategoryBadge";
import { listInquiryPreview } from "@/lib/inquiry-preview";
import { displayTicketDate } from "@/lib/ticket-row";
import { formatTicketNumber } from "@/lib/ticket-sequence";
import type { Ticket } from "@/lib/types";

const SWIPE_THRESHOLD = 100;

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
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-8, 8]);
  const archiveOpacity = useTransform(x, [40, 120], [0, 1]);
  const spamOpacity = useTransform(x, [-120, -40], [1, 0]);

  const preview = listInquiryPreview(detail ?? ticket, 520);
  const scale = 1 - stackIndex * 0.04;
  const yOffset = stackIndex * 10;

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (!isTop || busy) return;
    const dx = info.offset.x;
    if (dx > SWIPE_THRESHOLD) {
      hapticTap();
      onArchive();
      return;
    }
    if (dx < -SWIPE_THRESHOLD) {
      hapticTap([8, 32, 8]);
      onSpam();
      return;
    }
    if (info.offset.y > SWIPE_THRESHOLD) {
      hapticTap();
      onReply();
    }
  };

  return (
    <motion.article
      className={`absolute inset-x-0 mx-auto w-full max-w-md ${isTop ? "z-20" : "z-10 pointer-events-none"}`}
      style={{
        scale,
        y: yOffset,
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0
      }}
      drag={isTop && !busy ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      whileTap={isTop ? { scale: scale * 0.98 } : undefined}
    >
      {isTop ? (
        <>
          <motion.div
            style={{ opacity: archiveOpacity }}
            className="pointer-events-none absolute inset-2 z-0 flex items-center justify-start rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/80 ps-6"
          >
            <Archive className="size-8 text-emerald-600" />
          </motion.div>
          <motion.div
            style={{ opacity: spamOpacity }}
            className="pointer-events-none absolute inset-2 z-0 flex items-center justify-end rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50/80 pe-6"
          >
            <ShieldBan className="size-8 text-amber-700" />
          </motion.div>
        </>
      ) : null}

      <div
        className={`glass-panel-strong relative z-10 overflow-hidden rounded-3xl border border-outline/60 p-4 shadow-xl ${
          busy ? "opacity-60" : ""
        }`}
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
            tall ? "max-h-[50dvh]" : "mb-4 max-h-48"
          }`}
        >
          {preview}
        </p>

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
    </motion.article>
  );
}
