# משתני סביבה ל-Render — העתקה מלאה

> **חשוב:** אין לי גישה לסודות שהזנת בעבר (סיסמאות, API keys).  
> הקובץ הזה מכיל **שמות משתנים + ערכים קבועים** שכבר מוגדרים בפרויקט.  
> במקומות שכתוב `<<מלא כאן>>` — תמלא מהמקורות שמפורטים למטה.

---

## איפה למצוא את מה שכבר נתת בעבר

| מה חסר | איפה למצוא |
|--------|------------|
| `DATABASE_URL` | [Neon Console](https://console.neon.tech) → הפרויקט → Connection string |
| `GOOGLE_GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) |
| `EMAIL_IMAP_APP_PASSWORD` | Google Account → אבטחה → סיסמאות אפליקציה → Gmail |
| `GMAIL_CLIENT_ID` / `SECRET` | [Google Cloud Console](https://console.cloud.google.com) → APIs → Credentials → OAuth Desktop |
| `GMAIL_REFRESH_TOKEN` | הרץ מקומית: `python scripts/gmail_mailer.py auth-only` (אחרי ש-ID/Secret ב-.env) |
| `EMAIL_INGEST_SECRET` | Render ישן, או צור מחרוזת אקראית: `openssl rand -hex 32` |

אם Render עדיין רץ — לפעמים אפשר לראות משתנים ישנים ב-**Environment** (ללא ערך מלא לסודות, רק שם).

---

## שירות Web: `jusic-crm`

מחק את כל משתני הסביבה הקיימים והדבק **רק** את הרשימה הזו (מלא את `<<...>>`):

```env
# === חובה ===
DATABASE_URL=<<מ-Neon>>
GATE_ACCESS_CODE=JUSIC
GOOGLE_GEMINI_API_KEY=<<מ-Google AI Studio>>

# סוד משותף ל-cron (אותה מחרוזת בכל מקום שמסומן)
EMAIL_INGEST_SECRET=<<מחרוזת-אקראית-ארוכה>>
EMAIL_OUTBOUND_SECRET=<<אותה-מחרוזת-כמו-EMAIL_INGEST_SECRET>>

# === מייל — כתובת ושם ===
EMAIL_FROM=EDITOR@JUSIC.CO
EMAIL_FROM_NAME=Jusic

# === ייבוא מיילים (IMAP) ===
EMAIL_INGEST_PROVIDER=imap
EMAIL_IMAP_USER=EDITOR@JUSIC.CO
EMAIL_IMAP_APP_PASSWORD=<<App-Password-16-תווים>>
EMAIL_IMAP_HOST=imap.gmail.com
EMAIL_IMAP_PORT=993
EMAIL_IMAP_MAILBOX=INBOX

# === שליחת תשובות ללקוח (Gmail API — מומלץ) ===
EMAIL_REPLY_PROVIDER=gmail_api
GMAIL_CLIENT_ID=<<xxxx.apps.googleusercontent.com>>
GMAIL_CLIENT_SECRET=<<xxxx>>
GMAIL_REFRESH_TOKEN=<<מהרצת gmail_mailer.py auth-only>>

# === SMTP (גיבוי בלבד — לא חובה אם Gmail API עובד) ===
EMAIL_SMTP_USER=EDITOR@JUSIC.CO
EMAIL_SMTP_APP_PASSWORD=<<אותו App Password כמו IMAP>>
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_SECURE=false
EMAIL_SMTP_TIMEOUT_MS=25000

# === הגדרות ייבוא ===
EMAIL_INGEST_SOURCE_TAG=EDITOR
EMAIL_INGEST_LOOKBACK_DAYS=14
EMAIL_INGEST_MAX_MESSAGES=50
EMAIL_INGEST_TIMEOUT_MS=90000
EMAIL_INGEST_ATTACHMENTS=true
EMAIL_ATTACHMENT_MAX_BYTES=8388608
EMAIL_ATTACHMENT_MAX_COUNT=8
EMAIL_ATTACHMENT_ALLOW=image,video

# === גיבוי DB ===
BACKUP_RETENTION_COUNT=12
BACKUP_INCLUDE_ATTACHMENTS=true

# === Render (אוטומטי — אופציונלי) ===
RENDER=true
NODE_VERSION=20.18.0
```

### אל תוסיף (כפילויות מיותרות)

- `GEMINI_API_KEY` — מספיק `GOOGLE_GEMINI_API_KEY` בלבד  
- `GMAIL_USER`, `GMAIL_APP_PASSWORD` — השתמש ב-`EMAIL_IMAP_*`  
- `EMAIL_INGEST_URL` על ה-web — רק ב-cron  

---

## Cron: `jusic-email-ingest` (כל 5 דקות)

```env
NODE_ENV=production
EMAIL_INGEST_URL=https://jusic-crm.onrender.com
EMAIL_INGEST_SECRET=<<זהה ל-web>>
```

(החלף `jusic-crm.onrender.com` בשם האמיתי של האפליקציה אם שונה.)

---

## Cron: `jusic-email-outbound` (כל 10 דקות)

```env
NODE_ENV=production
EMAIL_OUTBOUND_URL=https://jusic-crm.onrender.com
EMAIL_OUTBOUND_SECRET=<<זהה ל-web>>
```

---

## Cron: `jusic-db-backup`

```env
NODE_ENV=production
BACKUP_URL=https://jusic-crm.onrender.com
BACKUP_SECRET=<<זהה ל-EMAIL_INGEST_SECRET>>
```

---

## בדיקה מהירה אחרי שמירה

1. Deploy ב-Render  
2. במערכת: **סנכרן מיילים** — אמור להופיע פופאפ ירוק  
3. שליחת מענה ללקוח — לא אמור להופיע "Gmail API לא מוגדר"  
4. `/api/health` — אם קיים, בדוק שאין שגיאת DB  

---

## קובץ מקומי לפיתוח

העתק ל-`.env` בשורש הפרויקט (לא נכנס ל-Git):

```bash
cp .env.example .env
```

ערוך `.env` עם אותם ערכים כמו ב-Render.
