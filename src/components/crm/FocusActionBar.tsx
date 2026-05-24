"use client";

import { Check, MessageSquare, X } from "lucide-react";
import { motion } from "framer-motion";

type FocusActionBarProps = {
  disabled?: boolean;
  onDelete: () => void;
  onReply: () => void;
  onArchive: () => void;
};

export function FocusActionBar({
  disabled,
  onDelete,
  onReply,
  onArchive
}: FocusActionBarProps) {
  const btn =
    "crm-touch-target flex size-16 items-center justify-center rounded-full shadow-lg transition active:scale-95 disabled:opacity-40";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[45] flex justify-center px-6 md:bottom-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex items-end gap-6">
        <motion.button
          type="button"
          disabled={disabled}
          onClick={onDelete}
          className={`${btn} border-2 border-rose-200 bg-rose-50 text-rose-700`}
          whileTap={{ scale: 0.92 }}
          aria-label="מחק"
        >
          <X className="size-8" strokeWidth={2.5} />
        </motion.button>
        <motion.button
          type="button"
          disabled={disabled}
          onClick={onReply}
          className={`${btn} -translate-y-2 border-2 border-primary/30 bg-primary text-white`}
          whileTap={{ scale: 0.92 }}
          aria-label="מענה"
        >
          <MessageSquare className="size-8" strokeWidth={2.5} />
        </motion.button>
        <motion.button
          type="button"
          disabled={disabled}
          onClick={onArchive}
          className={`${btn} border-2 border-emerald-200 bg-emerald-50 text-emerald-800`}
          whileTap={{ scale: 0.92 }}
          aria-label="ארכיון"
        >
          <Check className="size-8" strokeWidth={2.5} />
        </motion.button>
      </div>
    </div>
  );
}
