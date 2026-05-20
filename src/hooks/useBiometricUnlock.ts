"use client";

import { useCallback, useEffect, useState } from "react";
import { APP_NAME } from "@/lib/brand";

const CREDENTIAL_KEY = "service-crm-biometric-id";

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function canUseWebAuthn(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "PublicKeyCredential" in window &&
    typeof navigator.credentials?.get === "function"
  );
}

function biometricErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "האימות בוטל או נדחה. נסה שוב או הזן קוד כניסה.";
    }
    if (error.name === "SecurityError") {
      return "אימות ביומטרי לא זמין בכתובת זו. השתמש בקוד כניסה.";
    }
    if (error.name === "InvalidStateError") {
      return "רישום ביומטרי קיים במכשיר אחר. מחק נתוני אתר ונסה שוב, או השתמש בקוד כניסה.";
    }
  }
  return "אימות ביומטרי נכשל. נסה שוב או הזן קוד כניסה.";
}

export function useBiometricUnlock(onSuccess: () => void, onError?: (message: string) => void) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canUseWebAuthn()) return;

    const detect = async () => {
      try {
        const platform =
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
        setAvailable(Boolean(platform));
      } catch {
        setAvailable(false);
      }
    };

    void detect();
  }, []);

  const registerCredential = useCallback(async (): Promise<boolean> => {
    if (!canUseWebAuthn()) return false;

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: APP_NAME, id: window.location.hostname },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: "jusic-service",
          displayName: APP_NAME
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        timeout: 60_000
      }
    })) as PublicKeyCredential | null;

    if (!credential) return false;

    localStorage.setItem(CREDENTIAL_KEY, bufferToBase64(credential.rawId));
    return true;
  }, []);

  const unlock = useCallback(async () => {
    if (!canUseWebAuthn() || busy) return;

    setBusy(true);
    try {
      const storedId = localStorage.getItem(CREDENTIAL_KEY);

      if (!storedId) {
        const registered = await registerCredential();
        if (registered) {
          onSuccess();
        } else {
          onError?.("לא ניתן לרשום אימות ביומטרי במכשיר זה.");
        }
        return;
      }

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rpId: window.location.hostname,
          allowCredentials: [
            {
              id: base64ToBuffer(storedId),
              type: "public-key"
            }
          ],
          userVerification: "required",
          timeout: 60_000
        }
      });

      if (assertion) {
        onSuccess();
      } else {
        onError?.("אימות ביומטרי נכשל. נסה שוב.");
      }
    } catch (error) {
      onError?.(biometricErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [busy, onError, onSuccess, registerCredential]);

  return { available, busy, unlock };
}
