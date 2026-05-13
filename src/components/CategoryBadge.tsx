import { categoryBadgeClass, categoryLabel } from "@/lib/categories";

interface CategoryBadgeProps {
  category: string;
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  return (
    <span
      className={`inline-block max-w-[10rem] truncate rounded-full px-2.5 py-1 text-xs font-medium ${categoryBadgeClass(category)}`}
      title={categoryLabel(category)}
    >
      {categoryLabel(category)}
    </span>
  );
}
