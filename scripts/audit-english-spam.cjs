/**
 * Audit English marketing/contact-form tickets still in triage queues.
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { neon } = require("@neondatabase/serverless");

function latinRatio(text) {
  const letters = text.replace(/[^a-zA-Z\u0590-\u05FF]/g, "");
  if (!letters.length) return 0;
  const latin = (text.match(/[a-zA-Z]/g) || []).length;
  return latin / letters.length;
}

function looksEnglishMarketing(text) {
  const t = text.toLowerCase();
  if (latinRatio(text) < 0.55) return false;
  const signals = [
    /are you okay running/,
    /funding opportunity/,
    /fund your busines/,
    /get funded/,
    /capitalfund/,
    /just visited (jusic|jusi)/,
    /contact form marketing/,
    /earn money/,
    /seo (service|expert)/,
    /guest post/,
    /link building/,
    /increase (your )?traffic/,
    /digital marketing/,
    /web design/,
    /we can help your (business|website)/,
    /dear (sir|owner|webmaster)/,
    /bitcoin/,
    /casino/,
    /viagra/,
    /guaranteed income/,
    /write us at:/,
    /give us a call/,
    /loan term/,
    /without stress/,
    /burden of repayment/
  ];
  return signals.some((re) => re.test(t));
}

async function main() {
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT id, category, status, sender_email, subject,
           coalesce(body_cleaned, body, '') AS body, created_at
    FROM tickets
    WHERE deleted_at IS NULL
      AND lower(trim(category)) NOT IN ('spam', 'spam (מובנה)')
      AND category IN ('pending_triage', 'Customer_Support', 'suggestions', 'general')
    ORDER BY created_at DESC
    LIMIT 8000
  `;

  const hits = [];
  for (const row of rows) {
    const text = `${row.subject || ""} ${row.body || ""}`;
    if (looksEnglishMarketing(text)) hits.push(row);
  }

  console.log(`Scanned ${rows.length} triage/support tickets.`);
  console.log(`English marketing spam candidates: ${hits.length}`);

  const byCat = {};
  for (const h of hits) byCat[h.category] = (byCat[h.category] || 0) + 1;
  console.log("By category:", byCat);

  for (const h of hits.slice(0, 15)) {
    const snip = String(h.body).replace(/\s+/g, " ").slice(0, 90);
    console.log("---", h.id, h.category, h.sender_email, snip);
  }

  const malformed = await sql`
    SELECT id, category, sender_email, left(coalesce(body_cleaned, body,''), 80) AS snip
    FROM tickets
    WHERE deleted_at IS NULL
      AND lower(trim(category)) NOT IN ('spam', 'spam (מובנה)')
      AND sender_email ~ 'hotmailcom|gmailcom|outlookcom'
    ORDER BY created_at DESC
    LIMIT 30
  `;
  console.log(`Malformed-domain senders (non-spam): ${malformed.length}`);
  for (const m of malformed.slice(0, 10)) {
    console.log("  ", m.id, m.category, m.sender_email, String(m.snip).slice(0, 60));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
