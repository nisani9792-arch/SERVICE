"use client";

import { Inbox, Mail, Plus } from "lucide-react";

interface MobileDockProps {
  onSyncMail: () => void;
  onNewTicket: () => void;
  onTriage: () => void;
  emailSyncing: boolean;
  triageCount: number;
}

export function MobileDock({
  onSyncMail,
  onNewTicket,
  onTriage,
  emailSyncing,
  triageCount
}: MobileDockProps) {
  return (
    <nav className="crm-mobile-dock" aria-label="פעולות מהירות">
      <div className="mx-auto flex max-w-lg items-center justify-around gap-1">
        <button
          type="button"
          onClick={onSyncMail}
          disabled={emailSyncing}
          className="crm-touch-target flex flex-col items-center gap-0.5 text-[10px] font-semibold text-slate-600"
        >
          <Mail className={`size-5 ${emailSyncing ? "animate-pulse text-indigo-600" : ""}`} />
          {emailSyncing ? "מסנכרן" : "מייל"}
        </button>
        <button
          type="button"
          onClick={onTriage}
          className="crm-touch-target relative flex flex-col items-center gap-0.5 text-[10px] font-semibold text-fuchsia-700"
        >
          <Inbox className="size-5" />
          ממתין
          {triageCount > 0 ? (
            <span className="absolute -top-1 left-1/2 min-w-[1.1rem] -translate-x-1/2 rounded-full bg-fuchsia-600 px-1 text-[9px] font-bold text-white">
              {triageCount > 99 ? "99+" : triageCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onNewTicket}
          className="crm-btn-primary size-12 rounded-full p-0 shadow-lg"
          aria-label="פנייה חדשה"
        >
          <Plus className="size-6" />
        </button>
      </div>
    </nav>
  );
}
