/**
 * Find and move English loan/funding contact-form spam to spam category.
 * Usage: node scripts/sweep-funding-spam.cjs [--dry-run]
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { neon } = require("@neondatabase/serverless");

const FUNDING_SPAM_RE =
  /(without much funds|fund your busines|funding opportunity|get funded|capitalfund|capital fund-hk|loan term period|burden of repayment|running your business without|growth of your business and projects|give us a call on:\+|write us at:info@|contact form marketing|automate your income|money-making|expensive ads|earn 35%|millions of websites|blast your message|impactful video|reputation video|investment opportunities|gulf.based investors|ebooks up to 180 pages|are you okay running your business)/i;

function isFundingSpam(row) {
  const text = [
    row.subject,
    row.body,
    row.body_cleaned,
    row.sender_email,
    row.sender_name
  ]
    .filter(Boolean)
    .join(" ");
  return FUNDING_SPAM_RE.test(text);
}

async function reportCounts(sql) {
  const phrases = [
    "are you okay running your business",
    "funding opportunity",
    "fund your busines",
    "capitalfund",
    "contact form marketing",
    "just visited jusic",
    "just visited jusi",
    "earn money",
    "bitcoin",
    "seo service",
    "guest post",
    "link building",
    "increase your traffic",
    "digital marketing",
    "web design service",
    "we can help your business",
    "dear sir",
    "dear owner"
  ];
  for (const phrase of phrases) {
    const rows = await sql`
      SELECT count(*)::int AS c
      FROM tickets
      WHERE deleted_at IS NULL
        AND lower(coalesce(body_cleaned, body, '')) LIKE ${`%${phrase}%`}
    `;
    console.log(`  phrase "${phrase}": ${rows[0]?.c ?? 0}`);
  }
  const spamRows = await sql`
    SELECT count(*)::int AS c
    FROM tickets
    WHERE deleted_at IS NULL
      AND lower(trim(category)) IN ('spam', 'spam (מובנה)')
  `;
  console.log(`  total spam category: ${spamRows[0]?.c ?? 0}`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const reportOnly = process.argv.includes("--report");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

  const sql = neon(databaseUrl);

  if (reportOnly) {
    console.log("Phrase counts (all tickets):");
    await reportCounts(sql);
    return;
  }

  const rows = await sql`
    SELECT id, subject, body, body_cleaned, sender_name, sender_email, category, status, created_at
    FROM tickets
    WHERE deleted_at IS NULL
      AND lower(trim(category)) NOT IN ('spam', 'spam (מובנה)')
    ORDER BY created_at DESC
  `;

  const matches = rows.filter(isFundingSpam);
  console.log(`Scanned ${rows.length} non-spam tickets (recent 5000).`);
  console.log(`Funding/marketing spam matches: ${matches.length}`);

  const byCategory = {};
  for (const row of matches) {
    const cat = row.category || "(none)";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }
  console.log("By category:", byCategory);

  for (const row of matches.slice(0, 5)) {
    const snippet = String(row.body_cleaned || row.body || "")
      .replace(/\s+/g, " ")
      .slice(0, 100);
    console.log("---", row.id, row.category, row.sender_email, snippet);
  }

  if (matches.length === 0) return;

  const ids = matches.map((r) => String(r.id));
  if (dryRun) {
    console.log(`Dry run — would move ${ids.length} tickets to spam.`);
    return;
  }

  const updated = await sql`
    UPDATE tickets
    SET category = 'spam',
        status = 'closed',
        priority = 1,
        ai_summary = COALESCE(
          NULLIF(trim(ai_summary), ''),
          'ספאם שיווקי — הצעת מימון/הלוואה באנגלית (זיהוי אוטומטי)'
        ),
        updated_at = now()
    WHERE id = ANY(${ids})
      AND deleted_at IS NULL
    RETURNING id
  `;

  console.log(`Moved ${updated.length} tickets to spam.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
