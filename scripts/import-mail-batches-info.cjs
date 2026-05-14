/**
 * Import INFO mailbox batch files into the tickets table.
 *
 * The export format is:
 * --- EMAIL N ---
 * DATE:
 * SENDER_NAME:
 * SENDER_EMAIL:
 * SUBJECT:
 * BODY:
 *
 * Existing tickets are tagged EDITOR before import. New mailbox tickets are
 * tagged INFO and deduped both within the files and against the DB.
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

const INSERT_CHUNK = 300;
const INFO_TAG = "INFO";
const EDITOR_TAG = "EDITOR";

const DEFAULT_FILES = Array.from({ length: 10 }, (_, i) =>
  path.join(
    process.env.USERPROFILE || process.env.HOME || "",
    "Desktop",
    "MAIL",
    "Emails_Batches",
    `batch_${i + 1}.txt`
  )
);

const SYSTEM_SENDER_PATTERNS = [
  /(^|\.)instagram\.com$/i,
  /(^|\.)facebookmail\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)google\.com$/i,
  /(^|\.)googlemail\.com$/i,
  /(^|\.)accounts\.google\.com$/i,
  /(^|\.)workspace\.google\.com$/i
];

const SYSTEM_SUBJECT_PATTERNS = [
  /google workspace/i,
  /admin alert/i,
  /monthly security/i,
  /data protection insights/i,
  /jusic_2025/i,
  /instagram/i,
  /חשבון google/i
];

function decodeMimeWords(str) {
  if (!str) return "";
  let out = str;
  let prev;
  const re = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;
  do {
    prev = out;
    out = out.replace(re, (_m, _charset, enc, text) => {
      try {
        if (enc.toLowerCase() === "b") {
          return Buffer.from(text.replace(/\s+/g, ""), "base64").toString("utf8");
        }

        const binary = text
          .replace(/_/g, " ")
          .replace(/=([0-9A-F]{2})/gi, (_h, hx) => String.fromCharCode(parseInt(hx, 16)));
        return Buffer.from(binary, "binary").toString("utf8");
      } catch {
        return text;
      }
    });
  } while (out !== prev);
  return out.replace(/\s+/g, " ").trim();
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#064;|&commat;/gi, "@")
    .replace(/&quot;/gi, "\"")
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u200e|\u200f|\u202a|\u202b|\u202c/g, "");
}

function normalizeSpaces(value) {
  return decodeEntities(value).replace(/\s+/g, " ").trim();
}

function compactBody(value) {
  return decodeEntities(value)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanEmail(value) {
  return String(value ?? "")
    .trim()
    .replace(/[<>"'׳״\u200e\u200f]/g, "")
    .toLowerCase();
}

function parseFrom(fromRaw) {
  const raw = fromRaw.trim();
  const m = raw.match(/<([^>]+)>/);
  const email = cleanEmail(m ? m[1] : raw.match(/[\w.+%-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] || "");
  const name = decodeMimeWords(raw.replace(/<[^>]+>/, "").trim());
  return { email, name: name || email };
}

function parseOneMessage(block) {
  const lines = block.split(/\r?\n/);
  let dateLine = "";
  let senderName = "";
  let senderEmail = "";
  let fromRaw = "";
  let subjectRaw = "";
  let body = "";
  let mode = "none";

  for (const line of lines) {
    if (line.startsWith("DATE:")) {
      mode = "date";
      dateLine = line.slice(5).trim();
    } else if (line.startsWith("SENDER_NAME:")) {
      mode = "senderName";
      senderName = line.slice("SENDER_NAME:".length).trim();
    } else if (line.startsWith("SENDER_EMAIL:")) {
      mode = "senderEmail";
      senderEmail = line.slice("SENDER_EMAIL:".length).trim();
    } else if (line.startsWith("FROM:")) {
      mode = "from";
      fromRaw = line.slice(5).trim();
    } else if (line.startsWith("SUBJECT:")) {
      mode = "subject";
      subjectRaw = line.slice(8).trim();
    } else if (line.startsWith("BODY:")) {
      mode = "body";
      body = line.slice(5);
    } else if (mode === "subject" && /^\s/.test(line)) {
      subjectRaw += " " + line.trim();
    } else if (mode === "senderName" && /^\s/.test(line)) {
      senderName += " " + line.trim();
    } else if (mode === "senderEmail" && /^\s/.test(line)) {
      senderEmail += " " + line.trim();
    } else if (mode === "from" && /^\s/.test(line)) {
      fromRaw += " " + line.trim();
    } else if (mode === "body") {
      if (/^=+$/.test(line.trim())) break;
      body += "\n" + line;
    }
  }

  const from = parseFrom(fromRaw);
  let messageAt = null;
  if (dateLine) {
    const ms = Date.parse(dateLine);
    if (!Number.isNaN(ms)) messageAt = new Date(ms).toISOString();
  }

  return {
    email: cleanEmail(senderEmail || from.email),
    senderName: normalizeSpaces(decodeMimeWords(senderName || from.name)),
    subject: normalizeSpaces(decodeMimeWords(subjectRaw)) || "(ללא נושא)",
    body: compactBody(body),
    messageAt,
    dateLine
  };
}

function splitMessages(fileContent) {
  return fileContent
    .split(/(?:^|\r?\n)--- EMAIL \d+ ---\s*\r?\n/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseOneMessage);
}

function fieldBetween(body, label, endLabels) {
  const start = body.indexOf(label);
  if (start === -1) return "";
  const valueStart = start + label.length;
  let end = body.length;
  for (const endLabel of endLabels) {
    const i = body.indexOf(endLabel, valueStart);
    if (i !== -1 && i < end) end = i;
  }
  return normalizeSpaces(body.slice(valueStart, end));
}

function parseWebsiteSubmission(msg) {
  const body = decodeEntities(msg.body);
  const looksLikeWebsite =
    msg.subject.includes("הודעה חדשה באתר Jusic") ||
    (body.includes("שם מלא:") && body.includes("הודעה:"));

  if (!looksLikeWebsite) return null;

  const name = fieldBetween(body, "שם מלא:", ["טלפון נייד:", "טלפון:", "אימייל:", "הודעה:"]);
  const phone = fieldBetween(body, "טלפון נייד:", ["אימייל:", "הודעה:", "---תאריך:", "תאריך:"]);
  const email = cleanEmail(fieldBetween(body, "אימייל:", ["הודעה:", "---תאריך:", "תאריך:"]));
  const message = fieldBetween(body, "הודעה:", ["---תאריך:", "תאריך:", "קישור לעמוד:", "פרטי משתמש:", "IP השולח:"]);
  const pageUrl = fieldBetween(body, "קישור לעמוד:", ["פרטי משתמש:", "IP השולח:", "מופעל באמצעות:"]);
  const ip = fieldBetween(body, "IP השולח:", ["מופעל באמצעות:"]);

  const primaryText = message || normalizeSpaces(body);
  const metadata = [
    name ? `שם מלא: ${name}` : "",
    phone ? `טלפון: ${phone}` : "",
    email ? `אימייל: ${email}` : "",
    "",
    "הודעה:",
    primaryText || "(ללא תוכן)",
    "",
    pageUrl ? `קישור לעמוד: ${pageUrl}` : "",
    ip ? `IP השולח: ${ip}` : ""
  ]
    .filter((line, index, arr) => line || (arr[index - 1] && arr[index + 1]))
    .join("\n")
    .trim();

  return {
    ...msg,
    email: email || msg.email,
    senderName: name || msg.senderName,
    subject: primaryText ? `פנייה מהאתר: ${shorten(primaryText, 90)}` : msg.subject,
    body: metadata || msg.body,
    originalSubject: msg.subject
  };
}

function isMusicPrSpam(msg) {
  const email = msg.email;
  const text = `${msg.senderName} ${msg.subject} ${msg.body}`.toLowerCase();
  const senders = [
    "pr@bafront",
    "pr@irpr",
    "irpr.co.il",
    "bafront.co.il",
    "zingmusic.app",
    "upload@zing",
    "overtone.od@gmail.com",
    "natibadashpr",
    "badashpr@gmail",
    "bafront0505831660"
  ];
  if (senders.some((sender) => email.includes(sender))) return true;
  if (/יחסי ציבור/i.test(text)) return true;
  return /youtube\.com|youtu\.be/i.test(text) && /משיק|סינגל חדש|מחרוזת|אלבום חדש|קליפ חדש|השיר החדש/i.test(text);
}

function isSystemMessage(msg) {
  const domain = msg.email.split("@")[1] || "";
  if (SYSTEM_SENDER_PATTERNS.some((pattern) => pattern.test(domain))) return true;
  if (SYSTEM_SUBJECT_PATTERNS.some((pattern) => pattern.test(msg.subject))) return true;
  if (/no-?reply|noreply|notification|workspace|accounts/i.test(msg.email)) return true;
  return false;
}

function shouldImportDirectMessage(msg) {
  if (!msg.email || !msg.subject) return false;
  if (msg.email === "info@jusic.co") return false;
  if (isMusicPrSpam(msg)) return true;
  if (isSystemMessage(msg)) return false;
  return Boolean(normalizeSpaces(`${msg.subject} ${msg.body}`));
}

function categoryFor(text, isSpam) {
  const t = text.toLowerCase();
  if (isSpam) return "spam";
  if (
    /contact form marketing|automate your income|money-making|expensive ads|ai-driven|ai system|earn 35%|visa or mastercard|reputation video|millions of websites|blast your message|impactful video|engaging video|ebooks up to 180 pages/.test(t)
  ) return "spam";
  if (/זכויות|יוצרים|copyright|הפרת|הסרה|תוכן שלי|שיר שלי/.test(t)) return "copyright";
  if (/מנוי|פרימיום|תשלום|חיוב|רכישה|אשראי|כרטיס|כסף|מחיר|מסלול|חשבונית/.test(t)) return "premium";
  if (/תקלה|בעיה|לא עובד|לא מצליח|שגיאה|התחברות|סיסמה|נפתח|קריסה|התקנה|הורדה/.test(t)) return "bugs";
  if (/זמר|אמן|להצטרף|העלאת שיר|להעלות שיר|להכניס.*שיר|תעלו.*שיר|פרסום שיר|שיר חדש|סינגל חדש|קישור יוטיוב|ערוץ.*יוטיוב|קריוקי|מפיק|יוצר/.test(t)) return "artist";
  if (/spam|casino|bitcoin|viagra|earn money/i.test(t)) return "spam";
  return "suggestions";
}

function priorityFor(text, category) {
  if (category === "spam") return 1;
  if (/דחוף|חויבתי|כסף|לא עובד|לא מצליח|תקלה|בעיה|הסירו אותי/.test(text)) return 5;
  if (category === "bugs" || category === "premium") return 4;
  return 3;
}

function shorten(value, length) {
  const compact = normalizeSpaces(value);
  return compact.length > length ? `${compact.slice(0, length - 1)}…` : compact;
}

function stableHash(parts) {
  return crypto
    .createHash("sha256")
    .update(parts.map((part) => normalizeSpaces(part).toLowerCase()).join("\n"))
    .digest("hex");
}

function toTicketRecord(msg, sourceFile) {
  const spam = isMusicPrSpam(msg);
  const text = `${msg.subject} ${msg.body}`;
  const category = categoryFor(text, spam);
  const status = category === "spam" ? "closed" : "open";
  const priority = priorityFor(text, category);
  const summary = category === "spam" ? "מייל יחסי ציבור או ספאם שהועבר לארכיון." : shorten(msg.body || msg.subject, 160);
  const importKey = `info-mail:${stableHash([msg.messageAt || "", msg.email, msg.subject, msg.body])}`;

  return {
    importKey,
    senderEmail: msg.email,
    senderName: msg.senderName || msg.email,
    subject: msg.subject,
    body: msg.body || msg.subject,
    category,
    priority,
    summary,
    status,
    messageAt: msg.messageAt,
    sourceFile
  };
}

function readRecords(files) {
  const unique = new Map();
  const stats = {
    files: files.length,
    raw: 0,
    website: 0,
    direct: 0,
    skipped: 0,
    duplicateInFiles: 0
  };

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const messages = splitMessages(text);
    stats.raw += messages.length;

    for (const raw of messages) {
      const website = parseWebsiteSubmission(raw);
      const msg = website || raw;
      const importable = Boolean(website) || shouldImportDirectMessage(raw);
      if (!importable) {
        stats.skipped += 1;
        continue;
      }

      if (website) stats.website += 1;
      else stats.direct += 1;

      const record = toTicketRecord(msg, path.basename(file));
      if (unique.has(record.importKey)) {
        stats.duplicateInFiles += 1;
        continue;
      }
      unique.set(record.importKey, record);
    }
  }

  return { records: [...unique.values()], stats };
}

async function ensureSchema(sql) {
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_import_key TEXT`;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_ingested_at TIMESTAMPTZ`;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_to TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closure_note TEXT NOT NULL DEFAULT ''`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_email_import_key
    ON tickets (email_import_key)
    WHERE email_import_key IS NOT NULL
  `;
}

async function tagExistingEditorTickets(sql) {
  const updated = await sql`
    UPDATE tickets
    SET
      tags = COALESCE(
        (
          SELECT array_agg(DISTINCT tag)
          FROM unnest(COALESCE(tags, '{}') || ARRAY[${EDITOR_TAG}]::text[]) AS tag
        ),
        ARRAY[${EDITOR_TAG}]::text[]
      ),
      updated_at = now()
    WHERE NOT (COALESCE(tags, '{}') @> ARRAY[${EDITOR_TAG}]::text[])
      AND NOT (COALESCE(tags, '{}') && ARRAY[${INFO_TAG}]::text[])
    RETURNING id
  `;
  return updated.length;
}

async function insertChunk(sql, rows) {
  if (rows.length === 0) return 0;

  const senderEmails = rows.map((row) => row.senderEmail);
  const senderNames = rows.map((row) => row.senderName);
  const subjects = rows.map((row) => row.subject);
  const bodies = rows.map((row) => row.body);
  const categories = rows.map((row) => row.category);
  const priorities = rows.map((row) => row.priority);
  const summaries = rows.map((row) => row.summary);
  const statuses = rows.map((row) => row.status);
  const messageAts = rows.map((row) => row.messageAt);
  const importKeys = rows.map((row) => row.importKey);

  const inserted = await sql`
    WITH incoming (
      sender_email,
      sender_name,
      subject,
      body,
      category,
      priority,
      ai_summary,
      status,
      message_at,
      email_import_key
    ) AS (
      SELECT * FROM UNNEST (
        ${senderEmails}::text[],
        ${senderNames}::text[],
        ${subjects}::text[],
        ${bodies}::text[],
        ${categories}::text[],
        ${priorities}::int[],
        ${summaries}::text[],
        ${statuses}::text[],
        ${messageAts}::timestamptz[],
        ${importKeys}::text[]
      )
    )
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
        tags,
        email_import_key,
        email_ingested_at
      )
    SELECT
      i.sender_email,
      i.sender_name,
      i.subject,
      i.body,
      i.category,
      i.priority,
      i.ai_summary,
      i.status,
      ${"email"},
      i.message_at,
      ARRAY[${INFO_TAG}]::text[],
      i.email_import_key,
      now()
    FROM incoming i
    WHERE NOT EXISTS (
      SELECT 1
      FROM tickets t
      WHERE lower(t.sender_email) = lower(i.sender_email)
        AND lower(trim(t.subject)) = lower(trim(i.subject))
        AND trim(t.body) = trim(i.body)
    )
    ON CONFLICT (email_import_key) WHERE email_import_key IS NOT NULL DO NOTHING
    RETURNING id
  `;

  return inserted.length;
}

async function importToDb(records) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");

  const sql = neon(databaseUrl);
  await ensureSchema(sql);
  const editorTagged = await tagExistingEditorTickets(sql);

  let inserted = 0;
  for (let i = 0; i < records.length; i += INSERT_CHUNK) {
    inserted += await insertChunk(sql, records.slice(i, i + INSERT_CHUNK));
    console.log(`Inserted ${inserted}/${records.length}`);
  }

  return { inserted, editorTagged };
}

function printSummary(records, stats, dbResult) {
  const byCategory = new Map();
  for (const record of records) {
    byCategory.set(record.category, (byCategory.get(record.category) || 0) + 1);
  }

  console.log(`Files: ${stats.files}`);
  console.log(`Raw emails: ${stats.raw}`);
  console.log(`Website inquiries: ${stats.website}`);
  console.log(`Direct support emails: ${stats.direct}`);
  console.log(`Skipped non-inquiries: ${stats.skipped}`);
  console.log(`Duplicates inside files: ${stats.duplicateInFiles}`);
  console.log(`Unique import candidates: ${records.length}`);
  for (const [category, count] of [...byCategory.entries()].sort()) {
    console.log(`- ${category}: ${count}`);
  }
  if (dbResult) {
    console.log(`Existing tickets tagged ${EDITOR_TAG}: ${dbResult.editorTagged}`);
    console.log(`Inserted into DB with ${INFO_TAG}: ${dbResult.inserted}`);
    console.log(`Already existed in DB: ${records.length - dbResult.inserted}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const noDb = args.includes("--no-db") || args.includes("--dry-run");
  const files = args
    .filter((arg) => arg !== "--no-db" && arg !== "--dry-run")
    .map((arg) => path.resolve(arg));

  const inputFiles = files.length > 0 ? files : DEFAULT_FILES.filter((file) => fs.existsSync(file));
  if (inputFiles.length === 0) {
    console.error("No batch files found. Pass file paths or place batch_1.txt..batch_10.txt under Desktop/MAIL/Emails_Batches.");
    process.exit(1);
  }

  const { records, stats } = readRecords(inputFiles);
  const dbResult = noDb ? null : await importToDb(records);
  printSummary(records, stats, dbResult);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
