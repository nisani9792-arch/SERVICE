"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  platforms: string[];
  userChoice: Promise<InstallChoice>;
  prompt: () => Promise<void>;
}

const DISMISS_KEY = "jusic-pwa-install-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in nav && Boolean(nav.standalone))
  );
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const ios = useMemo(() => isIos(), []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        void registration.unregister();
      }
    });

    if ("caches" in window) {
      void caches.keys().then((keys) => {
        for (const key of keys) {
          void caches.delete(key);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (isStandalone() || window.localStorage.getItem(DISMISS_KEY) === "1") {
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onAppInstalled = () => {
      window.localStorage.setItem(DISMISS_KEY, "1");
      setVisible(false);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    if (ios) {
      setVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [ios]);

  const dismiss = useCallback(() => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) return;

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
    setVisible(false);
    setInstallEvent(null);
  }, [installEvent]);

  if (!visible || isStandalone()) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-3xl border border-outline/80 bg-white/95 p-4 text-right shadow-2xl backdrop-blur-md md:bottom-6">
      <button
        type="button"
        onClick={dismiss}
        className="absolute left-3 top-3 inline-flex size-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
        aria-label="סגור הצעת התקנה"
      >
        <X className="size-4" />
      </button>

      <div className="flex gap-3 pl-8">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Smartphone className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-on-surface">להתקין את SERVICE?</p>
          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
            גישה מהירה מהמסך הראשי, תצוגה נוחה בסמארטפון וחווייה כמו אפליקציה.
          </p>
          {ios && !installEvent ? (
            <p className="mt-2 rounded-xl bg-surface-container px-3 py-2 text-xs leading-relaxed text-on-surface">
              באייפון: לחיצה על Share בדפדפן ואז Add to Home Screen.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={installEvent ? install : dismiss}
          className="lux-button-primary rounded-2xl"
        >
          <Download className="size-4" />
          {installEvent ? "התקנה" : "הבנתי"}
        </button>
        <button type="button" onClick={dismiss} className="lux-button rounded-2xl">
          אחר כך
        </button>
      </div>
    </div>
  );
}
