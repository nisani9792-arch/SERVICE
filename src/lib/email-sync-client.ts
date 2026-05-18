"use client";

export const EMAIL_SYNC_STORAGE_KEY = "service_last_email_sync_at";
/** Background re-sync while the app stays open (every 2 hours). */
export const EMAIL_SYNC_PERIODIC_MS = 2 * 60 * 60 * 1000;
export const EMAIL_SYNC_EVENT = "service-email-sync-complete";

export type EmailSyncResult = {
  ok: boolean;
  imported: number;
  reopened?: number;
  skipped: number;
  scanned: number;
  archived?: number;
  archiveMailbox?: string;
  errors?: string[];
  error?: string;
  details?: string;
};

let inFlight: Promise<EmailSyncResult> | null = null;

function readLastSyncAt(): number {
  try {
    return Number(localStorage.getItem(EMAIL_SYNC_STORAGE_KEY) || 0);
  } catch {
    return 0;
  }
}

export function markEmailSyncCompleted(): void {
  try {
    localStorage.setItem(EMAIL_SYNC_STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function shouldRunPeriodicEmailSync(): boolean {
  return Date.now() - readLastSyncAt() >= EMAIL_SYNC_PERIODIC_MS;
}

export function dispatchEmailSyncEvent(result: EmailSyncResult): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<EmailSyncResult>(EMAIL_SYNC_EVENT, { detail: result }));
}

export async function runEmailIngestClient(
  signal?: AbortSignal
): Promise<EmailSyncResult> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const res = await fetch("/api/email-ingest", {
      method: "POST",
      headers: { "x-service-dashboard": "true" },
      cache: "no-store",
      credentials: "same-origin",
      signal
    });

    const data = (await res.json().catch(() => ({}))) as EmailSyncResult & {
      error?: string;
      details?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        imported: 0,
        skipped: 0,
        scanned: 0,
        error: data.error ?? "Email sync failed",
        details: data.details
      };
    }

    markEmailSyncCompleted();
    return {
      ok: true,
      imported: data.imported ?? 0,
      reopened: data.reopened ?? 0,
      skipped: data.skipped ?? 0,
      scanned: data.scanned ?? 0,
      archived: data.archived,
      archiveMailbox: data.archiveMailbox,
      errors: Array.isArray(data.errors) ? data.errors : undefined
    };
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
