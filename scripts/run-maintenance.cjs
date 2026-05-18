/**
 * One-shot maintenance: repair malformed sender emails, then batch AI reclassify (scope=all).
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { neon } = require("@neondatabase/serverless");

const DOMAIN_SUFFIX_REPAIRS = [
  ["gmailcom", "gmail.com"],
  ["gamilcom", "gmail.com"],
  ["gmilcom", "gmail.com"],
  ["gimelcom", "gmail.com"],
  ["gimalcom", "gmail.com"],
  ["gimailcom", "gmail.com"],
  ["gmeilcom", "gmail.com"],
  ["gnailcom", "gmail.com"],
  ["gmialcom", "gmail.com"],
  ["gimlcom", "gmail.com"],
  ["gmailco", "gmail.com"],
  ["gmailcomcom", "gmail.com"],
  ["jmailcom", "gmail.com"],
  ["icloudcom", "icloud.com"],
  ["iclodcom", "icloud.com"],
  ["icoudcom", "icloud.com"],
  ["outlookcom", "outlook.com"],
  ["yahoocom", "yahoo.com"],
  ["hotmailcom", "hotmail.com"],
  ["aolcom", "aol.com"],
  ["googlemailcom", "googlemail.com"],
  ["wallacom", "walla.com"],
  ["jusicco", "jusic.co"],
  ["livecom", "live.com"],
  ["msncom", "msn.com"],
  ["protonmailcom", "protonmail.com"],
  ["ymailcom", "ymail.com"]
];

const EMAIL_VALID =
  /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i;

function repairEmailAddress(raw) {
  let email = String(raw).trim().toLowerCase();
  if (!email.includes("@")) return email;
  const at = email.lastIndexOf("@");
  let local = email.slice(0, at);
  let domain = email.slice(at + 1);
  for (const [bad, good] of DOMAIN_SUFFIX_REPAIRS) {
    if (domain === bad || domain.endsWith(bad)) {
      domain = `${domain.slice(0, domain.length - bad.length)}${good}`;
    }
  }
  if (domain === "googlemailcom") domain = "gmail.com";
  email = `${local}@${domain}`;
  return EMAIL_VALID.test(email) ? email : String(raw).trim().toLowerCase();
}

async function repairEmails(sql) {
  const beforeRows = await sql`
    SELECT count(*)::int AS malformed
    FROM tickets
    WHERE sender_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
  `;
  const before = beforeRows[0]?.malformed ?? 0;
  console.log(`Malformed emails before: ${before}`);

  for (const [bad, good] of DOMAIN_SUFFIX_REPAIRS) {
    const rows = await sql`
      UPDATE tickets
      SET sender_email = left(sender_email, length(sender_email) - ${bad.length}) || ${good},
          updated_at = now()
      WHERE lower(sender_email) LIKE ${`%${bad}`}
      RETURNING id
    `;
    if (rows.length) console.log(`  ${bad} -> ${good}: ${rows.length}`);
  }

  const fixedRows = await sql`
    SELECT id, sender_email FROM tickets
    WHERE sender_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
  `;
  let manual = 0;
  for (const row of fixedRows) {
    const repaired = repairEmailAddress(row.sender_email);
    if (repaired !== row.sender_email && EMAIL_VALID.test(repaired)) {
      await sql`UPDATE tickets SET sender_email = ${repaired}, updated_at = now() WHERE id = ${row.id}`;
      manual += 1;
    }
  }
  if (manual) console.log(`  heuristic fixes: ${manual}`);

  const afterRows = await sql`
    SELECT count(*)::int AS malformed
    FROM tickets
    WHERE sender_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
  `;
  console.log(`Malformed emails after: ${afterRows[0]?.malformed ?? 0}`);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const baseUrl = (process.env.CRM_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  const gateSecret = process.env.EMAIL_INGEST_SECRET || process.env.CRM_GATE_SECRET;

  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

  const sql = neon(databaseUrl);
  await repairEmails(sql);

  if (!gateSecret) {
    console.log("Skip reclassify: set EMAIL_INGEST_SECRET or CRM_GATE_SECRET and CRM_BASE_URL to call batch API.");
    return;
  }

  const headers = {
    "Content-Type": "application/json",
    "x-email-ingest-secret": gateSecret
  };

  const startRes = await fetch(`${baseUrl}/api/tickets/reclassify/batch`, {
    method: "POST",
    headers,
    body: JSON.stringify({ scope: "all", limit: 10000, chunkSize: 25 })
  });
  const start = await startRes.json();
  if (!startRes.ok) {
    throw new Error(start.details || start.error || "batch start failed");
  }

  let jobId = start.jobId;
  let processed = start.processed ?? 0;
  let total = start.total ?? 0;
  console.log(`Reclassify job ${jobId || "(empty)"}: ${processed}/${total}`);

  while (jobId && !start.done && processed < total) {
    const chunkRes = await fetch(`${baseUrl}/api/tickets/reclassify/batch`, {
      method: "POST",
      headers,
      body: JSON.stringify({ jobId, scope: "all", chunkSize: 25 })
    });
    const chunk = await chunkRes.json();
    if (!chunkRes.ok) throw new Error(chunk.details || chunk.error || "batch chunk failed");
    processed = chunk.processed ?? processed;
    total = chunk.total ?? total;
    console.log(`  progress ${processed}/${total} (${chunk.status})`);
    if (chunk.done) break;
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log("Maintenance complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
