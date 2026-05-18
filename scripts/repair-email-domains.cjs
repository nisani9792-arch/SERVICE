/**
 * Repair common malformed email domains created by historical text extraction.
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { neon } = require("@neondatabase/serverless");

const mappings = [
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
  ["livecom", "live.com"],
  ["msncom", "msn.com"],
  ["protonmailcom", "protonmail.com"],
  ["ymailcom", "ymail.com"],
  ["yahoocom", "yahoo.com"],
  ["hotmailcom", "hotmail.com"],
  ["aolcom", "aol.com"],
  ["googlemailcom", "googlemail.com"],
  ["wallacom", "walla.com"],
  ["jusicco", "jusic.co"]
];

const EMAIL_VALID =
  /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i;

function repairEmailAddress(raw) {
  let email = String(raw).trim().toLowerCase();
  if (!email.includes("@")) return email;
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  let domain = email.slice(at + 1);
  for (const [bad, good] of mappings) {
    if (domain === bad || domain.endsWith(bad)) {
      domain = `${domain.slice(0, domain.length - bad.length)}${good}`;
    }
  }
  for (const [needle, good] of mappings) {
    if (domain.includes(needle)) {
      domain = good;
      break;
    }
  }
  if (domain === "gcom" || domain.endsWith("gcom")) domain = "gmail.com";
  if (domain === "googlemailcom") domain = "gmail.com";
  if (domain.endsWith("coil") && !domain.includes(".")) {
    domain = `${domain.slice(0, -4)}co.il`;
  }
  if (domain.endsWith("org") && !domain.includes(".")) {
    domain = `${domain.slice(0, -3)}.org`;
  }
  if (domain.endsWith("com") && !domain.includes(".") && domain.length > 4) {
    const guess = `${domain.slice(0, -3)}.com`;
    if (guess.includes(".")) domain = guess;
  }
  email = `${local}@${domain}`;
  return EMAIL_VALID.test(email) ? email : String(raw).trim().toLowerCase();
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

  const sql = neon(databaseUrl);
  const before = await sql`
    SELECT count(*)::int AS malformed
    FROM tickets
    WHERE sender_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  `;

  const updates = [];
  for (const [bad, good] of mappings) {
    const rows = await sql`
      UPDATE tickets
      SET
        sender_email = left(sender_email, length(sender_email) - ${bad.length}) || ${good},
        updated_at = now()
      WHERE lower(sender_email) LIKE ${`%${bad}`}
      RETURNING id
    `;
    if (rows.length > 0) updates.push({ bad, good, count: rows.length });
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
  if (manual > 0) updates.push({ bad: "(heuristic)", good: "valid", count: manual });

  const after = await sql`
    SELECT count(*)::int AS malformed
    FROM tickets
    WHERE sender_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  `;

  console.log(JSON.stringify({ before: before[0].malformed, updates, after: after[0].malformed }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
