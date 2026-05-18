"use client";

import { useAutoEmailSync } from "@/hooks/useAutoEmailSync";

/** Runs inbox ingest as soon as the operator passes the gate. */
export function EmailSyncOnEntry() {
  useAutoEmailSync(true);
  return null;
}
