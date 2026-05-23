"use client";

import { Inbox, Layers, LayoutGrid, Mail, MessageSquareReply } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface MobileDockProps {
  onSyncMail: () => void;
  onTriage: () => void;
  onAnswerBundles: () => void;
  onReview?: () => void;
  emailSyncing: boolean;
  triageCount: number;
  bundleCount: number;
  activeReview?: boolean;
}

export function MobileDock({
  onSyncMail,
  onTriage,
  onAnswerBundles,
  onReview,
  emailSyncing,
  triageCount,
  bundleCount,
  activeReview = false
}: MobileDockProps) {
  return (
    <nav className="crm-mobile-dock" aria-label="פעולות מהירות">
      <div className="mx-auto flex max-w-lg items-center justify-around gap-0.5">
        <motion.button
          type="button"
          onClick={onSyncMail}
          disabled={emailSyncing}
          className="crm-touch-target flex flex-col items-center gap-0.5 text-[10px] font-semibold text-on-surface-variant"
          whileTap={{ scale: 0.92 }}
        >
          <Mail className={cn("size-5", emailSyncing && "animate-pulse text-primary")} />
          {emailSyncing ? "מסנכרן" : "מייל"}
        </motion.button>
        <motion.button
          type="button"
          onClick={onTriage}
          className="crm-touch-target relative flex flex-col items-center gap-0.5 text-[10px] font-semibold text-fuchsia-800"
          whileTap={{ scale: 0.92 }}
        >
          <Inbox className="size-5" />
          מיון
          {triageCount > 0 ? (
            <span className="absolute -top-1 left-1/2 min-w-[1.1rem] -translate-x-1/2 rounded-full bg-fuchsia-600 px-1 text-[9px] font-bold text-white">
              {triageCount > 99 ? "99+" : triageCount}
            </span>
          ) : null}
        </motion.button>
        {onReview ? (
          <motion.button
            type="button"
            onClick={onReview}
            className={cn(
              "crm-touch-target flex flex-col items-center gap-0.5 text-[10px] font-semibold",
              activeReview ? "text-primary" : "text-sky-800"
            )}
            whileTap={{ scale: 0.92 }}
          >
            <LayoutGrid className="size-5" />
            סריקה
          </motion.button>
        ) : null}
        <motion.button
          type="button"
          onClick={onAnswerBundles}
          className="crm-touch-target relative flex flex-col items-center gap-0.5 text-[10px] font-semibold text-emerald-800"
          whileTap={{ scale: 0.92 }}
        >
          <MessageSquareReply className="size-5" />
          מענה
          {bundleCount > 0 ? (
            <span className="absolute -top-1 left-1/2 min-w-[1.1rem] -translate-x-1/2 rounded-full bg-emerald-600 px-1 text-[9px] font-bold text-white">
              {bundleCount > 99 ? "99+" : bundleCount}
            </span>
          ) : null}
        </motion.button>
        <motion.a
          href="/inbox"
          className="crm-touch-target flex flex-col items-center gap-0.5 text-[10px] font-semibold text-on-surface-variant"
          whileTap={{ scale: 0.92 }}
        >
          <Layers className="size-5" />
          לוח
        </motion.a>
      </div>
    </nav>
  );
}
