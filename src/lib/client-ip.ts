import type { NextRequest } from "next/server";

function pickIp(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") return null;
  return trimmed;
}

/** Client IP for operator / gate persistence (Render, Cloudflare, Vercel, local). */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const fromForwarded = forwarded ? pickIp(forwarded.split(",")[0]) : null;

  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("true-client-ip"),
    request.headers.get("x-real-ip"),
    fromForwarded
  ];

  for (const candidate of candidates) {
    const ip = pickIp(candidate);
    if (ip) return ip;
  }

  return "unknown";
}
