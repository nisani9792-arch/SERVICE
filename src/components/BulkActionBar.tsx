"use client";

import { useState } from "react";
import { CheckCheck, Tag, Trash2, X } from "lucide-react";
import { CATEGORY_LABELS_HE, ACTIVE_CATEGORIES } from "@/lib/categories";
import { TicketCategory } from "@/lib/types";

interface BulkActionBarProps {
  count: number;
  onMarkHandled: () => Promise<void>;
  onDelete: () => Promise<void>;
  onChangeCategory: (category: TicketCategory) => Promise<void>;
  onClearSelection: () => void;
}

export function BulkActionBar({
  count,
  onMarkHandled,
  onDelete,
  onChangeCategory,
  onClearSelection
}: BulkActionBarProps) {
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
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

  return (
    <div className="lux-card sticky bottom-4 z-40 flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-primary-soft/90 p-3 shadow-lg backdrop-blur-md">
      <span className="text-sm font-medium text-primary">
        {count} פניות נבחרו
      </span>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowCategoryPicker((prev) => !prev)}
            className="lux-button px-3 py-1.5 text-xs"
            disabled={isBusy}
          >
            <Tag className="ml-1 size-3.5" />
            שנה קטגוריה
          </button>

          {showCategoryPicker && (
            <div className="absolute bottom-full right-0 mb-2 w-48 rounded-lg border border-outline bg-white p-1 shadow-card">
              {ACTIVE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className="w-full rounded-md px-3 py-1.5 text-right text-sm hover:bg-surface-container"
                  onClick={async () => {
                    setShowCategoryPicker(false);
                    await wrap(() => onChangeCategory(cat))();
                  }}
                >
                  {CATEGORY_LABELS_HE[cat]}
                </button>
              ))}
              <button
                key="handled"
                className="w-full rounded-md px-3 py-1.5 text-right text-sm text-green-700 hover:bg-green-50"
                onClick={async () => {
                  setShowCategoryPicker(false);
                  await wrap(() => onChangeCategory("handled"))();
                }}
              >
                {CATEGORY_LABELS_HE.handled}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={wrap(onMarkHandled)}
          className="lux-button px-3 py-1.5 text-xs"
          disabled={isBusy}
        >
          <CheckCheck className="ml-1 size-3.5" />
          סמן טופל
        </button>

        <button
          onClick={async () => {
            if (!window.confirm(`למחוק ${count} פניות לצמיתות?`)) return;
            await wrap(onDelete)();
          }}
          className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs text-rose-700 transition hover:bg-rose-50"
          disabled={isBusy}
        >
          <Trash2 className="ml-1 size-3.5" />
          מחק הכל
        </button>

        <button
          onClick={onClearSelection}
          className="lux-button px-2 py-1.5 text-xs"
          disabled={isBusy}
        >
          <X className="ml-1 size-3.5" />
          בטל בחירה
        </button>
      </div>
    </div>
  );
}
