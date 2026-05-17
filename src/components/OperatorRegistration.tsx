"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { UserRound } from "lucide-react";
import { APP_LOGO_SRC } from "@/lib/brand";
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
          <button type="submit" className="lock-biometric lock-submit" disabled={busy}>
            {busy ? "שומר..." : "המשך לעבודה"}
          </button>
        </form>
      </div>
    </div>
  );
}
