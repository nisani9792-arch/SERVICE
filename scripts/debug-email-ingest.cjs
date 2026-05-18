/**
 * Local debug: inspect recent tickets and optionally run IMAP ingest.
 * Usage: node scripts/debug-email-ingest.cjs [--ingest]
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { neon } = require("@neondatabase/serverless");

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL missing");

  const sql = neon(dbUrl);
  const recent = await sql`
    SELECT id, subject, sender_email, email_import_key, category, status, created_at
    FROM tickets
    ORDER BY created_at DESC
    LIMIT 8
  `;
  console.log("Recent tickets:");
  console.log(JSON.stringify(recent, null, 2));

  const last48h = await sql`
    SELECT subject, sender_email, status, category, email_import_key, created_at
    FROM tickets
    WHERE created_at > now() - interval '3 days'
    ORDER BY created_at DESC
  `;
  console.log("\nLast 3 days:", last48h.length);
  console.log(JSON.stringify(last48h, null, 2));

  const runIngest = process.argv.includes("--ingest");
  if (!runIngest) {
    console.log("\nPass --ingest to run IMAP (needs EMAIL_IMAP_* in env).");
    return;
  }

  const base =
    process.env.EMAIL_INGEST_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "http://localhost:3000";
  const secret = process.env.EMAIL_INGEST_SECRET;
  const url = new URL("/api/email-ingest", base.replace(/\/$/, ""));
  const headers = { "Content-Type": "application/json" };
  if (secret) headers["x-email-ingest-secret"] = secret;

  const res = await fetch(url, { method: "POST", headers });
  const body = await res.text();
  console.log("\nIngest status:", res.status);
  console.log(body);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
