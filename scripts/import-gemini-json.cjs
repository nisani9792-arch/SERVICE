/**
 * Import Gemini-classified JSON mail dumps into tickets and split a deduped copy
 * by category under data/gemini-inquiries/by-category.
 *
 * Usage:
 *   npm run import:gemini-json -- file1.json file2.json
 *   npm run import:gemini-json -- --no-db file1.json file2.json
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");
const { jsonrepair } = require("jsonrepair");

const CATEGORY_MAP = new Map([
  ["בקשות_והצעות_ייעול", "suggestions"],
  ["בקשות והצעות ייעול", "suggestions"],
  ["באגים_ובעיות_שימוש", "bugs"],
  ["באגים ובעיות שימוש", "bugs"],
  ["מנוי_פרימיום_והרשמה", "premium"],
  ["מנוי פרימיום והרשמה", "premium"],
  ["זכויות_יוצרים", "copyright"],
  ["זכויות יוצרים", "copyright"],
  ["בקשת_זמר_להצטרף", "artist"],
  ["בקשות_זמר_להצטרף", "artist"],
  ["בקשת זמר להצטרף", "artist"],
  ["בקשות זמר להצטרף", "artist"],
  ["ספאם", "spam"],
  ["spam", "spam"],
  ["Spam", "spam"]
]);

const CATEGORY_DIRS = {
  suggestions: "suggestions",
  bugs: "bugs",
  premium: "premium",
  copyright: "copyright",
  artist: "artist",
  spam: "spam"
};

function usage() {
  console.error("Usage: npm run import:gemini-json -- [--no-db] <file.json>...");
}

function extractJsonArray(text, file) {
  const start = text.indexOf("[");
  if (start === -1) {
    throw new Error(`${file}: JSON array start was not found`);
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "[") {
      depth += 1;
    } else if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        const jsonText = text.slice(start, i + 1);
        try {
          return JSON.parse(jsonText);
        } catch (error) {
          try {
            return JSON.parse(jsonrepair(jsonText));
          } catch {
            const match = /position (\d+)/.exec(error.message);
            const position = match ? Number(match[1]) : -1;
            const line = position >= 0 ? jsonText.slice(0, position).split(/\r?\n/).length : "unknown";
            throw new Error(`${file}: failed to parse JSON array near line ${line}: ${error.message}`);
          }
        }
      }
    }
  }

  throw new Error(`${file}: JSON array end was not found`);
}

function decodeMimeWord(charset, encoding, encoded) {
  try {
    if (encoding.toUpperCase() === "B") {
      return Buffer.from(encoded, "base64").toString(charset);
    }

    const binary = encoded
      .replace(/_/g, " ")
      .replace(/=([a-fA-F0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return Buffer.from(binary, "binary").toString(charset);
  } catch {
    return encoded;
  }
}

function decodeMimeWords(value) {
  const compact = String(value ?? "")
    .replace(/(=\?[^?]+\?[bqBQ]\?[^?]*\?=)\s+(?==\?)/g, "$1")
    .trim();

  return compact.replace(
    /=\?([^?]+)\?([bqBQ])\?([^?]*)\?=/g,
    (_, charset, encoding, encoded) => decodeMimeWord(charset, encoding, encoded)
  );
}

function normalizeSpaces(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeCategory(rawCategory) {
  const raw = normalizeSpaces(rawCategory).replace(/\s+/g, "_");
  return CATEGORY_MAP.get(raw) || CATEGORY_MAP.get(normalizeSpaces(rawCategory)) || raw || "Customer_Support";
}

function statusFor(category) {
  return category === "spam" ? "closed" : "open";
}

function priorityFor(category) {
  if (category === "spam") return 1;
  if (category === "bugs") return 4;
  return 3;
}

function dateToIso(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

function stableHash(parts) {
  return crypto
    .createHash("sha256")
    .update(parts.map((p) => normalizeSpaces(p).toLowerCase()).join("\n"))
    .digest("hex");
}

function normalizeRecord(raw, fileName) {
  const senderName = decodeMimeWords(raw.sender_name);
  const subject = decodeMimeWords(raw.subject) || "(ללא נושא)";
  const body = String(raw.original_text ?? raw.body ?? raw.summary ?? "").trim();
  const summary = String(raw.summary ?? "").trim() || subject;
  const senderEmail = String(raw.email ?? "").trim().toLowerCase();
  const category = normalizeCategory(raw.category);
  const messageAt = dateToIso(raw.date);

  if (!subject && !body) return null;

  const dedupeHash = stableHash([
    messageAt || raw.date || "",
    senderEmail || senderName,
    subject,
    body || summary
  ]);

  return {
    importKey: `gemini-json:${dedupeHash}`,
    senderEmail,
    senderName,
    subject,
    body: body || summary,
    category,
    originalCategory: String(raw.category ?? "").trim(),
    priority: priorityFor(category),
    summary,
    status: statusFor(category),
    messageAt,
    sourceFile: fileName
  };
}

function readAllRecords(files) {
  const unique = new Map();
  const stats = {
    files: files.length,
    raw: 0,
    invalid: 0,
    duplicates: 0
  };

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const parsed = extractJsonArray(text, file);
    const records = Array.isArray(parsed) ? parsed : [];
    stats.raw += records.length;

    for (const raw of records) {
      const normalized = normalizeRecord(raw, path.basename(file));
      if (!normalized) {
        stats.invalid += 1;
        continue;
      }

      if (unique.has(normalized.importKey)) {
        stats.duplicates += 1;
        continue;
      }

      unique.set(normalized.importKey, normalized);
    }
  }

  return { records: [...unique.values()], stats };
}

function writeCategorizedFiles(records) {
  const baseDir = path.join(process.cwd(), "data", "gemini-inquiries");
  const byCategoryDir = path.join(baseDir, "by-category");
  fs.mkdirSync(byCategoryDir, { recursive: true });

  const grouped = new Map();
  for (const record of records) {
    const key = CATEGORY_DIRS[record.category] || record.category.replace(/[^\w-]+/g, "_");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(record);
  }

  records.sort((a, b) => String(b.messageAt || "").localeCompare(String(a.messageAt || "")));
  fs.writeFileSync(path.join(baseDir, "all-deduped.json"), `${JSON.stringify(records, null, 2)}\n`);

  for (const [category, list] of grouped) {
    list.sort((a, b) => String(b.messageAt || "").localeCompare(String(a.messageAt || "")));
    const dir = path.join(byCategoryDir, category);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "tickets.json"), `${JSON.stringify(list, null, 2)}\n`);
  }

  return { baseDir, grouped };
}

async function ensureSchema(sql) {
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_import_key TEXT`;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_message_id TEXT`;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_mailbox_uid TEXT`;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_ingested_at TIMESTAMPTZ`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_email_import_key
    ON tickets (email_import_key)
    WHERE email_import_key IS NOT NULL
  `;
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
  const importKeys = [];

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
    importKeys.push(row.importKey);
  }

  const inserted = await sql`
    INSERT INTO tickets
      (
        sender_email,
        sender_name,
        subject,
        body,
        category,
        priority,
        ai_summary,
        status,
        source,
        message_at,
        email_import_key,
        email_ingested_at
      )
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
      ${messageAts}::timestamptz[],
      ${importKeys}::text[],
      ${senderEmails.map(() => new Date().toISOString())}::timestamptz[]
    )
    ON CONFLICT (email_import_key) WHERE email_import_key IS NOT NULL DO NOTHING
    RETURNING id
  `;

  return inserted.length;
}

async function importToDb(records) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = neon(databaseUrl);
  await ensureSchema(sql);

  const chunkSize = 300;
  let inserted = 0;
  for (let i = 0; i < records.length; i += chunkSize) {
    inserted += await insertChunk(sql, records.slice(i, i + chunkSize));
  }

  return inserted;
}

async function main() {
  const args = process.argv.slice(2);
  const noDb = args.includes("--no-db");
  const files = args.filter((arg) => arg !== "--no-db").map((arg) => path.resolve(arg));

  if (files.length === 0) {
    usage();
    process.exit(1);
  }

  const { records, stats } = readAllRecords(files);
  const { baseDir, grouped } = writeCategorizedFiles(records);
  const inserted = noDb ? null : await importToDb(records);

  console.log(`Files: ${stats.files}`);
  console.log(`Raw records: ${stats.raw}`);
  console.log(`Unique records: ${records.length}`);
  console.log(`Duplicates skipped: ${stats.duplicates}`);
  console.log(`Invalid skipped: ${stats.invalid}`);
  console.log(`Categorized JSON output: ${baseDir}`);
  for (const [category, list] of [...grouped.entries()].sort()) {
    console.log(`- ${category}: ${list.length}`);
  }
  if (inserted !== null) {
    console.log(`Inserted into DB: ${inserted}`);
    console.log(`Already existed in DB: ${records.length - inserted}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
