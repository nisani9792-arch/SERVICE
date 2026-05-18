/**
 * Verify Neon insert for email tickets (run: node scripts/test-email-insert.cjs)
 */
require("dotenv").config();

const { neon } = require("@neondatabase/serverless");

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  const key = `test:email-insert:${Date.now()}`;

  const inserted = await sql`
    INSERT INTO tickets (
      ticket_number,
      sender_email,
      sender_name,
      subject,
      body,
      body_cleaned,
      category,
      priority,
      ai_summary,
      status,
      source,
      message_at,
      tags,
      email_import_key
    )
    VALUES (
      99999,
      'test@example.com',
      'Test',
      'Neon insert test',
      'body',
      'body',
      'pending_triage',
      3,
      'test',
      'open',
      'email',
      now(),
      ${["EDITOR"]},
      ${key}
    )
    ON CONFLICT (email_import_key) WHERE (email_import_key IS NOT NULL) DO NOTHING
    RETURNING id
  `;

  console.log("insert ok:", inserted);

  const found = await sql`
    SELECT id FROM tickets WHERE email_import_key = ${key} LIMIT 1
  `;
  console.log("found:", found);

  const ids = ["nonexistent-id-123"];
  const outbound = await sql`
    SELECT message_id
    FROM outbound_email_message_ids
    WHERE message_id = ANY(${ids})
    LIMIT 1
  `;
  console.log("any query ok:", outbound);
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
