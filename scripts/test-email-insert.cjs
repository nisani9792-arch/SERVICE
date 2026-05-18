/**
 * Diagnose which INSERT shape fails on Neon.
 */
require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

async function test(name, fn) {
  try {
    await fn();
    console.log("OK:", name);
  } catch (e) {
    console.error("FAIL:", name, "->", e.message);
  }
}

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  const key = `diag:${Date.now()}`;

  await test("insert with ON CONFLICT partial + tags array", async () => {
    await sql`
      INSERT INTO tickets (
        ticket_number, sender_email, sender_name, subject, body, body_cleaned,
        category, priority, ai_summary, status, source, message_at, tags,
        email_import_key, email_message_id, email_mailbox_uid, email_ingested_at
      )
      VALUES (
        99998, 'a@b.com', 'A', 'subj', 'body', 'body', 'pending_triage', 3, 'sum', 'open', 'email',
        now(), ${["EDITOR"]}, ${key + "-a"}, null, 'gmail:1', now()
      )
      ON CONFLICT (email_import_key) WHERE (email_import_key IS NOT NULL) DO NOTHING
      RETURNING id
    `;
  });

  await test("insert without ON CONFLICT", async () => {
    await sql`
      INSERT INTO tickets (
        ticket_number, sender_email, sender_name, subject, body, body_cleaned,
        category, priority, ai_summary, status, source, message_at,
        email_import_key, email_message_id, email_mailbox_uid, email_ingested_at
      )
      VALUES (
        99997, 'b@b.com', 'B', 'subj', 'body', 'body', 'pending_triage', 3, 'sum', 'open', 'email',
        now(), ${key + "-b"}, null, 'gmail:2', now()
      )
      RETURNING id
    `;
  });

  await test("tags update only", async () => {
    const rows = await sql`SELECT id FROM tickets WHERE email_import_key = ${key + "-b"} LIMIT 1`;
    if (rows[0]) {
      await sql`UPDATE tickets SET tags = ${["EDITOR"]} WHERE id = ${rows[0].id}`;
    }
  });

  await test("ANY array for outbound", async () => {
    await sql`
      SELECT message_id FROM outbound_email_message_ids
      WHERE message_id = ANY(${["fake-id"]})
      LIMIT 1
    `;
  });

  await test("CREATE TABLE with DEFAULT param", async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS ticket_number_seq_test (
        id TEXT PRIMARY KEY,
        last_number INTEGER NOT NULL DEFAULT ${10000}
      )
    `;
  });
}

main();
