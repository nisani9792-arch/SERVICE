import type { EmailIngestResult } from "@/lib/email-ingest";

let inFlightIngest: Promise<EmailIngestResult> | null = null;

/**
 * Coalesce concurrent ingest requests into a single run (cron + dashboard + visibility sync).
 */
export async function runIngestExclusive(run: () => Promise<EmailIngestResult>): Promise<EmailIngestResult> {
  if (inFlightIngest) return inFlightIngest;

  inFlightIngest = run().finally(() => {
    inFlightIngest = null;
  });

  return inFlightIngest;
}

export function isEmailIngestInFlight(): boolean {
  return inFlightIngest !== null;
}
