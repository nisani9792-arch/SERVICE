"use client";

import { Archive, MessageSquare, ShieldBan } from "lucide-react";
import { motion } from "framer-motion";

type ResolutionActionBarProps = {
  disabled?: boolean;
  onSpam: () => void;
  onArchive: () => void;
  onReplyFocus: () => void;
};

/** Floating quick actions for the active ticket (desktop detail pane). */
export function ResolutionActionBar({
  disabled,
  onSpam,
  onArchive,
  onReplyFocus
}: ResolutionActionBarProps) {
  const btn =
    "crm-touch-target flex size-12 items-center justify-center rounded-full border shadow-lg transition active:scale-95 disabled:opacity-40";

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-20 hidden xl:flex xl:flex-col xl:gap-2">
      <motion.button
        type="button"
        disabled={disabled}
        onClick={onSpam}
        className={`${btn} pointer-events-auto border-amber-400/40 bg-amber-500/15 text-amber-200`}
        whileTap={{ scale: 0.92 }}
        aria-label="סמן כספאם"
        title="ספאם"
      >
        <ShieldBan className="size-5" />
      </motion.button>
      <motion.button
        type="button"
        disabled={disabled}
        onClick={onReplyFocus}
        className={`${btn} pointer-events-auto border-[var(--jds-primary)]/40 bg-[var(--jds-primary-glow)] text-[var(--jds-primary)]`}
        whileTap={{ scale: 0.92 }}
        aria-label="מענה"
        title="מענה"
      >
        <MessageSquare className="size-5" />
      </motion.button>
      <motion.button
        type="button"
        disabled={disabled}
        onClick={onArchive}
        className={`${btn} pointer-events-auto border-emerald-400/40 bg-emerald-500/15 text-emerald-200`}
        whileTap={{ scale: 0.92 }}
        aria-label="סגור וארכיון"
        title="ארכיון"
      >
        <Archive className="size-5" />
      </motion.button>
    </div>
  );
}
