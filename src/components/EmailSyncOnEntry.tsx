"use client";

import { usePathname } from "next/navigation";
import { useAutoEmailSync } from "@/hooks/useAutoEmailSync";

/** Runs inbox ingest on gate unlock and on each in-app navigation. */
export function EmailSyncOnEntry() {
  const pathname = usePathname();
  useAutoEmailSync(true, pathname);
  return null;
}
