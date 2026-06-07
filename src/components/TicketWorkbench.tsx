"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
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

function workbenchPropsEqual(prev: TicketWorkbenchProps, next: TicketWorkbenchProps): boolean {
  return (
    prev.tickets === next.tickets &&
    prev.activeTicket?.id === next.activeTicket?.id &&
    prev.selectedIds === next.selectedIds &&
    prev.isLoading === next.isLoading &&
    prev.isRefreshing === next.isRefreshing &&
    prev.page === next.page &&
    prev.total === next.total &&
    prev.pageSize === next.pageSize &&
    prev.listMode === next.listMode &&
    prev.title === next.title &&
    prev.subtitle === next.subtitle
  );
}

const TicketWorkbenchInner = memo(function TicketWorkbenchInner(props: TicketWorkbenchProps) {
  const {
    title = "פניות",
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

  const detailLoading =
    !!activeTicket &&
    (!detailTicket?.body || detailTicket.body.length <= (activeTicket.body?.length ?? 0));

  const detailProps =
    activeTicket && detailTicket
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
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/90 px-2 py-1">
        <div className="min-w-0">
          <h2 className="truncate text-[11px] font-bold text-slate-800">{title}</h2>
          <p className="truncate text-[9px] text-slate-500">
            {subtitle ?? `${total.toLocaleString("he-IL")} תוצאות`}
            {isRefreshing ? " · מעדכן…" : ""}
          </p>
        </div>
        <label className="inline-flex shrink-0 items-center gap-1 text-[9px] font-semibold text-slate-500">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) => onSelectPage(event.target.checked)}
            className="size-3 accent-indigo-600"
          />
          הכל
        </label>
      </div>

      <div
        ref={listScrollRef}
        className="jds-list-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {isLoading ? (
          <ResolutionSkeleton rows={12} />
        ) : tickets.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-slate-500">אין פניות לפי המסננים.</div>
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

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200/80 bg-slate-50/90 px-2 py-1 text-[9px] text-slate-500">
        <span className="tabular-nums">
          {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total.toLocaleString("he-IL")}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-semibold disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            הקודם
          </button>
          <span className="tabular-nums font-bold text-slate-700">
            {page}/{totalPages}
          </span>
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-semibold disabled:opacity-40"
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
      className="jusic-resolution min-h-0 flex-1"
      minHeight="0"
      listPane={listPane}
      detailPane={detailProps ? <TicketDetail {...detailProps} /> : null}
      detailKey={activeTicket?.id ?? null}
      hasActiveDetail={!!detailProps}
      detailOpen={mobileDetailOpen}
      onDetailClose={() => setMobileDetailOpen(false)}
    />
  );
}, workbenchPropsEqual);

export function TicketWorkbench(props: TicketWorkbenchProps) {
  return <TicketWorkbenchInner {...props} />;
}
