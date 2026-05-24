"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TicketListPanel } from "@/components/TicketListPanel";
import type { TicketListMode } from "@/components/TicketListRow";
import { SplitPaneLayout } from "@/components/resolution/SplitPaneLayout";
import { ResolutionSkeleton } from "@/components/resolution/ResolutionSkeleton";
import { TicketDetail } from "@/components/resolution/TicketDetail";
import { useTicketDetail } from "@/hooks/useTicketDetail";
import { useTicketPrefetch } from "@/hooks/useResolutionSelection";
import type { Ticket, TicketStatus } from "@/lib/types";

interface TicketWorkbenchProps {
  title?: string;
  subtitle?: string;
  tickets: Ticket[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  isRefreshing?: boolean;
  selectedIds: Set<string>;
  activeTicket: Ticket | null;
  onSetActiveTicket: (ticket: Ticket) => void;
  onToggleSelect: (id: string) => void;
  onSelectPage: (select: boolean) => void;
  onPageChange: (page: number) => void;
  onEdit: (ticket: Ticket) => void;
  onDelete: (id: string) => void;
  onSetStatus: (id: string, status: TicketStatus) => void;
  onChangeCategory: (id: string, category: string) => void;
  onReply: (ticket: Ticket) => void;
  onSaveInquiry: (ticket: Ticket) => void;
  onTriageAssign?: (id: string, category: string) => void;
  onSpam?: (id: string) => void;
  onArchive?: (id: string) => void;
  onInlineReply?: (ticketId: string, message: string) => Promise<void>;
  listMode?: TicketListMode;
}

export function TicketWorkbench(props: TicketWorkbenchProps) {
  const {
    title = "פניות פעילות",
    subtitle,
    tickets,
    total,
    page,
    pageSize,
    isLoading,
    isRefreshing = false,
    selectedIds,
    activeTicket,
    onSetActiveTicket,
    onToggleSelect,
    onSelectPage,
    onPageChange,
    onEdit,
    onDelete,
    onSetStatus,
    onChangeCategory,
    onReply,
    onSaveInquiry,
    onTriageAssign,
    onSpam,
    onArchive,
    onInlineReply,
    listMode = "default"
  } = props;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = tickets.length > 0 && tickets.every((ticket) => selectedIds.has(ticket.id));
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);

  const detailTicket = useTicketDetail(activeTicket);
  useTicketPrefetch(tickets, activeTicket?.id ?? null);

  const selectTicket = useCallback(
    (ticket: Ticket) => {
      if (listScrollRef.current) {
        scrollTopRef.current = listScrollRef.current.scrollTop;
      }
      onSetActiveTicket(ticket);
      setMobileDetailOpen(true);
    },
    [onSetActiveTicket]
  );

  useEffect(() => {
    if (!activeTicket?.id) {
      setMobileDetailOpen(false);
    }
  }, [activeTicket?.id]);

  useEffect(() => {
    const node = listScrollRef.current;
    if (!node) return;
    node.scrollTop = scrollTopRef.current;
  }, [activeTicket?.id]);

  const detailLoading = !!activeTicket && (!detailTicket?.body || detailTicket.body.length <= (activeTicket.body?.length ?? 0));

  const detailProps = activeTicket && detailTicket
    ? {
        ticket: detailTicket,
        detailLoading,
        onSetStatus,
        onReply,
        onSaveInquiry,
        onEdit,
        onDelete,
        onChangeCategory,
        onTriageAssign,
        onSpam,
        onArchive,
        onInlineReply,
        onClose: () => setMobileDetailOpen(false),
        compactHeader: mobileDetailOpen
      }
    : null;

  const listPane = (
    <>
      <div className="jds-panel-header flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-bold">{title}</h2>
          <p className="text-[11px] jds-empty-subtitle">
            {subtitle ?? `${total.toLocaleString("he-IL")} תוצאות · לחץ על פנייה לפרטים ופעולות`}
            {isRefreshing ? " · מעדכן…" : ""}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold jds-empty-subtitle">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) => onSelectPage(event.target.checked)}
            className="size-3.5 accent-[var(--jds-primary)]"
          />
          בחר עמוד
        </label>
      </div>

      <div
        ref={listScrollRef}
        className="jds-list-scroll max-h-[min(68dvh,68vh)] min-h-[16rem] overflow-y-auto overscroll-contain md:max-h-[72vh] md:min-h-[20rem]"
      >
        {isLoading ? (
          <ResolutionSkeleton rows={6} />
        ) : tickets.length === 0 ? (
          <div className="rounded-xl bg-white/5 px-3 py-10 text-center text-sm jds-empty-subtitle">
            אין פניות להצגה לפי המסננים.
          </div>
        ) : (
          <TicketListPanel
            tickets={tickets}
            listMode={listMode}
            activeTicketId={activeTicket?.id ?? null}
            selectedIds={selectedIds}
            onSelect={selectTicket}
            onToggleSelect={onToggleSelect}
          />
        )}
      </div>

      <div className="jds-panel-footer flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px] jds-empty-subtitle">
        <span>
          מציג {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} מתוך{" "}
          {total.toLocaleString("he-IL")}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-semibold disabled:opacity-45"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            הקודם
          </button>
          <span className="tabular-nums">
            {page}/{totalPages}
          </span>
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-semibold disabled:opacity-45"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            הבא
          </button>
        </div>
      </div>
    </>
  );

  return (
    <SplitPaneLayout
      listPane={listPane}
      detailPane={detailProps ? <TicketDetail {...detailProps} /> : null}
      detailKey={activeTicket?.id ?? null}
      hasActiveDetail={!!detailProps}
      detailOpen={mobileDetailOpen}
      onDetailClose={() => setMobileDetailOpen(false)}
    />
  );
}
