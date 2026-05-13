/**
 * Import exported MAIL batch files (--- EMAIL N --- / DATE / FROM / SUBJECT / BODY format).
 *
 * - PR / new song press releases → category Spam, status closed (גוף ההודעה נשמר כפי שהוא).
 * - אחרים → סיווג Gemini (או heuristics אם אין מפתח API).
 *
 * Usage (מתוך תיקיית SERVICE):
 *   node scripts/import-mail-batches.cjs path/to/batch_1.txt ...
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const MODEL_NAME = "gemini-1.5-flash";
const INSERT_CHUNK = 200;
const CLASSIFY_CONCURRENCY = 8;

const DEFAULT_FILES = [
  path.join(process.env.USERPROFILE || process.env.HOME || "", "Desktop/MAIL/Emails_Batches/batch_1.txt"),
  path.join(process.env.USERPROFILE || process.env.HOME || "", "Desktop/MAIL/Emails_Batches/batch_2.txt"),
  path.join(process.env.USERPROFILE || process.env.HOME || "", "Desktop/MAIL/Emails_Batches/batch_3.txt"),
  path.join(process.env.USERPROFILE || process.env.HOME || "", "Desktop/MAIL/Emails_Batches/batch_4.txt")
];

function decodeMimeWords(str) {
  if (!str) return "";
  let out = str;
  let prev;
  const re = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;
  do {
    prev = out;
    out = out.replace(re, (_m, _charset, enc, text) => {
      if (enc === "B" || enc === "b") {
        try {
          const cleaned = text.replace(/\s+/g, "");
          return Buffer.from(cleaned, "base64").toString("utf8");
        } catch {
          return text;
        }
      }
      if (enc === "Q" || enc === "q") {
        try {
          const cleaned = text.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_h, hx) =>
            String.fromCharCode(parseInt(hx, 16))
          );
          return cleaned;
        } catch {
          return text;
        }
      }
      return text;
    });
  } while (out !== prev);
  return out.replace(/\s+/g, " ").trim();
}

function parseFrom(fromRaw) {
  const raw = fromRaw.trim();
  const m = raw.match(/<([^>]+)>/);
  const email = (m ? m[1] : raw.match(/[\w.+%-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] || "").trim();
  let name = raw.replace(/<[^>]+>/, "").trim();
  name = decodeMimeWords(name);
  return { email, name: name || email, rawFrom: raw };
}

function parseOneMessage(block) {
  const lines = block.split(/\r?\n/);
  let dateLine = "";
  let fromRaw = "";
  let subjectRaw = "";
  let body = "";
  let mode = "none";

  for (const line of lines) {
    if (line.startsWith("DATE:")) {
      mode = "date";
      dateLine = line.slice(5).trim();
    } else if (line.startsWith("FROM:")) {
      mode = "from";
      fromRaw = line.slice(5).trim();
    } else if (line.startsWith("SUBJECT:")) {
      mode = "subject";
      subjectRaw = line.slice(8).trim();
    } else if (line.startsWith("BODY:")) {
      mode = "body";
      body = line.slice(5);
    } else if (mode === "from" && /^\s/.test(line)) {
      fromRaw += " " + line.trim();
    } else if (mode === "subject" && /^\s/.test(line)) {
      subjectRaw += " " + line.trim();
    } else if (mode === "body") {
      if (/^=+$/.test(line.trim())) break;
      body += "\n" + line;
    }
  }

  const { email, name } = parseFrom(fromRaw);
  const subject = decodeMimeWords(subjectRaw.trim()) || "(ללא נושא)";
  const bodyNorm = body.replace(/^\n/, "");

  let messageAt = null;
  if (dateLine) {
    const ms = Date.parse(dateLine);
    if (!Number.isNaN(ms)) messageAt = new Date(ms).toISOString();
  }

  return {
    email: email.toLowerCase(),
    senderName: name,
    subject,
    body: bodyNorm,
    messageAt,
    dateLine
  };
}

function splitMessages(fileContent) {
  const parts = fileContent.split(/\n--- EMAIL \d+ ---\s*\n/g);
  const out = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    const m = parseOneMessage(t);
    if (m.email && m.subject) out.push(m);
  }
  return out;
}

function isMusicPrSpam(msg) {
  const e = msg.email;
  const b = msg.body || "";
  const s = msg.subject || "";
  const n = (msg.senderName || "").toLowerCase();

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
  for (const d of senders) {
    if (e.includes(d)) return true;
  }

  if (/יחסי ציבור/i.test(b) || /יחסי ציבור/i.test(s)) return true;
  if (/\|\s*pr\b/i.test(n) || /pr\s*\|/i.test(msg.senderName || "")) return true;

  const promo =
    /youtube\.com|youtu\.be/i.test(b) &&
    /משיק|סינגל חדש|מחרוזת|אלבום חדש|קליפ חדש|השיר החדש/i.test(b);
  if (promo && (e.includes("pr@") || /overtone|zingmusic/i.test(e))) return true;

  return false;
}

const ALLOWED = ["suggestions", "bugs", "premium", "copyright", "artist", "spam"];
const SPAM_KEYWORDS = ["bitcoin", "casino", "viagra", "earn money fast"];
const URGENT = ["דחוף", "לא עובד", "תקלה", "can't login", "cannot login", "לא מצליח להתחבר"];

function quickHeuristic(subject, body) {
  const t = `${subject} ${body}`.toLowerCase();
  if (SPAM_KEYWORDS.some((w) => t.includes(w)))
    return { category: "spam", priority: 1, summary: "ספאם שזוהה לפי מילות מפתח." };
  if (URGENT.some((w) => t.includes(w)))
    return { category: "bugs", priority: 5, summary: "פנייה דחופה או תקלה באפליקציה." };
  return null;
}

function extractJsonBlock(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const a = trimmed.indexOf("{");
  const b = trimmed.lastIndexOf("}");
  if (a === -1 || b <= a) throw new Error("no json");
  return trimmed.slice(a, b + 1);
}

async function classifyGemini(senderEmail, subject, body, model) {
  const compactBody = String(body).slice(0, 8000);
  const prompt = `
You are an email support classifier for Jusic CRM.
Classify the message into exactly one category and return strict JSON only.

Allowed categories:
- suggestions
- bugs
- premium
- copyright
- artist
- spam

Rules:
- priority is integer 1..5 (5 = urgent)
- summary is ONE sentence Hebrew, maximum 24 words.
- no markdown, no explanation, no extra keys.

Return exactly:
{"category":"suggestions","priority":3,"summary":"..."}

Email metadata:
senderEmail: ${senderEmail}
subject: ${subject}
body:
${compactBody}
`;

  const response = await model.generateContent(prompt);
  const text = response.response.text();
  const parsed = JSON.parse(extractJsonBlock(text));
  let category = ALLOWED.includes(parsed.category) ? parsed.category : "suggestions";
  const pr = Number(parsed.priority);
  const priority = Number.isInteger(pr) && pr >= 1 && pr <= 5 ? pr : 3;
  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : "פנייה מייבוא מייל.";
  return { category, priority, summary };
}

async function buildClassifier() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
  });
}

async function classifyOne(msg, model) {
  const h = quickHeuristic(msg.subject, msg.body);
  if (h) return { ...msg, ...h };

  if (!model) {
    return {
      ...msg,
      category: "suggestions",
      priority: 3,
      summary: "מיובא ממייל; סווג כללי (ללא Gemini)."
    };
  }

  try {
    const c = await classifyGemini(msg.email, msg.subject, msg.body, model);
    return { ...msg, ...c };
  } catch {
    return {
      ...msg,
      category: "suggestions",
      priority: 3,
      summary: "סיווג אוטומטי נכשל; יש לבדוק ידנית."
    };
  }
}

async function classifyPool(items, model, concurrency) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const part = await Promise.all(batch.map((item) => classifyOne(item, model)));
    results.push(...part);
    process.stdout.write(`\rסיווג: ${Math.min(i + concurrency, items.length)}/${items.length}   `);
  }
  console.log("");
  return results;
}

async function ensureSchema(sql) {
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS message_at TIMESTAMPTZ`;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_to TEXT NOT NULL DEFAULT ''`;
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
    senderEmails.push(row.email);
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
  let files = process.argv.slice(2).map((f) => path.resolve(f));
  if (files.length === 0) {
    files = DEFAULT_FILES.filter((f) => fs.existsSync(f));
    if (files.length === 0) {
      console.error("ציין נתיבים לקבצי batch או שים אותם ב-Desktop/MAIL/Emails_Batches/");
      process.exit(1);
    }
    console.log("משתמש בקבצי ברירת מחדל:", files.join(", "));
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL חסר");
    process.exit(1);
  }

  const sql = neon(url);
  await ensureSchema(sql);

  const all = [];
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.warn("דילוג — הקובץ לא קיים:", f);
      continue;
    }
    const text = fs.readFileSync(f, "utf8");
    const msgs = splitMessages(text);
    console.log(path.basename(f), "->", msgs.length, "messages");
    all.push(...msgs);
  }

  const pr = [];
  const rest = [];
  for (const m of all) {
    if (isMusicPrSpam(m)) {
      pr.push({
        ...m,
        category: "Spam",
        priority: 1,
        summary: "שחרור/יחסי ציבור — סווג אוטומטית לספאם.",
        status: "closed"
      });
    } else {
      rest.push(m);
    }
  }

  console.log("PR / spam bucket:", pr.length);
  console.log("To classify:", rest.length);

  const model = await buildClassifier();
  if (!model) console.log("(No Gemini key — heuristics + suggestions only)");

  const classified = await classifyPool(rest, model, CLASSIFY_CONCURRENCY);
  const normalRowsFixed = classified.map((m) => ({
    email: m.email,
    senderName: m.senderName,
    subject: m.subject,
    body: m.body,
    category: m.category,
    priority: m.priority,
    summary: m.summary,
    status: "open",
    messageAt: m.messageAt
  }));

  let inserted = 0;
  const combined = [...pr, ...normalRowsFixed];
  for (let i = 0; i < combined.length; i += INSERT_CHUNK) {
    const chunk = combined.slice(i, i + INSERT_CHUNK);
    const n = await insertChunk(sql, chunk);
    inserted += n;
    console.log("Inserted:", inserted, "/", combined.length);
  }

  console.log("Done. Total inserted:", inserted);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
