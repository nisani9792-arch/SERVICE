"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  Archive,
  Inbox,
  LayoutGrid,
  MessageSquareReply,
  Smartphone,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/cn";

const NAV: Array<{ href: Route; label: string; icon: typeof Inbox }> = [
  { href: "/dashboard", label: "מרכז פיקוד", icon: LayoutGrid },
  { href: "/dashboard/inbox", label: "עיבוד פניות", icon: Inbox },
  { href: "/answer-bundles", label: "חבילות מענה", icon: MessageSquareReply },
  { href: "/dashboard/inbox", label: "ארכיון", icon: Archive },
  { href: "/trash", label: "סל", icon: Trash2 }
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh bg-surface">
      <aside className="hidden w-56 shrink-0 flex-col border-e border-outline/60 bg-white/80 backdrop-blur-xl md:flex">
        <div className="border-b border-outline/50 px-4 py-4">
          <p className="text-sm font-bold tracking-tight text-on-surface">Jusic CRM</p>
          <p className="text-[10px] font-medium text-on-surface-variant">Pro Command Center</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/dashboard/inbox" && pathname.startsWith("/dashboard/inbox"));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-on-surface-variant hover:bg-surface-container"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-outline/50 p-2">
          <Link
            href={"/mobile/triage" as Route}
            className="flex items-center gap-2 rounded-xl border border-dashed border-primary/40 px-3 py-2 text-[10px] font-bold text-primary"
          >
            <Smartphone className="size-4" />
            מצב סריקה (נייד)
          </Link>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
