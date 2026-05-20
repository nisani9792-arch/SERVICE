"use client";

import { Inbox, Mail, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

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
        <motion.button
          type="button"
          onClick={onSyncMail}
          disabled={emailSyncing}
          className="crm-touch-target flex flex-col items-center gap-0.5 text-[10px] font-semibold text-on-surface-variant"
          whileTap={{ scale: 0.92 }}
        >
          <Mail className={cn("size-5", emailSyncing && "animate-pulse text-primary")} />
          {emailSyncing ? "מסנכרן" : "מייל"}
        </motion.button>
        <motion.button
          type="button"
          onClick={onTriage}
          className="crm-touch-target relative flex flex-col items-center gap-0.5 text-[10px] font-semibold text-primary"
          whileTap={{ scale: 0.92 }}
        >
          <Inbox className="size-5" />
          ממתין
          {triageCount > 0 ? (
            <span className="absolute -top-1 left-1/2 min-w-[1.1rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-[#8b7cf8] px-1 text-[9px] font-bold text-white shadow-glow-sm">
              {triageCount > 99 ? "99+" : triageCount}
            </span>
          ) : null}
        </motion.button>
        <motion.button
          type="button"
          onClick={onNewTicket}
          className="crm-btn-primary flex size-14 items-center justify-center rounded-full p-0"
          aria-label="פנייה חדשה"
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
        >
          <Plus className="size-6" />
        </motion.button>
      </div>
    </nav>
  );
}
