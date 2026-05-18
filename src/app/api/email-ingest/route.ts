import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { ingestGmailInbox } from "@/lib/email-ingest";
import { invalidateStatsCache } from "@/lib/stats-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function isSameOriginPost(request: NextRequest): boolean {
  if (request.method !== "POST") return false;

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "same-origin" || fetchSite === "same-site") {
    return true;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";

  const expectedOrigins = new Set<string>([request.nextUrl.origin]);
  if (host) {
    expectedOrigins.add(`${forwardedProto}://${host}`);
    expectedOrigins.add(`https://${host}`);
    expectedOrigins.add(`http://${host}`);
  }

  for (const envUrl of [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.EMAIL_INGEST_URL
  ]) {
    if (!envUrl) continue;
    try {
      expectedOrigins.add(new URL(envUrl).origin);
    } catch {
      // Ignore malformed optional URLs.
    }
  }

  try {
    if (origin && expectedOrigins.has(new URL(origin).origin)) return true;
    if (referer && expectedOrigins.has(new URL(referer).origin)) return true;
  } catch {
    return false;
  }

  return false;
}

function hasValidSecret(request: NextRequest): boolean {
  const configured = process.env.EMAIL_INGEST_SECRET?.trim();
  const authorization = request.headers.get("authorization")?.trim();
  const bearer = authorization?.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : "";
  const provided =
    bearer ||
    request.headers.get("x-email-ingest-secret")?.trim() ||
    request.nextUrl.searchParams.get("secret")?.trim();

  if (!configured) {
    return process.env.NODE_ENV !== "production";
  }

  if (!provided) return false;

  const configuredBytes = Buffer.from(configured);
  const providedBytes = Buffer.from(provided);
  return (
    configuredBytes.length === providedBytes.length &&
    timingSafeEqual(configuredBytes, providedBytes)
  );
}

async function runEmailIngest(request: NextRequest) {
  if (!hasValidSecret(request) && !isSameOriginPost(request)) {
    return NextResponse.json(
      { error: "Unauthorized email ingest request" },
      { status: 401 }
    );
  }

  try {
    const result = await ingestGmailInbox();
    if (result.imported > 0 || result.reopened > 0) {
      invalidateStatsCache();
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Email ingest failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return runEmailIngest(request);
}

export async function POST(request: NextRequest) {
  return runEmailIngest(request);
}
