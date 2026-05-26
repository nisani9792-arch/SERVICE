import { Suspense } from "react";
import { CrmWorkspace } from "@/components/crm/CrmWorkspace";

/** Unified Viewport CRM — all panels route via ?view=… (see middleware). */
export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-600">
          טוען סביבת עבודה…
        </div>
      }
    >
      <CrmWorkspace />
    </Suspense>
  );
}
