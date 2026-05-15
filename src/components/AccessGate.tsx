"use client";

import { createContext, useContext } from "react";
import { LockScreen } from "@/components/LockScreen";
import { OperatorRegistration } from "@/components/OperatorRegistration";
import { useAccessGate } from "@/hooks/useAccessGate";

const OperatorContext = createContext<string | null>(null);

export function useOperatorName(): string | null {
  return useContext(OperatorContext);
}

interface AccessGateProps {
  children: React.ReactNode;
}

export function AccessGate({ children }: AccessGateProps) {
  const { phase, displayName, registerBusy, unlockError, unlockGate, registerName, checkGateCode } =
    useAccessGate();

  if (phase === "loading") {
    return (
      <div className="lock-screen" aria-busy="true" aria-label="טוען">
        <div className="lock-card">
          <p className="lock-prompt">טוען...</p>
        </div>
      </div>
    );
  }

  if (phase === "locked") {
    return (
      <LockScreen
        onBiometricUnlock={() => {
          void unlockGate("biometric");
        }}
        onGateCode={checkGateCode}
        unlockError={unlockError}
      />
    );
  }

  if (phase === "register") {
    return (
      <OperatorRegistration
        busy={registerBusy}
        onSubmit={registerName}
      />
    );
  }

  return <OperatorContext.Provider value={displayName}>{children}</OperatorContext.Provider>;
}
