"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Route } from "next";
import {
  Archive,
  Inbox,
  Layers,
  LayoutGrid,
  MessageSquareReply,
  ScanLine,
  Smartphone,
  Trash2,
  Zap
} from "lucide-react";
import { cn } from "@/lib/cn";
import { parseWorkspaceView, type CrmWorkspaceView } from "@/lib/crm-workspace-views";

type NavItem = {
  view: CrmWorkspaceView;
  label: string;
  short: string;
  icon: typeof Inbox;
  href?: Route;
  extra?: Record<string, string>;
};

const NAV: NavItem[] = [
  { view: "workbench", label: "תיבת דואר", short: "דואר", icon: Inbox },
  { view: "triage", label: "סינון מהיר", short: "סינון", icon: ScanLine },
  { view: "rapid", label: "מענה מהיר", short: "מענה", icon: Zap },
  {
    view: "workbench",
    label: "חבילות מענה",
    short: "חבילות",
    icon: Layers,
    href: "/answer-bundles" as Route
  },
  { view: "review", label: "סקירה", short: "סקירה", icon: MessageSquareReply },
  { view: "workbench", label: "ארכיון", short: "ארכיון", icon: Archive, extra: { bucket: "handled" } },
  { view: "trash", label: "סל מחזור", short: "סל", icon: Trash2 }
];

function hrefForItem(item: NavItem): Route {
  if (item.href) return item.href;
  const sp = new URLSearchParams();
  sp.set("view", item.view);
  if (item.extra) {
    for (const [k, v] of Object.entries(item.extra)) sp.set(k, v);
  }
  return (`/dashboard?${sp.toString()}`) as Route;
}

function isNavActive(
  item: NavItem,
  pathname: string,
  currentView: CrmWorkspaceView,
  bucket: string
): boolean {
  if (item.href) {
    return pathname.startsWith(item.href);
  }
  return (
    pathname.startsWith("/dashboard") &&
    currentView === item.view &&
    (!item.extra?.bucket || bucket === item.extra.bucket)
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = parseWorkspaceView(searchParams.get("view"));
  const bucket = searchParams.get("bucket") ?? "";

  return (
    <div className="crm-workspace-shell flex h-dvh max-h-dvh overflow-hidden overflow-x-hidden bg-surface-container-low">
      <aside className="crm-workspace-rail hidden w-[3.25rem] shrink-0 flex-col border-e border-outline/40 bg-surface-container md:flex lg:w-14">
        <div className="flex h-12 items-center justify-center border-b border-outline/30">
          <Link
            href={"/dashboard?view=workbench" as Route}
            className="flex size-9 min-h-[48px] min-w-[48px] items-center justify-center rounded-jm3-md bg-gradient-to-br from-primary to-accent text-[10px] font-black text-white shadow-jm3-1 md:size-9 md:min-h-0 md:min-w-0"
            title="Jusic CRM"
          >
            J
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-1" aria-label="ניווט CRM">
          {NAV.map((item) => {
            const href = hrefForItem(item);
            const active = isNavActive(item, pathname, currentView, bucket);
            const Icon = item.icon;
            return (
              <Link
                key={`${item.view}-${item.label}-${item.extra?.bucket ?? item.href ?? ""}`}
                href={href}
                title={item.label}
                className={cn(
                  "flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-jm3-md py-2 text-[8px] font-bold leading-none transition md:min-h-0",
                  active
                    ? "bg-primary-soft text-primary ring-1 ring-primary/20"
                    : "text-on-surface-variant hover:bg-surface-high hover:text-on-surface"
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={active ? 2.25 : 2} />
                <span className="max-w-full truncate px-0.5">{item.short}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-outline/30 p-1">
          <Link
            href={"/dashboard?view=command" as Route}
            title="מרכז פיקוד"
            className={cn(
              "mb-1 flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-jm3-md py-2 text-[8px] font-bold md:min-h-0",
              currentView === "command"
                ? "bg-surface-high text-on-surface"
                : "text-on-surface-variant/70 hover:bg-surface-high"
            )}
          >
            <LayoutGrid className="size-4" />
            <span>פיקוד</span>
          </Link>
          <Link
            href={"/mobile/triage" as Route}
            title="מצב סריקה (נייד)"
            className="flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-jm3-md border border-dashed border-primary/25 py-2 text-[8px] font-bold text-primary md:min-h-0"
          >
            <Smartphone className="size-4" />
            <span>נייד</span>
          </Link>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">{children}</div>
    </div>
  );
}
