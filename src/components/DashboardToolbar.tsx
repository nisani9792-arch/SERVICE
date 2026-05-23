"use client";

import { SearchBar } from "@/components/SearchBar";
import { categoryLabel } from "@/lib/categories";

export type DashboardToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  activeCategory: string | "all";
  categories: Array<{ category: string; count: number }>;
  onCategoryChange: (category: string | "all") => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  tagsFilter: string;
  onTagsFilterChange: (value: string) => void;
  showAdvancedTools?: boolean;
  onSortAllOpen?: () => void;
  onSpamSweep?: () => void;
  onMaintenance?: () => void;
  toolsBusy?: boolean;
};

export function DashboardToolbar({
  searchValue,
  onSearchChange,
  activeCategory,
  categories,
  onCategoryChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  tagsFilter,
  onTagsFilterChange,
  showAdvancedTools = false,
  onSortAllOpen,
  onSpamSweep,
  onMaintenance,
  toolsBusy = false
}: DashboardToolbarProps) {
  return (
    <div className="space-y-2">
      {onSortAllOpen ? (
        <button
          type="button"
          disabled={toolsBusy}
          onClick={onSortAllOpen}
          className="crm-touch-target w-full rounded-xl border border-violet-300 bg-violet-50 px-3 py-2.5 text-xs font-bold text-violet-950 disabled:opacity-50"
        >
          {toolsBusy ? "ממיין את התור הפתוח…" : "מיין את כל התור הפתוח (AI + חבילות)"}
        </button>
      ) : null}
      <SearchBar value={searchValue} onChange={onSearchChange} />

      <details className="rounded-xl border border-outline/80 bg-surface-high/80 px-3 py-2">
        <summary className="cursor-pointer select-none text-xs font-bold text-on-surface">
          מסננים נוספים
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-[11px] font-medium text-on-surface-variant">
            קטגוריה
            <select
              className="mt-1 w-full rounded-lg border border-outline/80 bg-white px-2 py-2 text-xs outline-none focus:border-primary/50"
              value={activeCategory}
              onChange={(event) => onCategoryChange(event.target.value)}
            >
              <option value="all">כל הקטגוריות</option>
              {categories.map((item) => (
                <option key={item.category} value={item.category}>
                  {categoryLabel(item.category)} ({item.count.toLocaleString("he-IL")})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] font-medium text-on-surface-variant">
            מתאריך
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-outline/80 bg-white px-2 py-2 text-xs outline-none focus:border-primary/50"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
            />
          </label>
          <label className="block text-[11px] font-medium text-on-surface-variant">
            עד תאריך
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-outline/80 bg-white px-2 py-2 text-xs outline-none focus:border-primary/50"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
            />
          </label>
          <label className="block text-[11px] font-medium text-on-surface-variant">
            תגיות
            <input
              className="mt-1 w-full rounded-lg border border-outline/80 bg-white px-2 py-2 text-xs outline-none focus:border-primary/50"
              placeholder="REPLIED, vip"
              value={tagsFilter}
              onChange={(e) => onTagsFilterChange(e.target.value)}
            />
          </label>
        </div>
      </details>

      {showAdvancedTools ? (
        <details className="rounded-xl border border-outline/60 bg-white/70 px-3 py-2">
          <summary className="cursor-pointer select-none text-[11px] font-bold text-on-surface-variant">
            תחזוקה ו-AI (לפי דרישה)
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={toolsBusy}
              onClick={onSpamSweep}
              className="crm-touch-target lux-button border-amber-200 bg-amber-50 text-amber-950 text-xs disabled:opacity-50"
            >
              {toolsBusy ? "סורק…" : "סריקת ספאם"}
            </button>
            <button
              type="button"
              disabled={toolsBusy}
              onClick={onMaintenance}
              className="crm-touch-target lux-button border-violet-200 bg-violet-50 text-violet-950 text-xs disabled:opacity-50"
            >
              {toolsBusy ? "רץ…" : "תיקון מיילים + סיווג AI"}
            </button>
          </div>
        </details>
      ) : null}
    </div>
  );
}
