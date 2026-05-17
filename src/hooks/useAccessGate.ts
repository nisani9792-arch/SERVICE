"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const RESET_MS = 1600;
const REQUIRED_PRESSES = 3;
const ME_TIMEOUT_MS = 12_000;
const ME_RETRY_MS = 1_400;
const ME_MAX_ATTEMPTS = 4;
const COOKIE_SETTLE_MS = 120;
const DISPLAY_NAME_KEY = "service_operator_display_name";
const GATE_HINT_KEY = "service_gate_ok_at";

export type AccessGatePhase = "loading" | "locked" | "register" | "ready";

type OperatorMe = {
  unlocked: boolean;
  displayName: string | null;
};

type RegisterResponse = {
  ok?: boolean;
  displayName?: string;
  error?: string;
};

function writeGateHint(): void {
  try {
    localStorage.setItem(GATE_HINT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function readSavedDisplayName(): string | null {
  try {
    return localStorage.getItem(DISPLAY_NAME_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

function saveDisplayName(name: string): void {
  try {
    localStorage.setItem(DISPLAY_NAME_KEY, name);
  } catch {
    /* ignore */
  }
}

function waitForCookieSettle(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, COOKIE_SETTLE_MS);
  });
}

async function fetchOperatorMe(signal?: AbortSignal): Promise<OperatorMe | null> {
  const res = await fetch("/api/operator/me", {
    cache: "no-store",
    credentials: "same-origin",
    signal
  });
  if (!res.ok) return null;
  return (await res.json()) as OperatorMe;
}

async function fetchOperatorMeWithRetry(): Promise<OperatorMe | null> {
  for (let attempt = 0; attempt < ME_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), ME_TIMEOUT_MS);
    try {
      const data = await fetchOperatorMe(controller.signal);
      if (data) return data;
    } catch {
      /* retry */
    } finally {
      window.clearTimeout(timer);
    }
    if (attempt < ME_MAX_ATTEMPTS - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, ME_RETRY_MS));
    }
  }
  return null;
}

async function postUnlock(method: "code" | "space" | "biometric", code?: string): Promise<boolean> {
  const res = await fetch("/api/operator/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, code }),
    cache: "no-store",
    credentials: "same-origin"
  });
  return res.ok;
}

export function useAccessGate() {
  const savedNameRef = useRef<string | null>(null);
  const autoRegisterAttemptedRef = useRef(false);
  const [phase, setPhase] = useState<AccessGatePhase>("loading");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [savedDisplayName, setSavedDisplayName] = useState<string | null>(() => readSavedDisplayName());

  const applyMe = useCallback((data: OperatorMe) => {
    if (data.unlocked && data.displayName) {
      setDisplayName(data.displayName);
      setPhase("ready");
      writeGateHint();
      saveDisplayName(data.displayName);
      return;
    }
    if (data.unlocked) {
      setDisplayName(null);
      setPhase("register");
      writeGateHint();
      return;
    }
    setDisplayName(null);
    setPhase("locked");
  }, []);

  const applyRegistered = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    savedNameRef.current = trimmed;
    setSavedDisplayName(trimmed);
    setDisplayName(trimmed);
    setPhase("ready");
    writeGateHint();
    saveDisplayName(trimmed);
  }, []);

  const refreshMe = useCallback(async () => {
    const data = await fetchOperatorMeWithRetry();
    if (!data) {
      setPhase("locked");
      setDisplayName(null);
      return;
    }
    applyMe(data);
  }, [applyMe]);

  useEffect(() => {
    const stored = readSavedDisplayName();
    if (stored) {
      savedNameRef.current = stored;
      setSavedDisplayName(stored);
    }
    void refreshMe();
  }, [refreshMe]);

  const registerDisplayName = useCallback(
    async (name: string): Promise<boolean> => {
      const trimmed = name.trim();
      if (!trimmed) return false;

      setRegisterBusy(true);
      try {
        const res = await fetch("/api/operator/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: trimmed }),
          cache: "no-store",
          credentials: "same-origin"
        });
        const body = (await res.json().catch(() => ({}))) as RegisterResponse;
        if (!res.ok) return false;

        if (body.displayName?.trim()) {
          applyRegistered(body.displayName.trim());
          return true;
        }

        await waitForCookieSettle();
        const me = await fetchOperatorMeWithRetry();
        if (me?.unlocked && me.displayName) {
          applyMe(me);
          return true;
        }
        return Boolean(body.ok);
      } catch {
        return false;
      } finally {
        setRegisterBusy(false);
      }
    },
    [applyMe, applyRegistered]
  );

  useEffect(() => {
    if (phase !== "register" || !savedDisplayName || registerBusy || autoRegisterAttemptedRef.current) {
      return;
    }
    autoRegisterAttemptedRef.current = true;
    void registerDisplayName(savedDisplayName);
  }, [phase, savedDisplayName, registerBusy, registerDisplayName]);

  useEffect(() => {
    if (phase !== "register") {
      autoRegisterAttemptedRef.current = false;
    }
  }, [phase]);

  const unlockGate = useCallback(
    async (method: "code" | "space" | "biometric", code?: string) => {
      setUnlockError(null);
      const ok = await postUnlock(method, code);
      if (!ok) {
        setUnlockError(method === "code" ? "קוד כניסה שגוי" : "פתיחת המנעול נכשלה");
        return false;
      }
      await waitForCookieSettle();
      await refreshMe();
      return true;
    },
    [refreshMe]
  );

  const registerName = useCallback(
    async (name: string) => registerDisplayName(name),
    [registerDisplayName]
  );

  const checkGateCode = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return false;
      return unlockGate("code", trimmed.toUpperCase());
    },
    [unlockGate]
  );

  useEffect(() => {
    if (phase !== "locked") return;

    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    let pressCount = 0;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;
      event.preventDefault();

      pressCount += 1;
      if (pressCount >= REQUIRED_PRESSES) {
        void unlockGate("space");
        pressCount = 0;
        return;
      }

      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        pressCount = 0;
      }, RESET_MS);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(resetTimer);
    };
  }, [phase, unlockGate]);

  return {
    phase,
    displayName,
    registerBusy,
    unlockError,
    savedDisplayName,
    unlockGate,
    registerName,
    checkGateCode,
    refreshMe
  };
}
