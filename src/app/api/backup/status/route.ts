import { NextRequest, NextResponse } from "next/server";
import { backupSecretConfigured, hasValidBackupSecret } from "@/lib/backup-auth";
import { listBackupSnapshots } from "@/lib/db-backup";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!hasValidBackupSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await listBackupSnapshots(30);
    return NextResponse.json({
      ok: true,
      folder: "backups",
      secretConfigured: Boolean(backupSecretConfigured()),
      dedicatedBackupDb: Boolean(process.env.DATABASE_BACKUP_URL?.trim()),
      retentionCount: Number(process.env.BACKUP_RETENTION_COUNT ?? 12),
      latest: items[0] ?? null,
      items
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to read backup status",
        details: error instanceof Error ? error.message : "Unknown"
      },
      { status: 500 }
    );
  }
}
