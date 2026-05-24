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
  size?: "default" | "lg";
};

export function CrmBucketCard({
  href,
  label,
  count,
  hint,
  icon: Icon,
  accentClass,
  size = "default"
}: CrmBucketCardProps) {
  const large = size === "lg";
  return (
    <Link
      href={href}
      className={`glass-panel block rounded-2xl border transition hover:shadow-glow-sm ${large ? "p-4 md:p-5" : "p-3"} ${accentClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-right">
          <p
            className={`font-semibold text-on-surface-variant ${large ? "text-xs md:text-sm" : "text-[11px]"}`}
          >
            {label}
          </p>
          <p
            className={`mt-0.5 font-black tabular-nums text-on-surface ${large ? "text-2xl md:text-3xl" : "text-2xl"}`}
          >
            {count != null ? count.toLocaleString("he-IL") : "—"}
          </p>
          {hint ? (
            <p className={`mt-1 text-on-surface-variant ${large ? "text-[11px] md:text-xs" : "text-[10px]"}`}>
              {hint}
            </p>
          ) : null}
        </div>
        <span className={`rounded-xl bg-white/80 shadow-sm ${large ? "p-2.5" : "p-2"}`}>
          <Icon className={large ? "size-6 opacity-90" : "size-5 opacity-90"} />
        </span>
      </div>
    </Link>
  );
}
