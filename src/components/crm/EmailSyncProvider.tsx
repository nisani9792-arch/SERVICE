"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { formatSkipReasons } from "@/lib/email-ingest-labels";
import {
  EMAIL_SYNC_EVENT,
  runEmailIngestClient,
  type EmailSyncResult
} from "@/lib/email-sync-client";

const EMAIL_SYNC_TOAST_MS = 6000;

export type EmailSyncToast = {
  kind: "success" | "error";
  text: string;
};

export type EmailSyncContextValue = {
  emailSyncing: boolean;
  emailSyncMessage: EmailSyncToast | null;
  emailSyncToastLeaving: boolean;
  lastEmailSyncedAt: Date | null;
  handleEmailSync: () => Promise<void>;
  dismissEmailSyncToast: () => void;
  showSyncToast: (toast: EmailSyncToast) => void;
};

const EmailSyncContext = createContext<EmailSyncContextValue | null>(null);

export function EmailSyncProvider({
  children,
  onSyncComplete
}: {
  children: ReactNode;
  onSyncComplete?: (result: EmailSyncResult) => void;
}) {
  const [emailSyncing, setEmailSyncing] = useState(false);
  const [emailSyncMessage, setEmailSyncMessage] = useState<EmailSyncToast | null>(null);
  const [emailSyncToastLeaving, setEmailSyncToastLeaving] = useState(false);
  const [lastEmailSyncedAt, setLastEmailSyncedAt] = useState<Date | null>(null);
  const emailSyncToastTimerRef = useRef<number | null>(null);
  const onSyncCompleteRef = useRef(onSyncComplete);
  onSyncCompleteRef.current = onSyncComplete;

  const applyEmailSyncResult = useCallback((result: EmailSyncResult, source: "auto" | "manual") => {
    setLastEmailSyncedAt(new Date());

    if (!result.ok) {
      setEmailSyncMessage({
        kind: "error",
        text: `סנכרון המייל נכשל: ${result.details || result.error || "שגיאה לא ידועה"}`
      });
      return;
    }

    onSyncCompleteRef.current?.(result);

    const skipHint = formatSkipReasons(result.skipReasons);
    const errorHint = result.errors?.length
      ? ` שגיאות: ${result.errors.slice(0, 2).join(" · ")}`
      : "";
    const skipDetail = skipHint ? ` סיבות דילוג: ${skipHint}.` : "";

    if (
      (result.imported ?? 0) > 0 ||
      (result.followupsAttached ?? 0) > 0 ||
      (result.reopened ?? 0) > 0
    ) {
      const parts: string[] = [];
      if ((result.imported ?? 0) > 0) parts.push(`${result.imported} פניות חדשות`);
      if ((result.followupsAttached ?? 0) > 0) {
        parts.push(`${result.followupsAttached} תשובות חוזרות לפניות קיימות`);
      }
      if ((result.reopened ?? 0) > 0) parts.push(`${result.reopened} פניות נפתחו מחדש`);
      setEmailSyncMessage({
        kind: "success",
        text:
          source === "auto"
            ? `סנכרון אוטומטי: ${parts.join(", ")} ממייל.`
            : `סנכרון מיילים הושלם: ${parts.join(", ")}.${errorHint}`
      });
      return;
    }

    setEmailSyncMessage({
      kind: "success",
      text: `סנכרון מיילים: לא נמצאו פניות חדשות (${result.scanned ?? 0} נסרקו, ${result.skipped ?? 0} דולגו).${skipDetail}${errorHint}`
    });
  }, []);

  const handleEmailSync = useCallback(async () => {
    setEmailSyncing(true);
    setEmailSyncMessage(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 120_000);

    try {
      const result = await runEmailIngestClient(controller.signal, { force: true });
      applyEmailSyncResult(result, "manual");
    } catch (error) {
      setEmailSyncMessage({
        kind: "error",
        text: `סנכרון המייל נכשל: ${
          error instanceof Error && error.name === "AbortError"
            ? "הפעולה נתקעה מעל דקה. בדוק את הגדרות Gmail/Render ונסה שוב."
            : error instanceof Error
              ? error.message
              : "שגיאה לא ידועה"
        }`
      });
    } finally {
      window.clearTimeout(timeout);
      setEmailSyncing(false);
    }
  }, [applyEmailSyncResult]);

  const dismissEmailSyncToast = useCallback(() => {
    setEmailSyncMessage(null);
    setEmailSyncToastLeaving(false);
  }, []);

  const showSyncToast = useCallback((toast: EmailSyncToast) => {
    setEmailSyncMessage(toast);
  }, []);

  useEffect(() => {
    const onAutoSync = (event: Event) => {
      const detail = (event as CustomEvent<EmailSyncResult>).detail;
      if (!detail) return;
      applyEmailSyncResult(detail, "auto");
    };

    window.addEventListener(EMAIL_SYNC_EVENT, onAutoSync);
    return () => window.removeEventListener(EMAIL_SYNC_EVENT, onAutoSync);
  }, [applyEmailSyncResult]);

  useEffect(() => {
    if (!emailSyncMessage) {
      setEmailSyncToastLeaving(false);
      return;
    }

    setEmailSyncToastLeaving(false);
    if (emailSyncToastTimerRef.current) {
      clearTimeout(emailSyncToastTimerRef.current);
    }

    const fadeAt = Math.max(500, EMAIL_SYNC_TOAST_MS - 400);
    const fadeTimer = window.setTimeout(() => setEmailSyncToastLeaving(true), fadeAt);
    emailSyncToastTimerRef.current = window.setTimeout(() => {
      setEmailSyncMessage(null);
      setEmailSyncToastLeaving(false);
    }, EMAIL_SYNC_TOAST_MS);

    return () => {
      clearTimeout(fadeTimer);
      if (emailSyncToastTimerRef.current) {
        clearTimeout(emailSyncToastTimerRef.current);
        emailSyncToastTimerRef.current = null;
      }
    };
  }, [emailSyncMessage]);

  const value = useMemo(
    () => ({
      emailSyncing,
      emailSyncMessage,
      emailSyncToastLeaving,
      lastEmailSyncedAt,
      handleEmailSync,
      dismissEmailSyncToast,
      showSyncToast
    }),
    [
      emailSyncing,
      emailSyncMessage,
      emailSyncToastLeaving,
      lastEmailSyncedAt,
      handleEmailSync,
      dismissEmailSyncToast,
      showSyncToast
    ]
  );

  return <EmailSyncContext.Provider value={value}>{children}</EmailSyncContext.Provider>;
}

export function useEmailSync(): EmailSyncContextValue {
  const ctx = useContext(EmailSyncContext);
  if (!ctx) {
    throw new Error("useEmailSync must be used within EmailSyncProvider");
  }
  return ctx;
}
