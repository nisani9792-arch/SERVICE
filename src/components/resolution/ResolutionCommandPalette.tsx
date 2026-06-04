"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Archive,
  CheckCircle2,
  Layers,
  Plus,
  Search,
  ShieldBan,
  Sparkles,
  Zap
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { filterTicketsForPalette } from "@/lib/command-palette-search";
import { formatTicketNumber } from "@/lib/ticket-sequence";
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
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  tickets?: Ticket[];
  activeTicket: Ticket | null;
  onSelectTicket?: (ticket: Ticket) => void;
  onMarkSpam: (ticketId: string) => void;
  onArchive: (ticketId: string) => void;
  onFocusAiReply: () => void;
  onApplyBundleReply: (replyText: string) => void;
  onNewTicket?: () => void;
  onCloseActiveTicket?: () => void;
};

export function ResolutionCommandPalette({
  open,
  onOpenChange,
  searchQuery,
  onSearchQueryChange,
  tickets = [],
  activeTicket,
  onSelectTicket,
  onMarkSpam,
  onArchive,
  onFocusAiReply,
  onApplyBundleReply,
  onNewTicket,
  onCloseActiveTicket
}: ResolutionCommandPaletteProps) {
  const router = useRouter();
  const [bundles, setBundles] = useState<AnswerBundleLite[]>([]);

  const matchedTickets = useMemo(
    () => filterTicketsForPalette(tickets, searchQuery, 10),
    [tickets, searchQuery]
  );

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
            className="absolute inset-0 bg-black/50 backdrop-blur-md"
            aria-label="סגור"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: 0.2 }}
            className="jds-cmdk gen-surface-strong relative w-full max-w-xl overflow-hidden rounded-xl3 shadow-float"
          >
            <Command
              label="פקודות וחיפוש"
              className="jds-cmdk-root"
              shouldFilter={false}
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <Search className="size-4 shrink-0 text-primary/70" aria-hidden />
                <Command.Input
                  value={searchQuery}
                  onValueChange={onSearchQueryChange}
                  placeholder="חפש פניה, אימייל, נושא… או פעולה"
                  className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-on-surface-variant/60"
                  autoFocus
                />
              </div>
              <Command.List className="max-h-[min(56vh,420px)] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-6 text-center text-xs jds-empty-subtitle">
                  לא נמצאה פעולה או פנייה
                </Command.Empty>

                {matchedTickets.length > 0 ? (
                  <Command.Group heading="פניות" className="jds-cmdk-group">
                    {matchedTickets.map((ticket) => (
                      <Command.Item
                        key={ticket.id}
                        value={`${ticket.id}-${ticket.subject}`}
                        onSelect={() =>
                          run(() => {
                            onSelectTicket?.(ticket);
                            onSearchQueryChange("");
                          })
                        }
                        className="jds-cmdk-item"
                      >
                        <span className="min-w-0 flex-1 truncate text-start">
                          {ticket.subject || "ללא נושא"}
                        </span>
                        <span className="shrink-0 text-[10px] text-on-surface-variant">
                          {ticket.ticketNumber != null
                            ? formatTicketNumber(ticket.ticketNumber)
                            : ticket.senderEmail?.slice(0, 20)}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ) : null}

                <Command.Group heading="קיצורי דרך" className="jds-cmdk-group">
                  {onNewTicket ? (
                    <Command.Item
                      onSelect={() => run(onNewTicket)}
                      className="jds-cmdk-item"
                    >
                      <Plus className="size-4 text-primary" />
                      <span>פנייה חדשה</span>
                    </Command.Item>
                  ) : null}
                  <Command.Item
                    disabled={!ticketId}
                    onSelect={() => ticketId && run(() => onCloseActiveTicket?.())}
                    className="jds-cmdk-item"
                  >
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <span>סגור פנייה</span>
                  </Command.Item>
                  <Command.Item
                    disabled={!ticketId}
                    onSelect={() => ticketId && run(() => onMarkSpam(ticketId))}
                    className="jds-cmdk-item"
                  >
                    <ShieldBan className="size-4 text-amber-600" />
                    <span>סמן כספאם</span>
                  </Command.Item>
                  <Command.Item
                    disabled={!ticketId}
                    onSelect={() => ticketId && run(() => onArchive(ticketId))}
                    className="jds-cmdk-item"
                  >
                    <Archive className="size-4 text-emerald-600" />
                    <span>סגור וארכיון</span>
                  </Command.Item>
                  <Command.Item
                    disabled={!ticketId}
                    onSelect={() => run(onFocusAiReply)}
                    className="jds-cmdk-item"
                  >
                    <Sparkles className="size-4 text-primary" />
                    <span>מענה AI (Smart Compose)</span>
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
                        <Zap className="size-4 text-violet-500" />
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
              <div className="px-3 py-2 text-[10px] jds-empty-subtitle">
                <span className="font-mono">⌘K</span> / <span className="font-mono">Ctrl+K</span>{" "}
                · <span className="font-mono">Esc</span> לסגירה
              </div>
            </Command>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
