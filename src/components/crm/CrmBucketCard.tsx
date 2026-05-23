import Link from "next/link";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";

export type CrmBucketCardProps = {
  href: Route;
  label: string;
  count: number | null;
  hint?: string;
  icon: LucideIcon;
  accentClass: string;
};

export function CrmBucketCard({
  href,
  label,
  count,
  hint,
  icon: Icon,
  accentClass
}: CrmBucketCardProps) {
  return (
    <Link
      href={href}
      className={`glass-panel block rounded-2xl border p-3 transition hover:shadow-glow-sm ${accentClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-right">
          <p className="text-[11px] font-semibold text-on-surface-variant">{label}</p>
          <p className="mt-0.5 text-2xl font-black tabular-nums text-on-surface">
            {count != null ? count.toLocaleString("he-IL") : "—"}
          </p>
          {hint ? <p className="mt-1 text-[10px] text-on-surface-variant">{hint}</p> : null}
        </div>
        <span className="rounded-xl bg-white/80 p-2 shadow-sm">
          <Icon className="size-5 opacity-90" />
        </span>
      </div>
    </Link>
  );
}
