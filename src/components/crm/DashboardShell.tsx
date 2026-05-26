"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Route } from "next";
import {
  Archive,
  Inbox,
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
  icon: typeof Inbox;
  extra?: Record<string, string>;
};

const NAV: NavItem[] = [
  { view: "command", label: "מרכז פיקוד", icon: LayoutGrid },
  { view: "workbench", label: "לוח עיבוד", icon: Inbox },
  { view: "triage", label: "סינון מהיר", icon: ScanLine },
  { view: "rapid", label: "מענה מהיר", icon: Zap },
  { view: "review", label: "סקירה", icon: MessageSquareReply },
  { view: "workbench", label: "ארכיון", icon: Archive, extra: { bucket: "handled" } },
  { view: "trash", label: "סל מחזור", icon: Trash2 }
];

function hrefForItem(item: NavItem): Route {
  const sp = new URLSearchParams();
  sp.set("view", item.view);
  if (item.extra) {
    for (const [k, v] of Object.entries(item.extra)) sp.set(k, v);
  }
  return (`/dashboard?${sp.toString()}`) as Route;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = parseWorkspaceView(searchParams.get("view"));

  return (
    <div className="flex min-h-dvh bg-slate-50">
      <aside className="hidden w-64 shrink-0 flex-col border-e border-slate-200 bg-white shadow-sm md:flex">
        <div className="border-b border-slate-200 px-4 py-4">
          <p className="text-sm font-bold tracking-tight text-slate-900">Jusic CRM</p>
          <p className="text-[10px] font-medium text-slate-500">Elite Pro · Workspace</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {NAV.map((item) => {
            const href = hrefForItem(item);
            const bucket = searchParams.get("bucket") ?? "";
            const active =
              pathname.startsWith("/dashboard") &&
              currentView === item.view &&
              (!item.extra?.bucket || bucket === item.extra.bucket);
            const Icon = item.icon;
            return (
              <Link
                key={`${item.view}-${item.label}-${item.extra?.bucket ?? ""}`}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition",
                  active
                    ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-2">
          <Link
            href={"/mobile/triage" as Route}
            className="flex items-center gap-2 rounded-xl border border-dashed border-indigo-300 px-3 py-2 text-[10px] font-bold text-indigo-700"
          >
            <Smartphone className="size-4" />
            מצב סריקה (נייד)
          </Link>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-slate-50">{children}</div>
    </div>
  );
}
