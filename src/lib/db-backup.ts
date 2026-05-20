import { createHash } from "crypto";
import { gzipSync } from "zlib";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { sql } from "@/lib/neon";

const BACKUP_FOLDER = "backups";
const BACKUP_TABLES = [
  "tickets",
  "reply_templates",
  "saved_inquiries",
  "ticket_attachments"
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];

export type BackupRunResult = {
  ok: true;
  backupKey: string;
  folder: string;
  createdAt: string;
  storage: "primary" | "dedicated";
  tableCounts: Record<string, number>;
  byteSize: number;
  checksum: string;
  pruned: number;
};

export type BackupSnapshotMeta = {
  id: string;
  backupKey: string;
  folder: string;
  createdAt: string;
  tableCounts: Record<string, number>;
  byteSize: number;
  checksum: string;
};

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function includeAttachments(): boolean {
  const raw = (process.env.BACKUP_INCLUDE_ATTACHMENTS ?? "true").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "no";
}

function backupRetentionCount(): number {
  return positiveInt(process.env.BACKUP_RETENTION_COUNT, 12);
}

function backupSql(): NeonQueryFunction<false, false> {
  const dedicated = process.env.DATABASE_BACKUP_URL?.trim();
  if (dedicated) return neon(dedicated);
  return sql();
}

function backupStorageLabel(): "primary" | "dedicated" {
  return process.env.DATABASE_BACKUP_URL?.trim() ? "dedicated" : "primary";
}

export async function ensureBackupSchema(db: NeonQueryFunction<false, false>): Promise<void> {
  await db`
    CREATE TABLE IF NOT EXISTS backup_snapshots (
      id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      backup_key          TEXT NOT NULL UNIQUE,
      folder              TEXT NOT NULL DEFAULT 'backups',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      table_counts        JSONB NOT NULL DEFAULT '{}'::jsonb,
      payload_gzip_base64 TEXT NOT NULL,
      byte_size           INTEGER NOT NULL DEFAULT 0,
      checksum            TEXT NOT NULL DEFAULT ''
    )
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_backup_snapshots_created_at
    ON backup_snapshots (created_at DESC)
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_backup_snapshots_folder
    ON backup_snapshots (folder)
  `;
}

async function exportTable(table: BackupTableName): Promise<unknown[]> {
  switch (table) {
    case "tickets":
      return (await sql()`SELECT * FROM tickets ORDER BY created_at ASC`) as unknown[];
    case "reply_templates":
      return (await sql()`SELECT * FROM reply_templates ORDER BY created_at ASC`) as unknown[];
    case "saved_inquiries":
      return (await sql()`SELECT * FROM saved_inquiries ORDER BY created_at ASC`) as unknown[];
    case "ticket_attachments": {
      if (!includeAttachments()) {
        return (await sql()`
          SELECT id, ticket_id, filename, content_type, size_bytes, created_at
          FROM ticket_attachments
          ORDER BY created_at ASC
        `) as unknown[];
      }
      return (await sql()`SELECT * FROM ticket_attachments ORDER BY created_at ASC`) as unknown[];
    }
    default:
      return [];
  }
}

function buildBackupKey(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${BACKUP_FOLDER}/${stamp}.json.gz`;
}

export async function listBackupSnapshots(limit = 20): Promise<BackupSnapshotMeta[]> {
  const db = backupSql();
  await ensureBackupSchema(db);

  const rows = await db`
    SELECT id, backup_key, folder, created_at, table_counts, byte_size, checksum
    FROM backup_snapshots
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      backupKey: String(r.backup_key),
      folder: String(r.folder ?? BACKUP_FOLDER),
      createdAt: String(r.created_at),
      tableCounts: (r.table_counts as Record<string, number>) ?? {},
      byteSize: Number(r.byte_size ?? 0),
      checksum: String(r.checksum ?? "")
    };
  });
}

async function pruneOldBackups(db: NeonQueryFunction<false, false>): Promise<number> {
  const retention = backupRetentionCount();
  const rows = await db`
    SELECT id
    FROM backup_snapshots
    ORDER BY created_at DESC
    OFFSET ${retention}
  `;
  if (rows.length === 0) return 0;

  const ids = rows.map((row) => String((row as { id: string }).id));
  await db`DELETE FROM backup_snapshots WHERE id = ANY(${ids}::text[])`;
  return ids.length;
}

export async function runDatabaseBackup(): Promise<BackupRunResult> {
  const db = backupSql();
  await ensureBackupSchema(db);

  const exportedAt = new Date().toISOString();
  const tables: Record<string, unknown[]> = {};
  const tableCounts: Record<string, number> = {};

  for (const table of BACKUP_TABLES) {
    const rows = await exportTable(table);
    tables[table] = rows;
    tableCounts[table] = rows.length;
  }

  const payload = {
    version: 1,
    exportedAt,
    app: "JUSIC SERVICE",
    tables
  };

  const compressed = gzipSync(Buffer.from(JSON.stringify(payload), "utf8"));
  const payloadBase64 = compressed.toString("base64");
  const checksum = createHash("sha256").update(compressed).digest("hex");
  const backupKey = buildBackupKey();

  await db`
    INSERT INTO backup_snapshots (
      backup_key,
      folder,
      table_counts,
      payload_gzip_base64,
      byte_size,
      checksum
    )
    VALUES (
      ${backupKey},
      ${BACKUP_FOLDER},
      ${JSON.stringify(tableCounts)}::jsonb,
      ${payloadBase64},
      ${compressed.length},
      ${checksum}
    )
  `;

  const pruned = await pruneOldBackups(db);

  return {
    ok: true,
    backupKey,
    folder: BACKUP_FOLDER,
    createdAt: exportedAt,
    storage: backupStorageLabel(),
    tableCounts,
    byteSize: compressed.length,
    checksum,
    pruned
  };
}
