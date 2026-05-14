/**
 * Reclassify legacy "suggestions" rows into more useful operational buckets.
 */
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { neon } = require("@neondatabase/serverless");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

  const sql = neon(databaseUrl);

  const before = await sql`
    SELECT category, count(*)::int AS c
    FROM tickets
    GROUP BY category
    ORDER BY c DESC
  `;

  const updated = await sql`
    WITH candidates AS (
      SELECT
        id,
        lower(subject || ' ' || body || ' ' || sender_name || ' ' || sender_email) AS t
      FROM tickets
      WHERE category = 'suggestions'
    ),
    classified AS (
      SELECT
        id,
        CASE
          WHEN t ~ '(contact form marketing|automate your income|money-making|expensive ads|ai-driven|ai system|earn 35%|visa or mastercard|reputation video|millions of websites|blast your message|impactful video|engaging video|investment opportunities|gulf.based investors|ebooks up to 180 pages|casino|bitcoin|viagra|adult|free trial|click here)'
            THEN 'spam'
          WHEN t ~ '(זכויות|יוצרים|יצירות|בעלות על יצירות|מאסטר|copyright|הפרת|הסרה|תוכן שלי|שיר שלי|זכויות יוצרים)'
            THEN 'copyright'
          WHEN t ~ '(מנוי|פרימיום|תשלום|חיוב|רכישה|אשראי|כרטיס|כסף|מחיר|מסלול|חשבונית|להירשם|הרשמה|הצטרפות|להתחבר|חברו אותי|תחברו אותי|subscription|billing|payment)'
            THEN 'premium'
          WHEN t ~ '(תקלה|בעיה|לא עובד|לא מצליח|שגיאה|התחברות|סיסמה|נפתח|קריסה|התקנה|הורדה|לתקן|מספר.*ישן|להחליף.*מספר|עד לפני כמה ימים זה עבד|ברוכים הבאים|באג|bug|error|login|איטי|נתקע)'
            THEN 'bugs'
          WHEN t ~ '(זמר|אמן|אמנים|להצטרף|העלאת שיר|להעלות שיר|להכניס.*שיר|תעלו.*שיר|פרסום שיר|שיר חדש|סינגל חדש|אלבום חדש|קליפ|קליפים|קישור יוטיוב|youtube|youtu.be|ערוץ.*יוטיוב|קריוקי|מוזיקה שלי|שירים עדכניים|שירים חדשים|שיעורים|דף היומי|האלבום|maccabeats|מכביטס)'
            THEN 'artist'
          WHEN t ~ '(הצעה|הצעות|שיפור|לשפר|תוסיפו|להוסיף|רעיון|ממליץ|כדאי|אשמח אם|נשמח אם|אם אפשר|בקשה|מבקש|פיצ.ר|אפשרות)'
            THEN 'suggestions'
          ELSE 'Customer_Support'
        END AS target
      FROM candidates
    )
    UPDATE tickets AS t
    SET
      category = c.target,
      status = CASE WHEN c.target = 'spam' THEN 'closed' ELSE t.status END,
      priority = CASE
        WHEN c.target = 'spam' THEN 1
        WHEN c.target IN ('bugs', 'premium') THEN GREATEST(t.priority, 4)
        ELSE t.priority
      END,
      ai_summary = CASE
        WHEN c.target = 'Customer_Support' AND (t.ai_summary = '' OR t.ai_summary = 'פנייה כללית שהתקבלה וממתינה לטיפול.')
          THEN 'פניית שירות לקוחות כללית למיון וטיפול.'
        WHEN c.target = 'artist' AND (t.ai_summary = '' OR t.ai_summary = 'פנייה כללית שהתקבלה וממתינה לטיפול.')
          THEN 'פנייה בנושא מוזיקה, אמנים, שירים או תוכן.'
        WHEN c.target = 'bugs' AND (t.ai_summary = '' OR t.ai_summary = 'פנייה כללית שהתקבלה וממתינה לטיפול.')
          THEN 'פנייה בנושא תקלה, התחברות או בעיית שימוש.'
        WHEN c.target = 'premium' AND (t.ai_summary = '' OR t.ai_summary = 'פנייה כללית שהתקבלה וממתינה לטיפול.')
          THEN 'פנייה בנושא הרשמה, מנוי או חיוב.'
        WHEN c.target = 'copyright' AND (t.ai_summary = '' OR t.ai_summary = 'פנייה כללית שהתקבלה וממתינה לטיפול.')
          THEN 'פנייה בנושא זכויות יוצרים או בעלות על תוכן.'
        WHEN c.target = 'spam'
          THEN 'זוהה כספאם או פנייה שיווקית לא רלוונטית.'
        ELSE t.ai_summary
      END,
      updated_at = now()
    FROM classified AS c
    WHERE t.id = c.id
      AND c.target <> 'suggestions'
    RETURNING c.target
  `;

  const moved = updated.reduce((acc, row) => {
    const key = String(row.target);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const after = await sql`
    SELECT category, count(*)::int AS c
    FROM tickets
    GROUP BY category
    ORDER BY c DESC
  `;

  console.log(JSON.stringify({ before, moved, after }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
