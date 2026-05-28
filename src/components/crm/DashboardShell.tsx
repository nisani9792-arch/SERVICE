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
    <div className="crm-workspace-shell flex h-dvh max-h-dvh overflow-hidden bg-slate-100">
      <aside className="crm-workspace-rail hidden w-[3.25rem] shrink-0 flex-col border-e border-slate-200/90 bg-white md:flex lg:w-14">
        <div className="flex h-12 items-center justify-center border-b border-slate-200/80">
          <Link
            href={"/dashboard?view=workbench" as Route}
            className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-[10px] font-black text-white shadow-sm"
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
                  "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[8px] font-bold leading-none transition",
                  active
                    ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={active ? 2.25 : 2} />
                <span className="max-w-full truncate px-0.5">{item.short}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200/80 p-1">
          <Link
            href={"/dashboard?view=command" as Route}
            title="מרכז פיקוד"
            className={cn(
              "mb-1 flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[8px] font-bold",
              currentView === "command"
                ? "bg-slate-100 text-slate-800"
                : "text-slate-400 hover:bg-slate-50"
            )}
          >
            <LayoutGrid className="size-4" />
            <span>פיקוד</span>
          </Link>
          <Link
            href={"/mobile/triage" as Route}
            title="מצב סריקה (נייד)"
            className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-indigo-200 py-2 text-[8px] font-bold text-indigo-600"
          >
            <Smartphone className="size-4" />
            <span>נייד</span>
          </Link>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
