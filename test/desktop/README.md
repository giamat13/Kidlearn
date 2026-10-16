# Kidlearn Desktop

אפליקציה שרצה ברקע בשורת המשימות, ותוסף כרום שמחבר בין האתר לאפליקציה במחשב.
כל טאב חדש נפתח ב-Kidlearn.

## איך זה עובד

```
דף Kidlearn ──postMessage──► bridge-content.js ──► background.js ──► KidlearnHost.exe ──named pipe──► Kidlearn.exe
 (shared/kidlearn-bridge.js)  (התוסף, רק מדפי Kidlearn ומכתובת מקומית)  (התוסף)    (Chrome מפעיל לכל בקשה)    (אייקון במגש)
```

1. הדף שולח בקשה דרך `KidLearnBridge.request("ping")`.
2. הסקריפט של התוסף רץ בכל דף, ומעביר בקשות לרקע רק מדפי Kidlearn (`giamat13.github.io`) ומכתובות מקומיות (`localhost` / `127.0.0.1`).
3. הרקע מאשר רק פעולות מהרשימה, ורק אם השולח הוא דף Kidlearn או כתובת מקומית.
4. `KidlearnHost.exe` ש-Chrome מפעיל בודק שהקורא הוא התוסף הנכון, ומעביר את הבקשה לאפליקציה.
5. האפליקציה בודקת שוב שהפעולה מותרת, ומחזירה תשובה.

הפעולות שזמינות היום: `ping`, `microbitStatus` (האם המיקרוביט מחובר), ו-`installMicrobit` (שליחת תוכנית למיקרוביט, ראו למטה). פעולה חדשה דורשת שינוי בשני מקומות: מקרה ב-`BridgeActions` ב-[app/BridgeServer.cs](app/BridgeServer.cs), ושמה ב-`ALLOWED_ACTIONS` ב-[extension/background.js](extension/background.js).

## מבנה

| נתיב | תיאור |
|---|---|
| `app/` | אפליקציית המגש (C# / WinForms). בלי חלון, בלי טיימרים. כולל את שרת ה-named pipe |
| `host/` | `KidlearnHost.exe`: המארח ש-Chrome מפעיל לכל בקשה. מעביר את הבקשה לאפליקציה |
| `shared/` | קוד משותף לאפליקציה ולמארח: פורמט ההודעות והמזהה של התוסף |
| `extension/` | תוסף כרום (Manifest V3): טאב חדש, סקריפט לדפי Kidlearn, ומעבר הבקשות |
| `installer/` | סקריפט הבנייה (`build.ps1`), קובץ Inno Setup (`Kidlearn.iss`), וסקריפט האייקונים (`make-icons.ps1`) |
| `dist/` | פלט הבנייה: `KidlearnSetup.exe` (לא נכנס ל-git) |

בצד האתר: [shared/kidlearn-bridge.js](../shared/kidlearn-bridge.js) הוא ה-API שהדפים משתמשים בו. הוא נטען בדף הבית.

## מה ההתקנה עושה

- מתקינה ל-`%LOCALAPPDATA%\Programs\Kidlearn` בלי הרשאות מנהל.
- מוסיפה קיצור דרך בתפריט Start.
- רושמת הפעלה אוטומטית בכניסה למחשב. אפשר לבטל את זה בשלב בחירת האפשרויות.
- רושמת את המארח ב-Chrome עבור המשתמש הנוכחי (`HKCU\Software\Google\Chrome\NativeMessagingHosts\com.kidlearn.bridge`).
- אם .NET 10 Desktop Runtime לא מותקן, מתקינה אותו מהמתקין של מיקרוסופט שמצורף לקובץ (ידרוש אישור UAC).
- אם בחרתם את תוסף הכרום, נפתחים `chrome://extensions` ותיקיית התוסף, עם הוראות קצרות.

זיכרון (נמדד על המחשב הזה, במצב סרק): האפליקציה כ-43MB working set וכ-10MB private, וכמעט בלי CPU. בגרסה עצמאית (self-contained) נמדדו כ-107MB ו-46MB, ולכן בחרנו בגרסה שדורשת את ה-Runtime.

## הוספת התוסף לכרום (פעם אחת)

Chrome לא מאפשר להתקין תוסף שאינו מחנות Chrome בלי אישור ידני. אחרי ההתקנה:

1. ב-`chrome://extensions` מדליקים "Developer mode" (מצב מפתח).
2. לוחצים "Load unpacked" ובוחרים את `%LOCALAPPDATA%\Programs\Kidlearn\extension`.

**חשוב:** בגרסה 1.1.0 נוסף לתוסף מפתח קבוע (`key` ב-manifest), ולכן המזהה שלו השתנה. אם טענתם את התוסף לפני כן, הסירו אותו מ-`chrome://extensions` והוסיפו שוב.

אחרי שינוי בקבצי התוסף (רק למפתחים): לוחצים "Reload" על התוסף ב-`chrome://extensions`.

## שימוש מהאתר

```js
const status = await KidLearnBridge.request("ping");
// { ok: true, data: { app: "Kidlearn", version: "1.0.0", status: "running" } }

await KidLearnBridge.isInstalled(); // true כשהתוסף מותקן ומגיב בדף
```

**זיהוי חיבור בלי קריאה:** התוסף מזהה ברקע, בכל טעינה של דף Kidlearn, אם האפליקציה רצה, ושומר את התוצאה ב-`document.documentElement.dataset.kidlearnBridge`:

- `connected`: התוסף מותקן, והאפליקציה עונה.
- `extension-only`: התוסף מותקן, אבל האפליקציה לא עונה (סגורה או לא רצה).
- `checking`: הבדיקה עוד רצה.
- אין תכונה כלל: התוסף לא מותקן.

השגיאות האפשריות: `extension_missing` (התוסף לא מותקן), `app_not_running` (האפליקציה סגורה), `timeout`, `unknown_action`, `host_unavailable`. הפונקציה לא זורקת שגיאה, והתשובה תמיד אובייקט עם `ok`.

## תוכנית המיקרוביט

`installMicrobit` מקבל `payload.program = { scripts: [...] }`. האתר שולח רק שמות ערכים מרשימה קבועה, והאפליקציה כותבת מהם את הקוד לפי תבנית קבועה ב-[app/MicrobitProgramBuilder.cs](app/MicrobitProgramBuilder.cs). האתר לא שולח קוד, ואין דרך לשלוח קוד שרירותי.

- **תסריטים:** 1 עד 6 בתוכנית. כל תסריט מכיל `event` ורשימת `actions` של 1 עד 12 סמלים. כל תסריט רץ פעם אחת. בכל התוכנית יש עד 24 סמלים.
- **אירועים:** `start`, `buttonA`, `buttonB`, `shake`, `faceDown` (הופכים את הלוח), `abPress` (A ו-B יחד, מופעל ברגע הלחיצה), `tiltLeft` / `tiltRight` / `tiltForward` / `tiltBack` (הטיות; קדימה ואחורה נמסרות כ-`up` ו-`down`), `remote` עם `key` (לחצן בשלט Yahboom) ו-`logoTouch` (מגע בלוגו). `logoTouch` דורש micro:bit v2: בלוח v1 הוא פשוט לא מופעל.
- **תוספים:** סמלי הרכב (`drive`, `stop`) ואירועי השלט (`remote`) נכתבים לקוד רק כשהתוכנית משתמשת בהם. התוספים כבויים עד שמדליקים אותם בדף התוספים.
- **סמלים:** `show` (אייקון מהרשימה), `wait` (`0.5`, `1`, `2` או `3` שניות), `text` (`HI`, `GO`, `OK`, `YAY`, `NO`), `draw` (ציור של 25 תווים, `1` = נורה דלוקה), ו-`clear`.
- **בדיקה בלי לכתוב למיקרוביט:** תוכנית שלא עומדת בכללים נדחית עם סיבה (למשל `bad_scripts_count` או `repeat_only_with_start`), לפני שהאפליקציה מחפשת את הלוח.
- **שמירה:** מחוברים לחשבון, התוכניות נשמרות בענן (`users/{uid}/saves/microbit-programs`). בלי התחברות הן נשמרות במכשיר (`localStorage`: `kidlearn-microbit-programs`). את העבודה שעל המסך שומר `kidlearn-microbit-draft`. האפליקציה לא שומרת תוכניות.
- **ברירת מחדל:** המשחק כבוי עד שמדליקים אותו ב"כיבוי משחקים לפי משחק" (`"defaultOff": true` ב-`games.json`). ההגדרה נשמרת בחשבון, ואם אין חשבון, במכשיר.

## בנייה

דרישות, פעם אחת:

```
winget install Microsoft.DotNet.SDK.10
winget install JRSoftware.InnoSetup
```

הרצה מתיקיית הפרויקט:

```
powershell -ExecutionPolicy Bypass -File desktop\installer\build.ps1
```

התוצאה: `desktop\dist\KidlearnSetup.exe`.

אייקונים: `desktop\installer\make-icons.ps1` מייצר מחדש את `app\Assets\kidlearn.ico` ואת `extension\icons\`. צריך להריץ רק אם משנים את העיצוב.

## שינוי כתובת האתר

הכתובת מופיעה בכמה מקומות, וצריך לעדכן את כולם יחד:

- `extension/newtab.html` (גיבוי ל-meta refresh)
- `extension/newtab.js` (`KIDLEARN_URL`)
- `extension/manifest.json` (`content_scripts.matches`)
- `extension/background.js` (`KIDLEARN_ORIGIN`)
- `app/Program.cs` (`KidlearnUrl`)

## מה עוד לא נעשה

- **פעולות אמיתיות**, כמו פתיחת תוכנות לילדים. היום רק `ping` מורשה. לפני שמוסיפים פתיחה של תוכנה, צריך רשימה קבועה של תוכנות מותרות באפליקציה, כי אתר לא אמור להפעיל כל דבר שהוא מבקש.
- **חתימה דיגיטלית על ה-EXE.** בלי חתימה, Windows SmartScreen יציג אזהרה בהרצה הראשונה.
- **התקנה שקטה של התוסף.** הדרך לכך היא פרסום התוסף ב-Chrome Web Store כפרסום לא רשום (unlisted), והתקנה דרך מדיניות `ExtensionInstallForcelist`. זה דורש חשבון מפתח ואישור של Google.

## הערות

- רק תוסף אחד יכול להחליף את הטאב החדש. אם מותקן תוסף אחר שעושה את זה, Chrome יבחר אחד מהם.
- האייקון עשוי להיות מוסתר ב"הסמלים הנסתרים" של שורת המשימות. אפשר לגרור אותו החוצה כדי שיהיה תמיד גלוי.
- הסרה: "הוספה/הסרה של תוכניות" ב-Windows, ואחר כך מחיקת התוסף מ-`chrome://extensions`.
