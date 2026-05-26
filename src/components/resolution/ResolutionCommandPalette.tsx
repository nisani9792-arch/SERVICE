"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Archive, Layers, ShieldBan, Sparkles, Zap } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Ticket } from "@/lib/types";

type AnswerBundleLite = {
  bundleKey: string;
  topicLabel: string;
  count: number;
  ticketIds: string[];
  suggestedReply: string | null;
};

export type ResolutionCommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTicket: Ticket | null;
  onMarkSpam: (ticketId: string) => void;
  onArchive: (ticketId: string) => void;
  onFocusAiReply: () => void;
  onApplyBundleReply: (replyText: string) => void;
};

export function ResolutionCommandPalette({
  open,
  onOpenChange,
  activeTicket,
  onMarkSpam,
  onArchive,
  onFocusAiReply,
  onApplyBundleReply
}: ResolutionCommandPaletteProps) {
  const router = useRouter();
  const [bundles, setBundles] = useState<AnswerBundleLite[]>([]);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/tickets/answer-bundles?minSize=3&limit=3000", {
      cache: "no-store",
      credentials: "same-origin"
    })
      .then(async (res) => {
        if (!res.ok) return { bundles: [] as AnswerBundleLite[] };
        return res.json() as Promise<{ bundles: AnswerBundleLite[] }>;
      })
      .then((data) => setBundles(data.bundles?.slice(0, 8) ?? []))
      .catch(() => setBundles([]));
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange, open]);

  const run = useCallback(
    (fn: () => void) => {
      fn();
      onOpenChange(false);
    },
    [onOpenChange]
  );

  const ticketId = activeTicket?.id;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[200] flex items-start justify-center px-3 pt-[max(12vh,4rem)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="סגור"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: 0.2 }}
            className="jds-cmdk relative w-full max-w-lg overflow-hidden rounded-xl3 border border-white/10 shadow-2xl"
          >
            <Command label="פקודות מהירות" className="jds-cmdk-root">
              <div className="border-b border-white/10 px-3 py-2">
                <Command.Input
                  placeholder="חפש פעולה… (ספאם, ארכיון, AI, חבילה)"
                  className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-white/40"
                  autoFocus
                />
              </div>
              <Command.List className="max-h-[min(50vh,360px)] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-6 text-center text-xs jds-empty-subtitle">
                  לא נמצאה פעולה
                </Command.Empty>

                <Command.Group heading="פנייה פעילה" className="jds-cmdk-group">
                  <Command.Item
                    disabled={!ticketId}
                    onSelect={() => ticketId && run(() => onMarkSpam(ticketId))}
                    className="jds-cmdk-item"
                  >
                    <ShieldBan className="size-4 text-amber-300" />
                    <span>סמן כספאם</span>
                    <kbd className="jds-cmdk-kbd">S</kbd>
                  </Command.Item>
                  <Command.Item
                    disabled={!ticketId}
                    onSelect={() => ticketId && run(() => onArchive(ticketId))}
                    className="jds-cmdk-item"
                  >
                    <Archive className="size-4 text-emerald-300" />
                    <span>סגור וארכיון</span>
                    <kbd className="jds-cmdk-kbd">E</kbd>
                  </Command.Item>
                  <Command.Item
                    disabled={!ticketId}
                    onSelect={() => run(onFocusAiReply)}
                    className="jds-cmdk-item"
                  >
                    <Sparkles className="size-4 text-[var(--jds-primary)]" />
                    <span>הצג / צור מענה AI</span>
                    <kbd className="jds-cmdk-kbd">R</kbd>
                  </Command.Item>
                </Command.Group>

                {bundles.length > 0 ? (
                  <Command.Group heading="חבילות מענה" className="jds-cmdk-group">
                    {bundles.map((bundle) => (
                      <Command.Item
                        key={bundle.bundleKey}
                        disabled={!bundle.suggestedReply}
                        onSelect={() => {
                          if (!bundle.suggestedReply) return;
                          const inBundle =
                            ticketId && bundle.ticketIds.includes(ticketId);
                          if (inBundle) {
                            run(() => onApplyBundleReply(bundle.suggestedReply!));
                          } else {
                            run(() => router.push("/answer-bundles"));
                          }
                        }}
                        className="jds-cmdk-item"
                      >
                        <Zap className="size-4 text-violet-300" />
                        <span className="min-w-0 truncate">
                          {bundle.topicLabel} ({bundle.count})
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}

                <Command.Group heading="ניווט" className="jds-cmdk-group">
                  <Command.Item
                    onSelect={() => run(() => router.push("/dashboard?view=workbench"))}
                    className="jds-cmdk-item"
                  >
                    <Layers className="size-4" />
                    <span>לוח עיבוד</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => run(() => router.push("/answer-bundles"))}
                    className="jds-cmdk-item"
                  >
                    <Zap className="size-4" />
                    <span>מצב חבילות מענה</span>
                  </Command.Item>
                </Command.Group>
              </Command.List>
              <div className="border-t border-white/10 px-3 py-2 text-[10px] jds-empty-subtitle">
                <span className="font-mono">⌘K</span> / <span className="font-mono">Ctrl+K</span>{" "}
                לפתיחה · <span className="font-mono">Esc</span> לסגירה
              </div>
            </Command>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
