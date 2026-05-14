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
  ["outlookcom", "outlook.com"],
  ["yahoocom", "yahoo.com"],
  ["hotmailcom", "hotmail.com"],
  ["aolcom", "aol.com"],
  ["googlemailcom", "googlemail.com"],
  ["wallacom", "walla.com"],
  ["jusicco", "jusic.co"]
];

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
