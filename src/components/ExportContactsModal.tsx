"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";
import { exportContactsUrl } from "@/lib/firebase";
import { ACTIVE_CATEGORIES, CATEGORY_LABELS_HE } from "@/lib/categories";
import type { LegacyTicketCategory } from "@/lib/types";

interface ExportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportContactsModal({ isOpen, onClose }: ExportContactsModalProps) {
  const [category, setCategory] = useState<string>("all");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="lux-card w-full max-w-md rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">ייצוא אנשי קשר</h2>
          <button type="button" onClick={onClose} className="lux-button p-2">
            <X className="size-4" />
          </button>
        </div>
        <p className="mb-3 text-xs text-on-surface-variant">
          ייצוא ייחודי של שם + אימייל לפי קטגוריה, בפורמט CSV למערכות דיוור.
        </p>
        <label className="mb-4 block text-xs text-on-surface-variant">
          קטגוריה
          <select
            className="mt-1 w-full rounded-xl border border-outline bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">כל הקטגוריות</option>
            {ACTIVE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS_HE[c as LegacyTicketCategory]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="lux-button" onClick={onClose}>
            סגור
          </button>
          <a
            href={exportContactsUrl(category === "all" ? undefined : category)}
            className="lux-button-primary inline-flex items-center gap-1"
            download
          >
            <Download className="size-4" />
            הורד CSV
          </a>
        </div>
      </div>
    </div>
  );
}
