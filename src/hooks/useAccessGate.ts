"use client";

import { useCallback, useEffect, useState } from "react";

const RESET_MS = 1600;
const REQUIRED_PRESSES = 3;
const GATE_CODE = "JUSIC";

export type AccessGatePhase = "loading" | "locked" | "register" | "ready";

type OperatorMe = {
  unlocked: boolean;
  displayName: string | null;
};

async function postUnlock(method: "code" | "space" | "biometric", code?: string): Promise<boolean> {
  const res = await fetch("/api/operator/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, code }),
    cache: "no-store"
  });
  return res.ok;
}

export function useAccessGate() {
  const [phase, setPhase] = useState<AccessGatePhase>("loading");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const applyMe = useCallback((data: OperatorMe) => {
    if (data.unlocked && data.displayName) {
      setDisplayName(data.displayName);
      setPhase("ready");
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
    try {
      const res = await fetch("/api/operator/me", { cache: "no-store" });
      if (!res.ok) {
        setPhase("locked");
        return;
      }
      const data = (await res.json()) as OperatorMe;
      applyMe(data);
    } catch {
      setPhase("locked");
    }
  }, [applyMe]);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

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
          cache: "no-store"
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

  const checkGateCode = useCallback(
    (value: string) => {
      if (value.trim().toUpperCase() === GATE_CODE) {
        void unlockGate("code", value.trim().toUpperCase());
        return true;
      }
      return false;
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
    unlockGate,
    registerName,
    checkGateCode,
    refreshMe
  };
}
