"use client";

import { type ReactNode, useCallback, useEffect } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { cn } from "@/lib/cn";

const EASE = [0.22, 1, 0.36, 1] as const;

export type SplitPaneLayoutProps = {
  /** Master list column (RTL: appears on the right). */
  listPane: ReactNode;
  /** Detail column content when a ticket is selected. */
  detailPane: ReactNode;
  /** Placeholder when nothing is selected (desktop detail column). */
  emptyDetail?: ReactNode;
  /** Whether detail content is available (drives desktop column + mobile sheet). */
  hasActiveDetail?: boolean;
  /** Mobile bottom-sheet open state. */
  detailOpen?: boolean;
  onDetailClose?: () => void;
  /** Key for AnimatePresence transitions when switching tickets. */
  detailKey?: string | null;
  className?: string;
  /** Minimum height for the workbench grid. */
  minHeight?: string;
};

const defaultEmptyDetail = (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, ease: EASE }}
    className="flex h-full flex-col items-center justify-center px-6 py-16 text-center"
  >
    <p className="text-sm font-semibold jds-empty-title">בחר פנייה מהרשימה</p>
    <p className="mt-2 max-w-xs text-xs leading-relaxed jds-empty-subtitle">
      לחיצה על שורה תציג כאן את כרטיס הפנייה עם כל הפעולות — ללא רענון עמוד.
    </p>
  </motion.div>
);

/**
 * Deep Resolution Engine — master-detail split (desktop) and bottom sheet (mobile).
 * RTL-first: list pane is the first grid column (visual right in `dir="rtl"`).
 */
export function SplitPaneLayout({
  listPane,
  detailPane,
  emptyDetail = defaultEmptyDetail,
  hasActiveDetail = false,
  detailOpen = false,
  onDetailClose,
  detailKey,
  className,
  minHeight = "min(72vh, 820px)"
}: SplitPaneLayoutProps) {
  const dragControls = useDragControls();

  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && detailOpen) {
        onDetailClose?.();
      }
    },
    [detailOpen, onDetailClose]
  );

  useEffect(() => {
    if (!detailOpen) return;
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [detailOpen, handleEscape]);

  useEffect(() => {
    if (!detailOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [detailOpen]);

  return (
    <section
      className={cn("jusic-resolution jds-split-pane", className)}
      style={{ minHeight }}
      aria-label="לוח עיבוד פניות"
    >
      {/* Master — RTL first column = visual right */}
      <motion.div
        layout
        className="jds-list-panel flex min-h-0 min-w-0 flex-col overflow-hidden"
        transition={{ layout: { duration: 0.32, ease: EASE } }}
      >
        {listPane}
      </motion.div>

      {/* Detail — desktop inline column (RTL: visual left / center) */}
      <motion.aside
        layout
        className="jds-detail-panel hidden min-h-0 min-w-0 flex-col overflow-hidden lg:flex"
        transition={{ layout: { duration: 0.32, ease: EASE } }}
        aria-live="polite"
        aria-label="פרטי פנייה"
      >
        <AnimatePresence mode="wait">
          {hasActiveDetail ? (
            <motion.div
              key={detailKey ?? "detail-active"}
              className="flex h-full min-h-0 flex-col"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.24, ease: EASE }}
            >
              {detailPane}
            </motion.div>
          ) : (
            <motion.div
              key="detail-empty"
              className="flex h-full min-h-0 flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              {emptyDetail}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>

      {/* Mobile — full-screen stack + bottom sheet */}
      <AnimatePresence>
        {hasActiveDetail && detailOpen ? (
          <motion.div
            key="mobile-detail"
            className="fixed inset-0 z-sheet lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            <motion.button
              type="button"
              className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
              aria-label="סגור כרטיס פנייה"
              onClick={onDetailClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              className="jds-detail-sheet absolute inset-x-0 bottom-0 flex h-[min(96dvh,96vh)] max-h-[min(96dvh,96vh)] flex-col overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-label="פרטי פנייה"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 340, mass: 0.85 }}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.35 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 400) {
                  onDetailClose?.();
                }
              }}
            >
              <div
                className="flex shrink-0 cursor-grab touch-none justify-center py-2 active:cursor-grabbing"
                onPointerDown={(event) => dragControls.start(event)}
                aria-hidden
              >
                <div className="h-1 w-11 rounded-full bg-slate-300" />
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{detailPane}</div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
