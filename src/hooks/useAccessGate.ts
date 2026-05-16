"use client";

import { useCallback, useEffect, useState } from "react";

const RESET_MS = 1600;
const REQUIRED_PRESSES = 3;
const ME_TIMEOUT_MS = 15_000;
const DISPLAY_NAME_KEY = "service_operator_display_name";

export type AccessGatePhase = "loading" | "locked" | "register" | "ready";

type OperatorMe = {
  unlocked: boolean;
  displayName: string | null;
};

async function fetchOperatorMe(): Promise<OperatorMe | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ME_TIMEOUT_MS);
  try {
    const res = await fetch("/api/operator/me", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal
    });
    if (!res.ok) return null;
    return (await res.json()) as OperatorMe;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
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
  const [phase, setPhase] = useState<AccessGatePhase>("loading");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [savedDisplayName, setSavedDisplayName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISPLAY_NAME_KEY)?.trim();
      if (stored) setSavedDisplayName(stored);
    } catch {
      /* private mode */
    }
  }, []);

  const applyMe = useCallback((data: OperatorMe) => {
    if (data.unlocked && data.displayName) {
      setDisplayName(data.displayName);
      setPhase("ready");
      try {
        localStorage.setItem(DISPLAY_NAME_KEY, data.displayName);
      } catch {
        /* ignore */
      }
      return;
    }
    if (data.unlocked) {
      setDisplayName(null);
      setPhase("register");
      return;
    }
    setDisplayName(null);
    setPhase("locked");
  }, []);

  const refreshMe = useCallback(async () => {
    const data = await fetchOperatorMe();
    if (!data) {
      setPhase("locked");
      return;
    }
    applyMe(data);
  }, [applyMe]);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const tryAutoRegister = useCallback(
    async (name: string) => {
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
        if (!res.ok) return false;
        await refreshMe();
        return true;
      } catch {
        return false;
      } finally {
        setRegisterBusy(false);
      }
    },
    [refreshMe]
  );

  useEffect(() => {
    if (phase !== "register" || !savedDisplayName || registerBusy) return;
    void tryAutoRegister(savedDisplayName);
  }, [phase, savedDisplayName, registerBusy, tryAutoRegister]);

  const unlockGate = useCallback(
    async (method: "code" | "space" | "biometric", code?: string) => {
      setUnlockError(null);
      const ok = await postUnlock(method, code);
      if (!ok) {
        setUnlockError(method === "code" ? "קוד כניסה שגוי" : "פתיחת המנעול נכשלה");
        return false;
      }
      await refreshMe();
      return true;
    },
    [refreshMe]
  );

  const registerName = useCallback(
    async (name: string) => {
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
        if (!res.ok) return false;
        try {
          localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
        } catch {
          /* ignore */
        }
        await refreshMe();
        return true;
      } catch {
        return false;
      } finally {
        setRegisterBusy(false);
      }
    },
    [refreshMe]
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
