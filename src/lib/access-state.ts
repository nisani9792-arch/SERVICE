import type { NextRequest } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { getOperatorByIp, touchOperator } from "@/lib/operator";
import {
  getSession,
  getSessionTokenFromRequest,
  touchSession
} from "@/lib/operator-session";

export type AccessState = {
  unlocked: boolean;
  displayName: string | null;
  sessionToken: string | null;
  source: "session" | "ip" | "none";
};

export async function resolveAccessState(request: NextRequest): Promise<AccessState> {
  const sessionToken = getSessionTokenFromRequest(request);
  if (sessionToken) {
    const session = await getSession(sessionToken);
    if (session?.gateUnlocked) {
      await touchSession(sessionToken);
      const name = session.displayName.trim() || null;
      return {
        unlocked: true,
        displayName: name,
        sessionToken,
        source: "session"
      };
    }
  }

  const ip = getClientIp(request);
  const op = await getOperatorByIp(ip);
  if (op?.gateUnlocked) {
    await touchOperator(ip);
    const name = op.displayName.trim() || null;
    return {
      unlocked: true,
      displayName: name,
      sessionToken,
      source: "ip"
    };
  }

  return {
    unlocked: false,
    displayName: null,
    sessionToken,
    source: "none"
  };
}

export async function isAccessUnlocked(request: NextRequest): Promise<boolean> {
  const state = await resolveAccessState(request);
  return state.unlocked;
}

export async function getRegisteredDisplayName(request: NextRequest): Promise<string | null> {
  const state = await resolveAccessState(request);
  if (!state.unlocked) return null;
  return state.displayName;
}
