"use client";

import { Loader2, Sparkles, Zap } from "lucide-react";
import { motion } from "framer-motion";
import type { ReplySuggestion } from "@/hooks/useReplySuggestions";

type AiCoPilotCardProps = {
  suggestion: ReplySuggestion | null;
  highConfidence: boolean;
  loading?: boolean;
  sending?: boolean;
  onApproveSend: (text: string) => void;
  onUseDraft: (text: string) => void;
};

export function AiCoPilotCard({
  suggestion,
  highConfidence,
  loading,
  sending,
  onApproveSend,
  onUseDraft
}: AiCoPilotCardProps) {
  if (loading) {
    return (
      <div className="jds-copilot-card jds-copilot-loading mb-3 rounded-xl2 p-4">
        <div className="jds-skeleton mb-2 h-4 w-1/3 rounded" />
        <div className="jds-skeleton h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (!suggestion) {
    return (
      <div className="mb-3 rounded-xl2 border border-white/10 bg-white/5 p-3 text-xs jds-empty-subtitle">
        <Sparkles className="mb-1 size-4 text-[var(--jds-primary)]" />
        אין הצעת AI מוכנה — כתוב מענה ידני למטה.
      </div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`jds-copilot-card mb-3 rounded-xl2 p-4 ${highConfidence ? "jds-copilot-glow" : ""}`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-[var(--jds-primary)]" />
          <span className="text-xs font-bold text-[var(--jds-primary)]">Smart Reply — AI Co-Pilot</span>
          {highConfidence ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--jds-primary-glow)] px-2 py-0.5 text-[10px] font-bold text-[var(--jds-primary)]">
              <Zap className="size-3" />
              ביטחון גבוה
            </span>
          ) : null}
        </div>
        <span className="text-[10px] jds-empty-subtitle">{suggestion.matchReason}</span>
      </div>

      <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed">{suggestion.replyText}</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={sending}
          onClick={() => onApproveSend(suggestion.replyText)}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-l from-[var(--jds-primary)] to-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 shadow-[0_0_24px_var(--jds-primary-glow)] disabled:opacity-50"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          אשר ושלח
        </button>
        <button
          type="button"
          disabled={sending}
          onClick={() => onUseDraft(suggestion.replyText)}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10"
        >
          ערוך לפני שליחה
        </button>
      </div>
    </motion.div>
  );
}
