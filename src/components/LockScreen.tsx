"use client";

import { Fingerprint, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useBiometricUnlock } from "@/hooks/useBiometricUnlock";
import { JusicLogo } from "@/components/ui/JusicLogo";
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

  const displayError = unlockError ?? localError;

  useEffect(() => {
    if (!unlockError) return;
    unlockStarted.current = false;
    setSubmitting(false);
  }, [unlockError]);

  return (
    <div className="lock-screen" role="dialog" aria-modal="true" aria-label="מסך כניסה">
      <motion.div
        className="lock-card"
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        <div className="lock-logo-wrap">
          <JusicLogo size={88} variant="mark" animated={false} />
        </div>

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
            onChange={(event) => {
              setPassword(event.target.value);
              if (localError) setLocalError(null);
            }}
            placeholder="קוד כניסה"
            aria-label="קוד כניסה"
            disabled={submitting}
          />
          <motion.button
            type="submit"
            className="lock-submit-btn"
            disabled={submitting}
            whileTap={{ scale: 0.98 }}
          >
            {submitting ? "נכנס..." : "כניסה"}
          </motion.button>
        </form>

        {displayError ? <p className="lock-error">{displayError}</p> : null}

        {biometricAvailable ? (
          <motion.button
            type="button"
            className="lock-biometric"
            onClick={() => {
              setLocalError(null);
              void unlockWithBiometric();
            }}
            disabled={biometricBusy || submitting}
            whileTap={{ scale: 0.98 }}
          >
            <Fingerprint size={22} strokeWidth={2} />
            <span className="lock-biometric-label">
              {biometricBusy || submitting ? "מאמת..." : "כניסה ביומטרית"}
            </span>
          </motion.button>
        ) : null}
      </motion.div>
    </div>
  );
}
