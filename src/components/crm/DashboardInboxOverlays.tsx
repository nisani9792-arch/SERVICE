"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { MobileDock } from "@/components/MobileDock";
import { BatchProgressBar } from "@/components/BatchProgressBar";
import type { AgentPanelResult } from "@/components/AiAgentPanel";
import type { Ticket } from "@/lib/types";

const AiAgentPanel = dynamic(
  () => import("@/components/AiAgentPanel").then((m) => ({ default: m.AiAgentPanel })),
  { ssr: false }
);
const AiInsightsPanel = dynamic(
  () => import("@/components/AiInsightsPanel").then((m) => ({ default: m.AiInsightsPanel })),
  { ssr: false }
);
const ResolutionCommandPalette = dynamic(
  () =>
    import("@/components/resolution/ResolutionCommandPalette").then((m) => ({
      default: m.ResolutionCommandPalette
    })),
  { ssr: false }
);
const ImportModal = dynamic(
  () => import("@/components/ImportModal").then((m) => ({ default: m.ImportModal })),
  { ssr: false }
);
const NewTicketModal = dynamic(
  () => import("@/components/NewTicketModal").then((m) => ({ default: m.NewTicketModal })),
  { ssr: false }
);
const EditTicketModal = dynamic(
  () => import("@/components/EditTicketModal").then((m) => ({ default: m.EditTicketModal })),
  { ssr: false }
);
const ExportContactsModal = dynamic(
  () => import("@/components/ExportContactsModal").then((m) => ({ default: m.ExportContactsModal })),
  { ssr: false }
);
const ReplyTemplatesModal = dynamic(
  () => import("@/components/ReplyTemplatesModal").then((m) => ({ default: m.ReplyTemplatesModal })),
  { ssr: false }
);
const BulkReplyModal = dynamic(
  () => import("@/components/BulkReplyModal").then((m) => ({ default: m.BulkReplyModal })),
  { ssr: false }
);
const ReplyTicketModal = dynamic(
  () => import("@/components/ReplyTicketModal").then((m) => ({ default: m.ReplyTicketModal })),
  { ssr: false }
);

export type DashboardInboxOverlaysProps = {
  selectedCount: number;
  aiReclassifying: boolean;
  onAgentCommand: (command: string) => Promise<AgentPanelResult | void>;
  showImportModal: boolean;
  onCloseImport: () => void;
  showNewModal: boolean;
  onCloseNew: () => void;
  editingTicket: Ticket | null;
  onCloseEdit: () => void;
  replyingTicket: Ticket | null;
  onCloseReply: () => void;
  onSendReply: (message: string) => Promise<void>;
  showExportModal: boolean;
  onCloseExport: () => void;
  showReplyTemplates: boolean;
  onCloseReplyTemplates: () => void;
  showBulkReply: boolean;
  bulkReplyCount: number;
  onCloseBulkReply: () => void;
  onBulkSendReply: (message: string) => Promise<void>;
  emailSyncing: boolean;
  triageCount: number;
  onEmailSync: () => void;
  batchProgress: {
    visible: boolean;
    label: string;
    processed: number;
    total: number;
    progress: number;
  };
  commandPaletteOpen: boolean;
  onCommandPaletteOpenChange: (open: boolean) => void;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  tickets: Ticket[];
  activeTicket: Ticket | null;
  onSelectTicketFromPalette: (ticket: Ticket) => void;
  onNewTicketFromPalette: () => void;
  onArchiveActiveFromPalette: () => void;
  onMarkSpamFromPalette: (id: string) => void;
  onArchiveFromPalette: (id: string) => void;
  onInlineReplyFromPalette: (text: string) => void;
};

export function DashboardInboxOverlays({
  selectedCount,
  aiReclassifying,
  onAgentCommand,
  showImportModal,
  onCloseImport,
  showNewModal,
  onCloseNew,
  editingTicket,
  onCloseEdit,
  replyingTicket,
  onCloseReply,
  onSendReply,
  showExportModal,
  onCloseExport,
  showReplyTemplates,
  onCloseReplyTemplates,
  showBulkReply,
  bulkReplyCount,
  onCloseBulkReply,
  onBulkSendReply,
  emailSyncing,
  triageCount,
  onEmailSync,
  batchProgress,
  commandPaletteOpen,
  onCommandPaletteOpenChange,
  searchValue,
  onSearchValueChange,
  tickets,
  activeTicket,
  onSelectTicketFromPalette,
  onNewTicketFromPalette,
  onArchiveActiveFromPalette,
  onMarkSpamFromPalette,
  onArchiveFromPalette,
  onInlineReplyFromPalette
}: DashboardInboxOverlaysProps) {
  const router = useRouter();

  return (
    <>
      <details className="shrink-0 border-t border-outline/40 bg-surface-container px-2 py-1">
        <summary className="cursor-pointer text-[10px] font-bold text-on-surface-variant">
          AI ותובנות
        </summary>
        <div className="space-y-2 py-2">
          <AiInsightsPanel />
          <AiAgentPanel
            selectedCount={selectedCount}
            busy={aiReclassifying}
            onRun={onAgentCommand}
          />
        </div>
      </details>

      <ImportModal isOpen={showImportModal} onClose={onCloseImport} />
      <NewTicketModal isOpen={showNewModal} onClose={onCloseNew} />
      <EditTicketModal ticket={editingTicket} onClose={onCloseEdit} />
      <ReplyTicketModal ticket={replyingTicket} onClose={onCloseReply} onSubmit={onSendReply} />
      <ExportContactsModal isOpen={showExportModal} onClose={onCloseExport} />
      <ReplyTemplatesModal isOpen={showReplyTemplates} onClose={onCloseReplyTemplates} />
      <BulkReplyModal
        isOpen={showBulkReply}
        count={bulkReplyCount}
        onClose={onCloseBulkReply}
        onSubmit={onBulkSendReply}
      />

      <div className="md:hidden">
        <MobileDock
          onSyncMail={onEmailSync}
          onTriage={() => {
            router.push("/dashboard?view=triage");
          }}
          onAnswerBundles={() => {
            router.push("/answer-bundles");
          }}
          onReview={() => {
            router.push("/mobile/triage?queue=active");
          }}
          emailSyncing={emailSyncing}
          triageCount={triageCount}
          bundleCount={0}
        />
      </div>

      <BatchProgressBar
        visible={batchProgress.visible}
        label={batchProgress.label}
        processed={batchProgress.processed}
        total={batchProgress.total}
        progress={batchProgress.progress}
      />

      <ResolutionCommandPalette
        open={commandPaletteOpen}
        onOpenChange={onCommandPaletteOpenChange}
        searchQuery={searchValue}
        onSearchQueryChange={onSearchValueChange}
        tickets={tickets}
        activeTicket={activeTicket}
        onSelectTicket={onSelectTicketFromPalette}
        onNewTicket={onNewTicketFromPalette}
        onCloseActiveTicket={onArchiveActiveFromPalette}
        onMarkSpam={onMarkSpamFromPalette}
        onArchive={onArchiveFromPalette}
        onFocusAiReply={() => {
          window.dispatchEvent(new Event("resolution:focus-reply"));
        }}
        onApplyBundleReply={onInlineReplyFromPalette}
      />
    </>
  );
}
