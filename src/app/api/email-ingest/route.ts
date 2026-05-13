import { NextRequest, NextResponse } from "next/server";
import { ingestGmailInbox } from "@/lib/email-ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function hasValidSecret(request: NextRequest): boolean {
  const configured = process.env.EMAIL_INGEST_SECRET?.trim();
  const provided =
    request.headers.get("x-email-ingest-secret")?.trim() ||
    request.nextUrl.searchParams.get("secret")?.trim();

  if (!configured) {
    return process.env.NODE_ENV !== "production";
  }

  return provided === configured;
}

async function runEmailIngest(request: NextRequest, allowSameOriginPost: boolean) {
  const authorized =
    hasValidSecret(request) ||
    (allowSameOriginPost && request.method === "POST" && isSameOriginRequest(request));

  if (!authorized) {
    return NextResponse.json(
      { error: "Unauthorized email ingest request" },
      { status: 401 }
    );
  }

  try {
    const result = await ingestGmailInbox();
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
  return runEmailIngest(request, false);
}

export async function POST(request: NextRequest) {
  return runEmailIngest(request, true);
}
