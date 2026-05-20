import { categoryBadgeClass, categoryLabel } from "@/lib/categories";

interface CategoryBadgeProps {
  category: string;
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  return (
    <span
      className={`inline-block max-w-[10rem] truncate rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${categoryBadgeClass(category)}`}
      title={categoryLabel(category)}
    >
      {categoryLabel(category)}
    </span>
  );
}
