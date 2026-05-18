"use client";

import { useState } from "react";
import { CircleDot, Flag, Send, Sparkles, Tag, Trash2, X } from "lucide-react";
import { ACTIVE_CATEGORIES, CATEGORY_LABELS_HE } from "@/lib/categories";
import type { LegacyTicketCategory, TicketStatus } from "@/lib/types";

interface BulkActionBarProps {
  count: number;
  onReply: () => void;
  onAiClassify: () => void;
  aiBusy?: boolean;
  onDelete: () => Promise<void>;
  onChangeCategory: (category: string) => Promise<void>;
  onSetStatus: (status: TicketStatus) => Promise<void>;
  onAddTags: (tags: string[]) => Promise<void>;
  onMoveToSpam: () => Promise<void>;
  onClearSelection: () => void;
}

export function BulkActionBar({
  count,
  onReply,
  onAiClassify,
  aiBusy = false,
  onDelete,
  onChangeCategory,
  onSetStatus,
  onAddTags,
  onMoveToSpam,
  onClearSelection
}: BulkActionBarProps) {
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  if (count === 0) return null;

  const wrap = (action: () => Promise<void>) => async () => {
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  };

  const applyTags = async () => {
    const tags = tagInput
      .split(/[,;\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length === 0) return;
    setIsBusy(true);
    try {
      await onAddTags(tags);
      setTagInput("");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="lux-card sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex flex-col gap-3 rounded-2xl border border-primary/25 bg-white p-3 shadow-lg md:bottom-4 md:z-40 md:flex-row md:flex-wrap md:items-center md:justify-between">
      <span className="text-sm font-semibold text-primary">
        נבחרו {count.toLocaleString("he-IL")} פניות
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onReply}
          className="md3-toolbar-btn border-primary/30 bg-primary-soft font-semibold text-primary"
          disabled={isBusy || aiBusy}
        >
          <Send className="size-3.5" />
          מענה לכולם
        </button>

        <button
          type="button"
          onClick={onAiClassify}
          className="md3-toolbar-btn border-violet-200 bg-violet-50 font-semibold text-violet-950"
          disabled={isBusy || aiBusy}
        >
          <Sparkles className="size-3.5" />
          {aiBusy ? "מסווג…" : "סיווג AI"}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCategoryPicker((p) => !p)}
            className="md3-toolbar-btn"
            disabled={isBusy}
          >
            <Tag className="size-3.5 opacity-80" />
            קטגוריה
          </button>

          {showCategoryPicker ? (
            <div className="absolute bottom-full left-0 z-50 mb-2 max-h-56 w-52 overflow-y-auto rounded-2xl border border-outline bg-white p-1 shadow-card">
              {ACTIVE_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  className="w-full rounded-xl px-3 py-2 text-right text-sm hover:bg-surface-container"
                  onClick={async () => {
                    setShowCategoryPicker(false);
                    await wrap(() => onChangeCategory(cat))();
                  }}
                >
                  {CATEGORY_LABELS_HE[cat as LegacyTicketCategory]}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowStatusPicker((p) => !p)}
            className="md3-toolbar-btn"
            disabled={isBusy}
          >
            <CircleDot className="size-3.5 opacity-80" />
            סטטוס
          </button>
          {showStatusPicker ? (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-44 rounded-2xl border border-outline bg-white p-1 shadow-card">
              {(
                [
                  ["open", "פתוח"],
                  ["in_progress", "בטיפול"]
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className="w-full rounded-xl px-3 py-2 text-right text-sm hover:bg-surface-container"
                  onClick={async () => {
                    setShowStatusPicker(false);
                    await wrap(() => onSetStatus(value))();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <input
            className="h-9 w-40 rounded-full border border-outline bg-white px-3 text-xs outline-none focus:border-primary"
            placeholder="תגיות (פסיק)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            disabled={isBusy}
          />
          <button
            type="button"
            className="md3-toolbar-btn px-2"
            disabled={isBusy}
            onClick={() => void applyTags()}
          >
            הוסף
          </button>
        </div>

        <button
          type="button"
          onClick={wrap(onMoveToSpam)}
          className="md3-toolbar-btn border-amber-200 bg-amber-50/80 text-amber-950"
          disabled={isBusy}
        >
          <Flag className="size-3.5" />
          סמן כספאם
        </button>

        <button
          type="button"
          onClick={wrap(onDelete)}
          className="md3-toolbar-btn border-rose-200 bg-rose-50 text-rose-800"
          disabled={isBusy}
        >
          <Trash2 className="size-3.5" />
          מחק
        </button>

        <button type="button" onClick={onClearSelection} className="md3-toolbar-btn" disabled={isBusy}>
          <X className="size-3.5" />
          בטל
        </button>
      </div>
    </div>
  );
}
