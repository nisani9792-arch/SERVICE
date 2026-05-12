import { CATEGORY_COLORS, CATEGORY_LABELS_HE } from "@/lib/categories";
import { TicketCategory } from "@/lib/types";

interface CategoryBadgeProps {
  category: TicketCategory;
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${CATEGORY_COLORS[category]}`}
    >
      {CATEGORY_LABELS_HE[category]}
    </span>
  );
}
