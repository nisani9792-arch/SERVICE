import { NextRequest, NextResponse } from "next/server";
import { hasValidBackupSecret } from "@/lib/backup-auth";
import { runDatabaseBackup } from "@/lib/db-backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasValidBackupSecret(request)) {
    return NextResponse.json({ error: "Unauthorized backup request" }, { status: 401 });
  }

  try {
    const result = await runDatabaseBackup();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Database backup failed",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
