import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

export function CrmPageShell({
  title,
  subtitle,
  backHref = "/" as Route,
  actions,
  children
}: {
  title: string;
  subtitle?: string;
  backHref?: Route;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-20 border-b border-outline/60 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Link
            href={backHref}
            className="rounded-xl border border-outline p-2 text-on-surface-variant hover:bg-surface-container"
            aria-label="חזרה"
          >
            <ArrowRight className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-on-surface">{title}</h1>
            {subtitle ? (
              <p className="text-[11px] text-on-surface-variant">{subtitle}</p>
            ) : null}
          </div>
          {actions}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3 py-4 md:px-4">{children}</main>
    </div>
  );
}
