# תזכורות Cloudflare Workers + D1

השירות מוכן בקוד, אך אינו פרוס ואינו שולח תזכורות עד השלמת החיבור ובדיקה באייפון. שתי תזכורות כלליות בשעה מקומית לפי IANA, Cron כל 5 דקות. משקל והיסטוריית הרגלים אינם נשלחים לשרת. אין ביטול אוטומטי לפי השלמות בגרסה זו.

## בדיקות

```sh
cd /workspace/SilentWarrior/notifications
npm ci
npm test
WRANGLER_SEND_METRICS=false npm run test:runtime
```

Node 24 נדרש. בדיקת runtime מפעילה את Cloudflare workerd ו־D1 מקומית, עם הצפנה וחתימת VAPID אמיתיות, אך ספק ה־Push מוחלף בתחליף לבדיקה. הצלחתה אינה מסירה אמיתית למכשיר.

## הכנת החשבון

נדרשים CLOUDFLARE_ACCOUNT_ID וחיבור מורשה דרך CLOUDFLARE_API_TOKEN בהגדרות הסביבה המאובטחות, או wrangler login במחשב אישי. אין לשלוח מפתחות בצ׳אט. צור API Token מותאם, מוגבל לחשבון שלך: Account / Workers Scripts / Edit; Account / D1 / Edit; Account / Account Settings / Read. Workers subdomain פעיל נדרש. אם האתר מבקש אימות או בחירת תוכנית, יש להשלים באתר; אין הבטחה למסלול או למכסות לפני בדיקה בחשבון. Account ID מופיע בפרטי החשבון.

## פריסה

```sh
cd /workspace/SilentWarrior/notifications
npx wrangler d1 create silent-warrior-reminders
```

המסד silent-warrior-reminders כבר נוצר דרך האתר, ומזההו הוגדר ב־wrangler.jsonc. שם ה־Worker הוא silentwarrior כדי להתאים לפרויקט Workers Builds. אין ליצור מסד נוסף. לבדוק ש־APP_ORIGIN הוא מקור האתר המדויק ללא נתיב, וש־VAPID_SUBJECT הוא URL או mailto תקין. לאחר מכן:

```sh
npm run keys
npx wrangler d1 migrations apply silent-warrior-reminders --remote
npm run deploy
npx wrangler secret bulk .dev.vars
```

פקודת keys יוצרת בקובץ המקומי המוגן והמתעלם מ־Git, .dev.vars, מפתחות VAPID וקוד חיבור. היא אינה דורסת קובץ קיים. לשמור את הסודות באחסון מאובטח, לא להדפיס, לשתף בצ׳אט או להעלות ל־Git. secret bulk מעלה את ערכי הקובץ ל־Worker; עד השלמתו API מחזיר 503. מפתח VAPID הפרטי נשאר בשרת. שינוי מפתחות עלול לחייב רישום מכשירים מחדש. את קוד החיבור מזינים רק בממשק האפליקציה שלך; הוא אינו נשמר לאחר הרשמה.

## בדיקה באייפון

1. iOS 16.4 ומעלה: לפתוח ב־Safari, שיתוף ← הוסף למסך הבית, ולפתוח מהאייקון.
2. ב״ההרגלים שלי״ להזין את כתובת workers.dev, קוד חיבור, שעות ואזור זמן.
3. ללחוץ חיבור ולאשר התראות. לשרת נשלחים רק endpoint ומפתחות הרשמת Push, שעות ואזור זמן. token ניהול ייחודי נשמר בדפדפן; ה־hash שלו ב־D1.
4. לשלוח בדיקה ולוודא שהתראה מופיעה כשהאפליקציה סגורה ופותחת אותה.
5. לבדוק תזכורת מתוזמנת וכיבוי לפני הכרזה על מוכנות.

השירות שולח פעם אחת לסוג ותאריך מקומי, בחלון 10 דקות ממועד התזכורת. משלוח שנכשל ניתן לניסיון חוזר בחלון הבא. אין backfill אחרי הפסקה ארוכה, וזמן המסירה אינו מובטח. מגבלה: 20 מכשירים. קוד חיבור מגביל הרשמה; endpoints מוגבלים לספקי Apple/Google/Mozilla. בדיקה מוגבלת לפעם בדקה. כיבוי מוחק מ־D1 ומבטל הרשמה במכשיר. מחיקת נתוני הדפדפן לבדה אינה מוחקת הרשמה בשרת; אפשר להירשם שוב עם אותו קוד ואז לכבות. השירות מיועד לשימוש אישי, לא לשירות ציבורי רחב. קוד חיבור שנחשף צריך החלפה.

## חסמים שנותרו

החשבון טרם חובר לסביבת העבודה, אין מזהה D1 אמיתי או סודות Worker פרוסים, ולא בוצעה מסירה לאייפון. API הפריסה דורש api.cloudflare.com. בדיקת שרת פרוס דורשת גם גישה לכתובת workers.dev המדויקת. הגדרות הצפנה ותזמון מקומיות אינן מחליפות פריסה ובדיקת מכשיר.

בפריסה דרך GitHub: Root directory /notifications; Build command npm ci; Deploy command npx wrangler deploy. יש להחיל את migrations/0001_subscriptions.sql דרך D1 Console או באמצעות פקודת migrations לפני שימוש. פריסה רגילה אינה מחילה migrations אוטומטית.
