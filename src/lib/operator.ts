import { sql } from "@/lib/neon";

export type OperatorRecord = {
  ipAddress: string;
  displayName: string;
  gateUnlocked: boolean;
};

let tableReady = false;

export async function ensureOperatorTable(): Promise<void> {
  if (tableReady) return;
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS access_operators (
      ip_address    TEXT PRIMARY KEY,
      display_name  TEXT NOT NULL DEFAULT '',
      gate_unlocked BOOLEAN NOT NULL DEFAULT false,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  tableReady = true;
}

export async function getOperatorByIp(ipAddress: string): Promise<OperatorRecord | null> {
  await ensureOperatorTable();
  const rows = await sql()`
    SELECT ip_address, display_name, gate_unlocked
    FROM access_operators
    WHERE ip_address = ${ipAddress}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    ipAddress: String(row.ip_address),
    displayName: String(row.display_name ?? "").trim(),
    gateUnlocked: Boolean(row.gate_unlocked)
  };
}

export async function touchOperator(ipAddress: string): Promise<void> {
  await ensureOperatorTable();
  await sql()`
    UPDATE access_operators
    SET last_seen_at = now()
    WHERE ip_address = ${ipAddress}
  `;
}

export async function unlockGateForIp(ipAddress: string): Promise<void> {
  await ensureOperatorTable();
  await sql()`
    INSERT INTO access_operators (ip_address, gate_unlocked, last_seen_at)
    VALUES (${ipAddress}, true, now())
    ON CONFLICT (ip_address) DO UPDATE SET
      gate_unlocked = true,
      last_seen_at = now()
  `;
}

export async function registerOperatorName(ipAddress: string, displayName: string): Promise<void> {
  const name = displayName.trim();
  if (!name) throw new Error("display name required");

  const existing = await getOperatorByIp(ipAddress);
  if (!existing?.gateUnlocked) {
    throw new Error("gate not unlocked");
  }

  await ensureOperatorTable();
  await sql()`
    UPDATE access_operators
    SET display_name = ${name}, last_seen_at = now()
    WHERE ip_address = ${ipAddress}
  `;
}

export async function resolveOperatorName(ipAddress: string): Promise<string | null> {
  const op = await getOperatorByIp(ipAddress);
  if (!op?.gateUnlocked) return null;
  const name = op.displayName.trim();
  return name || null;
}
