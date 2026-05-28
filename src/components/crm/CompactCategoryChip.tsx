"use client";

import { categoryBadgeClass, categoryLabel } from "@/lib/categories";
import { CUSTOMER_FOLLOWUP_CATEGORY, PENDING_TRIAGE_CATEGORY } from "@/lib/triage";
import { cn } from "@/lib/cn";

const SHORT_LABELS: Record<string, string> = {
  [PENDING_TRIAGE_CATEGORY]: "סינון",
  [CUSTOMER_FOLLOWUP_CATEGORY]: "חוזר",
  suggestions: "הצעות",
  bugs: "באגים",
  premium: "פרימיום",
  copyright: "זכויות",
  artist: "זמר",
  spam: "ספאם",
  Customer_Support: "שירות",
  Billing: "חיוב",
  Spam: "ספאם"
};

function shortLabel(category: string): string {
  return SHORT_LABELS[category] ?? categoryLabel(category).slice(0, 12);
}

export function CompactCategoryChip({
  category,
  className
}: {
  category: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-[4.5rem] shrink-0 truncate rounded-md px-1 py-px text-[9px] font-bold leading-none",
        categoryBadgeClass(category),
        className
      )}
      title={categoryLabel(category)}
    >
      {shortLabel(category)}
    </span>
  );
}
