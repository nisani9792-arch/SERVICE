"use client";

import { LayoutGrid } from "lucide-react";
import { CATEGORY_ICONS, categoryLabel } from "@/lib/categories";
import type { LegacyTicketCategory } from "@/lib/types";

interface SidebarProps {
  activeCategory: string | "all";
  dynamicCategories: { category: string; count: number }[];
  total: number;
  onSelectCategory: (category: string | "all") => void;
}

function iconFor(category: string) {
  if (category in CATEGORY_ICONS) {
    return CATEGORY_ICONS[category as LegacyTicketCategory];
  }
  return LayoutGrid;
}

export function Sidebar({
  activeCategory,
  dynamicCategories,
  total,
  onSelectCategory
}: SidebarProps) {
  return (
    <aside className="crm-sidebar h-fit w-full p-3 lg:sticky lg:top-6 lg:max-w-[17rem]">
      <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        קטגוריות
      </p>

      <button
        type="button"
        onClick={() => onSelectCategory("all")}
        className={`mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${
          activeCategory === "all"
            ? "bg-primary-soft font-medium text-primary shadow-sm"
            : "hover:bg-surface-container"
        }`}
      >
        <span className="inline-flex items-center gap-2">
          <LayoutGrid className="size-4 opacity-80" />
          הכל
        </span>
        <span className="tabular-nums text-xs text-on-surface-variant">{total}</span>
      </button>

      <div className="max-h-[50vh] space-y-0.5 overflow-y-auto pr-1">
        {dynamicCategories.map(({ category, count }) => {
          const Icon = iconFor(category);
          const active = activeCategory === category;
          return (
            <button
              type="button"
              key={category}
              onClick={() => onSelectCategory(category)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
                active
                  ? "bg-primary-soft font-medium text-primary shadow-sm"
                  : "text-on-surface hover:bg-surface-container"
              }`}
            >
              <span className="inline-flex min-w-0 items-center gap-2 text-right">
                <Icon className="size-4 shrink-0 opacity-80" />
                <span className="truncate">{categoryLabel(category)}</span>
              </span>
              <span className="shrink-0 tabular-nums text-xs text-on-surface-variant">{count}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
