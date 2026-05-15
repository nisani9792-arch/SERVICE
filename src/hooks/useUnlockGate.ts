"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "service-crm-unlocked";
const RESET_MS = 1600;
const REQUIRED_PRESSES = 3;

export function useUnlockGate() {
  const [unlocked, setUnlocked] = useState(
    () => typeof sessionStorage !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "1"
  );

  const unlock = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setUnlocked(true);
  }, []);

  useEffect(() => {
    if (unlocked) return;

    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    let pressCount = 0;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;
      event.preventDefault();

      pressCount += 1;
      if (pressCount >= REQUIRED_PRESSES) {
        unlock();
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
  }, [unlocked, unlock]);

  return { unlocked, unlock };
}
