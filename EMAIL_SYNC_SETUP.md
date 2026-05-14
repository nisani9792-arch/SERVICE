# Gmail email sync setup

המערכת יכולה למשוך מיילים מ-Gmail, לנתח אותם עם Gemini, ולהכניס אותם אוטומטית כ-`tickets`.

## 1. הכנת Gmail

1. נכנסים ל-Gmail > Settings > See all settings > Forwarding and POP/IMAP.
2. מפעילים `Enable IMAP`.
3. בחשבון Google מפעילים 2-Step Verification אם עדיין לא פעיל.
4. יוצרים App Password חדש עבור האפליקציה.

חשוב: לא מכניסים את סיסמת Gmail הרגילה למערכת. משתמשים רק ב-App Password.

## 2. משתני סביבה ב-Render

להוסיף/לוודא את המשתנים הבאים:

```text
EMAIL_IMAP_USER=EDITOR@JUSIC.CO
EMAIL_IMAP_APP_PASSWORD=your-google-app-password-without-spaces
EMAIL_IMAP_HOST=imap.gmail.com
EMAIL_IMAP_PORT=993
EMAIL_INGEST_SECRET=long-random-secret
EMAIL_IMAP_MAILBOX=INBOX
EMAIL_INGEST_SOURCE_TAG=EDITOR
EMAIL_INGEST_LOOKBACK_DAYS=14
EMAIL_INGEST_MAX_MESSAGES=25
EMAIL_INGEST_URL=https://YOUR_RENDER_URL
```

`EMAIL_INGEST_SECRET` הוא קוד סודי לקרון החיצוני. אפשר ליצור ערך ארוך ואקראי, למשל 32 תווים ומעלה.

## 3. הפעלה ידנית

בדשבורד נוסף כפתור `סנכרן מיילים`. הוא מבקש את `EMAIL_INGEST_SECRET`, מפעיל את הסנכרון מיידית ומציג כמה פניות חדשות נוספו וכמה מיילים נמחקו מה-Inbox אחרי עיבוד מוצלח.

## 4. הפעלה כל 5 דקות

ב-`render.yaml` מוגדר Render Cron שמריץ כל 10 דקות:

```text
npm run email-ingest:trigger
```

ה-Cron קורא ל-`/api/email-ingest` עם header סודי. צריך להגדיר ב-Render גם `EMAIL_INGEST_URL` וגם `EMAIL_INGEST_SECRET` באותו ערך כמו שירות ה-Web.

## 5. איך המערכת מונעת כפילויות

כל מייל נשמר עם מזהה ייחודי מה-Gmail Message-ID, ואם אין כזה אז לפי UID של ה-Inbox. אחרי שמייל נשמר בהצלחה או זוהה ככפילות קיימת, הוא מסומן כ-`\Deleted` ונמחק מה-Inbox.

ברירת המחדל היא לבדוק עד 25 מיילים מה-14 ימים האחרונים בכל ריצה. אפשר לשנות זאת עם `EMAIL_INGEST_MAX_MESSAGES` ו-`EMAIL_INGEST_LOOKBACK_DAYS`.
