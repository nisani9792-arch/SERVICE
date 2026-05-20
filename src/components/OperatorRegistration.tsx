"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { UserRound } from "lucide-react";
import { JusicLogo } from "@/components/ui/JusicLogo";
import "./LockScreen.css";

interface OperatorRegistrationProps {
  busy: boolean;
  initialName?: string | null;
  onSubmit: (displayName: string) => Promise<boolean>;
}

export function OperatorRegistration({ busy, initialName, onSubmit }: OperatorRegistrationProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);

  useEffect(() => {
    if (initialName?.trim()) {
      setName(initialName.trim());
    }
  }, [initialName]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || submitLock.current) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setError("נא להזין שם משתמש");
      return;
    }

    submitLock.current = true;
    setError(null);
    try {
      const ok = await onSubmit(trimmed);
      if (!ok) setError("שמירת השם נכשלה. נסה שוב.");
    } finally {
      submitLock.current = false;
    }
  };

  return (
    <div className="lock-screen" role="dialog" aria-modal="true" aria-label="רישום גורם מטפל">
      <motion.div
        className="lock-card"
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        <div className="lock-logo-wrap">
          <JusicLogo size={72} variant="mark" />
        </div>

        <div className="lock-icon-wrap" aria-hidden>
          <UserRound size={28} strokeWidth={2} />
        </div>

        <p className="lock-prompt">הזן את שמך לעבודה במערכת</p>
        <p className="lock-subprompt">
          המערכת תזכור אותך במכשיר זה. במכשיר חדש — הזן את אותו שם לאחר כניסה עם הקוד.
        </p>

        <form className="lock-form" onSubmit={(e) => void handleSubmit(e)}>
          <input
            className="lock-input lock-input--name"
            type="text"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="שם מלא"
            aria-label="שם משתמש"
            disabled={busy}
          />
          {error ? <p className="lock-error">{error}</p> : null}
          <motion.button
            type="submit"
            className="lock-biometric lock-submit"
            disabled={busy}
            whileTap={{ scale: 0.98 }}
          >
            {busy ? "שומר..." : "המשך לעבודה"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
