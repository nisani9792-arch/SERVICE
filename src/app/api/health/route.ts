import { NextResponse } from "next/server";
import { sql } from "@/lib/neon";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  try {
    const rows = await sql()`SELECT version()`;
    checks.neon = { ok: true, detail: rows[0]?.version ?? "connected" };
  } catch (error) {
    checks.neon = {
      ok: false,
      detail: error instanceof Error ? error.message : "connection failed"
    };
  }

  const geminiKey =
    process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
  checks.gemini = {
    ok: Boolean(geminiKey),
    detail: geminiKey ? "API key configured" : "GOOGLE_GEMINI_API_KEY is missing"
  };

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    { status: allOk ? "healthy" : "degraded", checks },
    { status: allOk ? 200 : 503 }
  );
}
