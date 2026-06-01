# פריסה ל-Render — Jusic SERVICE (`jusic-crm`)

מערכת זו: **ריפו `nisani9792-arch/SERVICE` בלבד** — לא ARTIST, לא 111-CRM.

## כתובת יעד

- **Production:** `https://jusic-crm.onrender.com`
- **בדיקת בריאות:** `https://jusic-crm.onrender.com/api/health`
- **CRM:** `https://jusic-crm.onrender.com/dashboard?view=workbench`

אם מתקבל **404** — השירות ב-Render לא קיים, מושעה, או נמחק. יש ליצור/להפעיל מחדש (ראו למטה).

---

## אפשרות א׳ — חיבור GitHub ב-Render (מומלץ)

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** (או Web Service).
2. חבר את הריפו: `nisani9792-arch/SERVICE`, ענף **`main`**.
3. אם יש `render.yaml` בשורש — Render ייצור:
   - Web: `jusic-crm`
   - Cron: `jusic-email-ingest`, `jusic-email-outbound`, `jusic-db-backup`
4. הפעל **Auto-Deploy** לענף `main`.
5. מלא משתני סביבה לפי [`RENDER-ENV-HE.md`](./RENDER-ENV-HE.md) (`DATABASE_URL`, סודות מייל, Gemini וכו').

אחרי push ל-`main`, Render בונה ומפריס אוטומטית.

---

## אפשרות ב׳ — Deploy Hook + GitHub Actions

1. Render → שירות **`jusic-crm`** → **Settings** → **Deploy Hook** → העתק URL.
2. GitHub → `SERVICE` → **Settings** → **Secrets and variables** → **Actions** →  
   Secret בשם **`RENDER_DEPLOY_HOOK_URL`** = ה-URL מהשלב הקודם.
3. Push ל-`main`:
   - Workflow **CI** — lint, בדיקות reply, build.
   - Workflow **Deploy to Render** — קורא ל-hook אחרי CI מוצלח (או ידנית: Actions → Deploy to Render → Run workflow).

---

## אימות אחרי פריסה

1. `/api/health` — סטטוס DB (אם `DATABASE_URL` תקין).
2. `/dashboard` — תיבת דואר, פניות חוזרות, מענה במובייל.
3. Render → **Logs** — אין שגיאות build/start.

---

## CI מקומי (לפני push)

```bash
npm ci
npm run lint
npm run test:reply
npm run build
```

---

## בעיות נפוצות

| תסמין | פתרון |
|--------|--------|
| 404 על `jusic-crm.onrender.com` | צור Blueprint מ-`render.yaml` או הפעל מחדש את השירות |
| Build נכשל ב-Render | בדוק Logs; ודא `NODE_VERSION=20` ו-`DATABASE_URL` |
| אין מייל נכנס | Cron `jusic-email-ingest` + `EMAIL_INGEST_SECRET` |
| GitHub Actions ירוק אבל האתר ישן | חסר hook — הגדר `RENDER_DEPLOY_HOOK_URL` או Auto-Deploy ב-Render |
