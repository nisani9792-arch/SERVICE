/**
 * Render Cron entrypoint — automatic DB snapshot into backup_snapshots.
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

async function main() {
  const baseUrl =
    process.env.BACKUP_URL ||
    process.env.EMAIL_INGEST_URL ||
    process.env.RENDER_EXTERNAL_URL;
  const secret = process.env.BACKUP_SECRET || process.env.EMAIL_INGEST_SECRET;

  if (!baseUrl) {
    throw new Error("BACKUP_URL or EMAIL_INGEST_URL or RENDER_EXTERNAL_URL is not configured");
  }
  if (!secret) {
    throw new Error("BACKUP_SECRET or EMAIL_INGEST_SECRET is not configured");
  }

  const url = new URL("/api/backup/run", baseUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-backup-secret": secret
    }
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Database backup failed with ${response.status}: ${text}`);
  }

  console.log(text);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
