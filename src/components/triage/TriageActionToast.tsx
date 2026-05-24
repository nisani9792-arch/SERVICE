"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldBan, Undo2 } from "lucide-react";

export function TriageActionToast({
  visible,
  message,
  onUndo,
  onDismiss
}: {
  visible: boolean;
  message: string;
  onUndo?: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(onDismiss, 3000);
    return () => window.clearTimeout(timer);
  }, [visible, onDismiss]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-[100] flex w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-2 rounded-2xl border border-amber-200/90 bg-amber-50 px-3 py-2.5 shadow-lg"
          role="status"
        >
          <ShieldBan className="size-5 shrink-0 text-amber-800" />
          <p className="min-w-0 flex-1 text-xs font-semibold text-amber-950">{message}</p>
          {onUndo ? (
            <button
              type="button"
              onClick={onUndo}
              className="crm-touch-target inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1 text-[10px] font-bold text-amber-900"
            >
              <Undo2 className="size-3" />
              בטל
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
