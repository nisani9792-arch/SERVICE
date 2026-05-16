"use client";

import { Fingerprint, Lock } from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
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
  const unlockStarted = useRef(false);

  const { available: biometricAvailable, busy: biometricBusy, unlock: unlockWithBiometric } =
    useBiometricUnlock(
      () => void onBiometricUnlock(),
      (message) => setLocalError(message)
    );

  const attemptUnlock = async (value: string) => {
    if (unlockStarted.current || submitting || !value.trim()) return;

    unlockStarted.current = true;
    setLocalError(null);
    setSubmitting(true);
    try {
      const ok = await onGateCode(value);
      if (ok) {
        setPassword("");
      } else {
        setLocalError("קוד כניסה שגוי");
      }
    } finally {
      unlockStarted.current = false;
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void attemptUnlock(password);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (value.trim().length >= 5) {
      void attemptUnlock(value);
    }
  };

  const displayError = unlockError ?? localError;

  useEffect(() => {
    if (!unlockError) return;
    unlockStarted.current = false;
    setSubmitting(false);
  }, [unlockError]);

  return (
    <div className="lock-screen" role="dialog" aria-modal="true" aria-label="מסך כניסה">
      <div className="lock-card">
        <Image
          src={APP_LOGO_SRC}
          alt="SERVICE"
          width={80}
          height={80}
          className="lock-logo"
          priority
          unoptimized
        />

        <div className="lock-icon-wrap" aria-hidden>
          <Lock size={28} strokeWidth={2} />
        </div>

        <p className="lock-prompt">הזינו קוד כניסה</p>

        <form className="lock-form" onSubmit={handleSubmit}>
          <input
            className="lock-input"
            type="password"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={24}
            value={password}
            onChange={(event) => handlePasswordChange(event.target.value)}
            placeholder="קוד כניסה"
            aria-label="קוד כניסה"
            disabled={submitting}
          />
          <button type="submit" className="lock-submit-btn" disabled={submitting}>
            {submitting ? "נכנס..." : "כניסה"}
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
            <span className="lock-biometric-label">
              {biometricBusy || submitting ? "מאמת..." : "כניסה ביומטרית"}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
