/**
 * Bulk import historical tickets from a JSON file using DATABASE_URL.
 * Usage: node scripts/import-historical.cjs path/to/file.json
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

function isSpamLikeCategory(category) {
  const c = String(category).trim().toLowerCase().replace(/\s+/g, "_");
  if (c === "spam") return true;
  if (c.includes("pr/media") || c.includes("pr_media")) return true;
  if (c.includes("media_request")) return true;
  return false;
}

function statusFor(category) {
  return isSpamLikeCategory(category) ? "closed" : "open";
}

function prepareRow(raw) {
  const senderEmail = String(raw.email ?? "").trim();
  const subject = String(raw.subject ?? "").trim();
  const summary = String(raw.summary ?? "").trim();
  const body = summary || "(ללא תוכן)";
  if (!senderEmail || !subject) return null;
  const senderName = String(raw.sender_name ?? "").trim();
  const category = String(raw.category ?? "Customer_Support").trim() || "Customer_Support";
  let messageAt = null;
  if (raw.date) {
    const ms = Date.parse(raw.date);
    if (Number.isNaN(ms)) return null;
    messageAt = new Date(ms).toISOString();
  }
  return {
    senderEmail,
    senderName,
    subject,
    body,
    category,
    priority: 3,
    summary: summary || subject,
    status: statusFor(category),
    messageAt
  };
}

async function insertChunk(sql, rows) {
  if (rows.length === 0) return 0;
  const senderEmails = [];
  const senderNames = [];
  const subjects = [];
  const bodies = [];
  const categories = [];
  const priorities = [];
  const summaries = [];
  const statuses = [];
  const messageAts = [];
  for (const row of rows) {
    senderEmails.push(row.senderEmail);
    senderNames.push(row.senderName);
    subjects.push(row.subject);
    bodies.push(row.body);
    categories.push(row.category);
    priorities.push(row.priority);
    summaries.push(row.summary);
    statuses.push(row.status);
    messageAts.push(row.messageAt);
  }
  await sql`
    INSERT INTO tickets
      (sender_email, sender_name, subject, body, category, priority, ai_summary, status, source, message_at)
    SELECT * FROM UNNEST (
      ${senderEmails}::text[],
      ${senderNames}::text[],
      ${subjects}::text[],
      ${bodies}::text[],
      ${categories}::text[],
      ${priorities}::int[],
      ${summaries}::text[],
      ${statuses}::text[],
      ${senderEmails.map(() => "import")}::text[],
      ${messageAts}::timestamptz[]
    )
  `;
  return rows.length;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/import-historical.cjs <file.json>");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const sql = neon(url);
  const text = fs.readFileSync(path.resolve(file), "utf8");
  const parsed = JSON.parse(text);
  const list = Array.isArray(parsed) ? parsed : parsed.records;
  if (!Array.isArray(list)) {
    console.error("JSON must be an array or { records: [] }");
    process.exit(1);
  }
  const prepared = [];
  for (const raw of list) {
    const row = prepareRow(raw);
    if (row) prepared.push(row);
  }
  const chunkSize = 400;
  let total = 0;
  for (let i = 0; i < prepared.length; i += chunkSize) {
    const chunk = prepared.slice(i, i + chunkSize);
    const n = await insertChunk(sql, chunk);
    total += n;
    console.log(`Inserted ${total}/${prepared.length}`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
