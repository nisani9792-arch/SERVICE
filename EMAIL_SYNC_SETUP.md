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
GMAIL_USER=your-address@gmail.com
GMAIL_APP_PASSWORD=your-google-app-password
EMAIL_INGEST_SECRET=long-random-secret
GMAIL_MAILBOX=INBOX
EMAIL_INGEST_LOOKBACK_DAYS=14
EMAIL_INGEST_MAX_MESSAGES=25
```

`EMAIL_INGEST_SECRET` הוא קוד סודי לקרון החיצוני. אפשר ליצור ערך ארוך ואקראי, למשל 32 תווים ומעלה.

## 3. הפעלה ידנית

בדשבורד נוסף כפתור `סנכרן מיילים`. הוא מפעיל את הסנכרון מיידית ומציג כמה פניות חדשות נוספו.

## 4. הפעלה כל 5 דקות

בכל שירות Cron חיצוני, למשל cron-job.org או Render Cron, להגדיר קריאת GET כל 5 דקות לכתובת:

```text
https://YOUR_RENDER_URL/api/email-ingest?secret=EMAIL_INGEST_SECRET
```

להחליף את `YOUR_RENDER_URL` בכתובת האמיתית של השירות ואת `EMAIL_INGEST_SECRET` בערך שהוגדר ב-Render.

## 5. איך המערכת מונעת כפילויות

כל מייל נשמר עם מזהה ייחודי מה-Gmail Message-ID, ואם אין כזה אז לפי UID של ה-Inbox. לכן גם אם הקרון רץ שוב על אותם מיילים, הם ידולגו ולא ייצרו פניות כפולות.

ברירת המחדל היא לבדוק עד 25 מיילים מה-14 ימים האחרונים בכל ריצה. אפשר לשנות זאת עם `EMAIL_INGEST_MAX_MESSAGES` ו-`EMAIL_INGEST_LOOKBACK_DAYS`.
