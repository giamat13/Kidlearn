# Pro Learning - אתר לימוד אנגלית ועברית (גרסה מאוחדת)

## תיאור
אתר לימוד עם **2 אפליקציות ראשיות**:

### 📚 Pro English - Complete Learning Suite
אפליקציה אנגלית משולבת עם **3 מודולים פנימיים**:
1. **Fun Quiz** - חידון אינטראקטיבי עם זיהוי קולי
2. **Grammar Hero** - משחק דקדוק עם אתגרים מגוונים
3. **Vocabulary Builder** - בניית אוצר מילים עם תרגום אוטומטי

### 🔤 Hebrew Pronunciation
לימוד הברה נכונה בעברית - ס, ז, ש, צ

## מבנה הקבצים
```
pro-learning/
├── index.html              # דף הבית - 2 אפליקציות ראשיות
└── apps/
    ├── english.html       # Pro English (תפריט פנימי)
    │   ├── quiz.html      # Fun Quiz Module
    │   ├── grammar.html   # Grammar Hero Module
    │   └── vocab.html     # Vocabulary Builder Module
    └── hebrew.html        # Hebrew Pronunciation
```

## איך להשתמש

### פתיחה ישירה מהדפדפן
1. פתח את הקובץ `index.html` בדפדפן
2. בחר **Pro English** או **Hebrew Pronunciation**
3. ב-Pro English: בחר מודול (Quiz/Grammar/Vocabulary)
4. כפתור "← Back to Menu" לחזרה לתפריט המודולים
5. כפתור "🏠 Home" לחזרה לדף הבית הראשי

### העלאה לשרת
1. העלה את כל התיקייה `pro-learning` לשרת
2. גש ל-`index.html` דרך הדפדפן
3. כל האפליקציות יעבדו מושלם!

## תכונות Pro English

### 🎯 Fun Quiz Module
- ✅ 6 סוגי שאלות מגוונים
- ✅ זיהוי קולי (Speech Recognition)
- ✅ מערכת ניקוד ורצפים
- ✅ ספר מילים ושיחונים משולבים

### 🦸 Grammar Hero Module
- ✅ 4 מצבי משחק: Multiple Choice, Scramble, Error Hunt, Speech
- ✅ מערכת חיים ו-Timer
- ✅ מצב לילה/יום
- ✅ Auto-play אופציונלי

### 📚 Vocabulary Builder Module
- ✅ תרגום אוטומטי (MyMemory API)
- ✅ מעקב שליטה במילים (Mastery Tracking)
- ✅ 2 מצבי תרגול: אנגלית→עברית, עברית→אנגלית
- ✅ סטטיסטיקות מפורטות
- ✅ שמירה מקומית (LocalStorage)

## תכונות Hebrew Pronunciation

- ✅ 4 אותיות בעייתיות: ס, ז, ש, צ
- ✅ 6 רמות קושי לכל אות:
  - הברות (חימום קולי)
  - מילים - התחלה
  - מילים - סוף
  - צירופי מילים
  - מילים קשות
  - משפטים
- ✅ הקלטה והשמעה אישית
- ✅ מדריך מפורט להורים עם הנחיות פונטיות
- ✅ מערכת כוכבים וניקוד

## דרישות טכניות
- דפדפן מודרני (Chrome, Firefox, Safari, Edge)
- חיבור לאינטרנט (עבור CDNs)
- מיקרופון (אופציונלי - לזיהוי קולי והקלטה)

## תאימות
- ✅ Desktop / Laptop
- ✅ Tablet
- ✅ Mobile / Smartphone
- ✅ RTL Support (עברית)
- ✅ LTR Support (אנגלית)

## הערות חשובות

### Speech Recognition
- עובד רק ב-Chrome/Edge
- דורש הרשאת מיקרופון
- לא זמין במכשירים ניידים מסוימים

### Translation API (Vocabulary Builder)
- מוגבל ל-~5,000 תווים ביום (בחינם)
- משתמש ב-MyMemory Translation API
- מחזיר שגיאה במקרה של חריגה מהמכסה

### LocalStorage
- Vocabulary Builder שומר נתונים מקומית
- הנתונים לא יאבדו בסגירת הדפדפן
- שימוש ב-"Clear Data" במסך ההגדרות למחיקה

### Hebrew App - Microphone
- דורש הרשאה למיקרופון
- ההקלטה משתמשת ב-MediaRecorder API
- תומך ברוב הדפדפנים המודרניים

## מבנה הניווט

```
index.html (דף הבית)
    │
    ├─── Pro English (english.html)
    │       ├─── Fun Quiz (quiz.html)
    │       ├─── Grammar Hero (grammar.html)
    │       └─── Vocabulary Builder (vocab.html)
    │
    └─── Hebrew Pronunciation (hebrew.html)
```

## שיפורים בגרסה המאוחדת

✨ **ניווט משופר** - תפריט מודולים פנימי ב-Pro English
✨ **פחות לחיצות** - כל האפליקציות האנגלית תחת קורת גג אחת
✨ **עיצוב אחיד** - סגנון ויזואלי עקבי בכל המודולים
✨ **ביצועים טובים יותר** - שימוש ב-iframes לבידוד מודולים
✨ **קל יותר לניהול** - מבנה פשוט ומאורגן

## קרדיטים
- **Tailwind CSS** - Framework עיצוב
- **Google Fonts** - Heebo, Fredoka, Assistant
- **React 18** - Hebrew Pronunciation app
- **MyMemory API** - תרגום אוטומטי
- **Web Speech API** - זיהוי קולי

## רישיון
All rights reserved © 2024 Pro Learning

---

**נוצר על ידי Claude (Anthropic)**  
**גרסה:** 2.0 (מאוחדת)  
**תאריך:** 22/03/2026
