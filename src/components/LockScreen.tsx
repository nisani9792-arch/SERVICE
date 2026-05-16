"use client";

import { Fingerprint, Lock } from "lucide-react";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { useBiometricUnlock } from "@/hooks/useBiometricUnlock";
import { APP_LOGO_SRC } from "@/lib/brand";
import "./LockScreen.css";

interface LockScreenProps {
  onBiometricUnlock: () => void | Promise<void>;
  onGateCode: (value: string) => Promise<boolean>;
  unlockError?: string | null;
}

export function LockScreen({ onBiometricUnlock, onGateCode, unlockError }: LockScreenProps) {
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { available: biometricAvailable, busy: biometricBusy, unlock: unlockWithBiometric } =
    useBiometricUnlock(
      () => void onBiometricUnlock(),
      (message) => setLocalError(message)
    );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password.trim() || submitting) return;

    setLocalError(null);
    setSubmitting(true);
    try {
      const ok = await onGateCode(password);
      if (ok) {
        setPassword("");
      } else {
        setLocalError("קוד כניסה שגוי");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = unlockError ?? localError;

  return (
    <div className="lock-screen" role="dialog" aria-modal="true" aria-label="מסך כניסה">
      <div className="lock-card">
        <Image
          src={APP_LOGO_SRC}
          alt="SERVICE"
          width={88}
          height={88}
          className="lock-logo"
          priority
          unoptimized
        />

        <div className="lock-icon-wrap" aria-hidden>
          <Lock size={28} strokeWidth={2} />
        </div>

        <p className="lock-prompt">אנא הכנס סיסמא</p>

        <form className="lock-form" onSubmit={(e) => void handleSubmit(e)}>
          <input
            className="lock-input"
            type="password"
            inputMode="text"
            autoComplete="off"
            maxLength={32}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••••••••••••••"
            aria-label="סיסמא"
            autoFocus
            disabled={submitting}
          />
          <button type="submit" className="lock-biometric lock-submit" disabled={submitting}>
            {submitting ? "בודק..." : "כניסה"}
          </button>
        </form>

        {displayError ? <p className="lock-error">{displayError}</p> : null}

        {biometricAvailable ? (
          <button
            type="button"
            className="lock-biometric"
            onClick={() => {
              setLocalError(null);
              void unlockWithBiometric();
            }}
            disabled={biometricBusy || submitting}
          >
            <Fingerprint size={22} strokeWidth={2} />
            <span>
              {biometricBusy ? "מאמת..." : "כניסה ביומטרית (טביעת אצבע / Windows Hello)"}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
