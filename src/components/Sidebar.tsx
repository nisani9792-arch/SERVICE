import { LayoutGrid } from "lucide-react";
import {
  ACTIVE_CATEGORIES,
  CATEGORY_ICONS,
  CATEGORY_LABELS_HE
} from "@/lib/categories";
import { TicketCategory } from "@/lib/types";

const SIDEBAR_CATEGORIES: TicketCategory[] = [...ACTIVE_CATEGORIES, "handled"];

interface SidebarProps {
  activeCategory: TicketCategory | "all";
  counts: Record<TicketCategory | "all", number>;
  onSelectCategory: (category: TicketCategory | "all") => void;
}

export function Sidebar({
  activeCategory,
  counts,
  onSelectCategory
}: SidebarProps) {
  return (
    <aside className="lux-card h-fit w-full p-3 lg:sticky lg:top-6 lg:w-72">
      <p className="mb-4 px-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        Workspaces
      </p>

      <button
        onClick={() => onSelectCategory("all")}
        className={`mb-2 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
          activeCategory === "all"
            ? "bg-primary-soft text-primary"
            : "hover:bg-surface-container"
        }`}
      >
        <span className="inline-flex items-center gap-2">
          <LayoutGrid className="size-4" />
          כל הפניות
        </span>
        <span className="text-xs">{counts.all}</span>
      </button>

      <div className="space-y-1">
        {SIDEBAR_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category];
          const active = activeCategory === category;
          return (
            <button
              key={category}
              onClick={() => onSelectCategory(category)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-primary-soft text-primary"
                  : "text-on-surface hover:bg-surface-container"
              }`}
            >
              <span className="inline-flex items-center gap-2 text-right">
                <Icon className="size-4" />
                {CATEGORY_LABELS_HE[category]}
              </span>
              <span className="text-xs">{counts[category]}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
