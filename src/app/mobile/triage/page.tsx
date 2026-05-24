"use client";

import { Suspense } from "react";
import { MobileFocusEngine } from "@/components/triage/MobileFocusEngine";

export default function MobileTriagePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm">טוען סריקה…</div>
      }
    >
      <MobileFocusEngine />
    </Suspense>
  );
}
