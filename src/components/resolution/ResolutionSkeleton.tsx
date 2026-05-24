"use client";

import { cn } from "@/lib/cn";

type ResolutionSkeletonProps = {
  rows?: number;
  className?: string;
  variant?: "list" | "detail";
};

/** Elegant loading placeholders for the Deep Resolution Engine — no spinners. */
export function ResolutionSkeleton({
  rows = 6,
  className,
  variant = "list"
}: ResolutionSkeletonProps) {
  if (variant === "detail") {
    return (
      <div
        className={cn("flex h-full flex-col gap-3 p-4", className)}
        aria-busy="true"
        aria-label="טוען פרטי פנייה"
      >
        <div className="jds-skeleton h-6 w-2/5 rounded-lg" />
        <div className="jds-skeleton h-8 w-full rounded-lg" />
        <div className="jds-skeleton min-h-[8rem] flex-1 rounded-xl2" />
        <div className="jds-skeleton h-24 rounded-xl2" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-2 p-2", className)} aria-busy="true" aria-label="טוען פניות">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="jds-skeleton h-[5.5rem] rounded-xl2"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}
