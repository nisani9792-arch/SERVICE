"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const RESET_MS = 1600;
const REQUIRED_PRESSES = 3;
const ME_TIMEOUT_MS = 12_000;
const ME_RETRY_MS = 1_400;
const ME_MAX_ATTEMPTS = 4;
const DISPLAY_NAME_KEY = "service_operator_display_name";
const GATE_HINT_KEY = "service_gate_ok_at";
const GATE_HINT_MS = 30 * 24 * 60 * 60 * 1000;

export type AccessGatePhase = "loading" | "locked" | "register" | "ready";

type OperatorMe = {
  unlocked: boolean;
  displayName: string | null;
};

function readGateHint(): boolean {
  try {
    const at = Number(localStorage.getItem(GATE_HINT_KEY));
    return Number.isFinite(at) && Date.now() - at < GATE_HINT_MS;
  } catch {
    return false;
  }
}

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
  const [phase, setPhase] = useState<AccessGatePhase>(() => {
    const saved = readSavedDisplayName();
    savedNameRef.current = saved;
    if (saved && readGateHint()) return "ready";
    return "loading";
  });
  const [displayName, setDisplayName] = useState<string | null>(() => {
    const saved = readSavedDisplayName();
    return saved && readGateHint() ? saved : null;
  });
  const [registerBusy, setRegisterBusy] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [savedDisplayName, setSavedDisplayName] = useState<string | null>(() => readSavedDisplayName());

  const applyMe = useCallback((data: OperatorMe) => {
    if (data.unlocked && data.displayName) {
      setDisplayName(data.displayName);
      setPhase("ready");
      writeGateHint();
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
      writeGateHint();
      return;
    }
    setDisplayName(null);
    setPhase("locked");
  }, []);

  const refreshMe = useCallback(async () => {
    const data = await fetchOperatorMeWithRetry();
    if (!data) {
      const saved = savedNameRef.current ?? readSavedDisplayName();
      if (saved && readGateHint()) {
        setDisplayName(saved);
        setPhase("ready");
        return;
      }
      setPhase("locked");
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
          savedNameRef.current = trimmed;
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
