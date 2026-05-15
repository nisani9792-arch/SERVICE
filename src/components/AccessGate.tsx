"use client";

import { LockScreen } from "@/components/LockScreen";
import { useUnlockGate } from "@/hooks/useUnlockGate";

interface AccessGateProps {
  children: React.ReactNode;
}

export function AccessGate({ children }: AccessGateProps) {
  const { unlocked, unlock } = useUnlockGate();

  if (!unlocked) {
    return <LockScreen onUnlock={unlock} />;
  }

  return <>{children}</>;
}
