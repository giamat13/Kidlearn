// עיר לבנייה — תלת-ממד עם Three.js (הקובץ מקומי ב-vendor/, בלי רשת).
// כללים:
//   • דרך מתחברת אוטומטית לכל דרך שלידה (כביש, דרך עפר, שביל אבן).
//   • מבנה פעיל רק אם יש לידו דרך. מבנה בלי דרך לא עושה כלום (מסומן באדום).
//   • עצים וקישוטים קטנים תופסים רק חלק מחלקה: עד 7 מהם בחלקה אחת.
//   • עד 5 בתי ספר שנמצאים זה ליד זה מתאחדים לבית ספר גדול אחד.
//   • יש קטלוג: כל קטגוריה (בית, בית ספר, חנות...) מכילה סוגים, לכל סוג מחיר, מראה, תושבים והשפעה על הסביבה.
//   • ככל שיש יותר תושבים, התושבים דורשים מבנים מכל קטגוריה. כל דרישה שמתמלאת בפעם הראשונה מזכה בכסף.
//   • שני מדדים: שמירה על הסביבה (עצים, פארקים ופחים מעלים; כבישי אספלט ובנייה גדולה מורידים)
//     ושמחה (מושפעת מהדרישות, מהסביבה ומהבנייה). התושבים כותבים מה הם אוהבים בעיר.
//   • עוד מדדים: ביטחון, בריאות, חינוך, תעסוקה, פנאי ותנועה (לפי מבנים ביחס לתושבים). העיר משלמת מטבעות בזמן שהילד בעיר, לפי השמחה ושאר המדדים.
//   • העיר מתרחבת: קונים שטח חדש ליד השטח הקיים. מחיר השטח קבוע, והמצלמה לא מתרחקת ככל שהעיר גדלה.
//   • מסים אוטומטיים: כל מבנה מביא הכנסה קבועה, יש בונוס לשילובים (חנות ליד בתים...) ופי 1.5 כשכל המדדים גבוהים.
//     הכסף מצטבר גם כשהילד לא בעיר, עד 3 שעות, ומשולם לבד כשחוזרים (בלי כפתור).
//   • אטרקציות (גן חיות ולונה פארק): בלי הגבלת כמות. בכל אחת יש כניסה למשחק נפרד (zoo-game, amusement-game),
//     והמשחק שומר את ההכנסה שלה לפי החלקה. ההכנסה נכנסת למסים של העיר.
//   • דרגות עיר: לפי מספר התושבים (כפר, עיירה, עיר, עיר גדולה, מטרופולין). כל דרגה חדשה מזכה בפרס, פעם אחת.
//   • המודלים התלת-ממדיים ב-models.js וב-models-b.js. יש מצב לילה (תצוגה בלבד), עשן, ומבנה חדש קופץ מהקרקע.
// המחירים והפרסים נגזרים מ-REWARDS כדי להישאר בפרופורציה לשאר המשחקים.

const START_COLS = 5;      // השטח ההתחלתי: 5 על 4 חלקות
const START_ROWS = 4;
const STORE_KEY = 'kidlearn-city-v2';
const OLD_STORE_KEY = 'kidlearn-city';   // הגרסה הקודמת (רשת קבועה 5×4), לצורך מעבר חלק
const MERGE_MAX = 5;                     // מקסימום בתי ספר שמתאחדים לאחד
// מקום בחלקה: לכל חלקה יש PLOT_SPACE מקומות. כל דבר תופס מקום לפי הגודל שלו:
// קישוט קטן 1, קישוט רגיל 2, עץ 3, עץ גדול או מזרקה 4. מבנה קטן 10, בינוני 13, וכל השאר את כל החלקה.
// כך ליד בית קטן נשאר מקום לשני עצים, וליד חנות לעץ אחד או לכמה קישוטים
const PLOT_SPACE = 16;
const DECOR_KEEP = 24;                   // כמה עצים וקישוטים נשמרים לחלקה לכל היותר (גם משמירות ישנות)
const SPACE = {
    bin: 1, tap: 1, sign: 1, mailbox: 1, lamp: 1, cactus: 1,
    flowers: 2, bench: 2, umbrella: 2, statue: 2,
    tree: 3, palm: 3, blossom: 3, pine: 3, apple: 3, olive: 3,
    willow: 4, fountain: 4,
    cabin: 10, mini: 10, house: 10, cottage: 10,
    villa: 13, duplex: 13, studio: 13, shop: 13, bakery: 13, cafe: 13, toy: 13, bookstore: 13, post: 13,
    clinic: 13, dentist: 13, pharmacy: 13, vet: 13, tipat: 13, eye: 13,
};
// שדרוג מבנים: רמה 1 עד 3. כל רמה מגדילה תושבים, מסים ותיירים
const LEVEL_MAX = 3;
const LEVEL_MULT = [1, 1.5, 2];
const GOOD_LEVEL = 70;                   // מעל הערך הזה במדד מקבלים פרס (פעם אחת)
const TAX_CAP_MS = 3 * 60 * 60 * 1000;   // הכסף שנצבר כשהילד לא בעיר נעצר אחרי 3 שעות
const TAX_MIN_AWAY_MS = 30 * 1000;       // פחות מזה לא נחשב "לא הייתם בעיר"
const CITY_RATE_MAX = 9;                 // תקרה למטבעות בדקה: בערך 30% ממה שמשחקי הלימוד מכניסים
const TAX_KEY = 'kidlearn-city-tax';     // מתי הילד היה בעיר לאחרונה (במכשיר בלבד, מתעדכן כל כמה שניות)
// אטרקציות: לכל סוג יש משחק משלו ומפתח שמירה משלו (נתונים לפי חלקה). הם לא מופיעים ב-games.json
const ATTRACTIONS = {
    zoo:       { key: 'kidlearn-zoo',       page: '../zoo-game/index.html',       label: 'גן החיות' },
    amusement: { key: 'kidlearn-amusement', page: '../amusement-game/index.html', label: 'הלונה פארק' },
};
const TOURIST_RATE = 0.3;                // מטבעות בדקה מתיירים לכל אטרקציה פעילה, גם לפני שנכנסים אליה
// שער הכניסה לעיר: כביש שמגיע מבחוץ. תמיד קיים ואי אפשר להסיר אותו.
// הוא תמיד על החלקה המערבית ביותר בעיר. כשקונים שטח שהוא מערב לכל העיר, השער זז לשטח החדש (נשמר בשמירה)
let entranceC = 0;
let entranceR = 1;

const W = window.KidLearnWallet;
const R = W ? W.REWARDS : { answer: 2, smallSuccess: 1, round: 8, level: 10, perfect: 20, create: 5 };
// מחירי העיר הם מחירי הבסיס (בלי הנחה). הפרסים שהילד מקבל לא משתנים
const PRICE_FACTOR = 1;
const cheap = (p) => Math.max(1, Math.round(p * PRICE_FACTOR));

// --- קטגוריות ---
const CATS = [
    { id: 'road',   name: 'דרכים',           icon: '🛣️', color: '#607d8b' },
    { id: 'tree',   name: 'עצים וצמחייה',    icon: '🌳', color: '#43a047' },
    { id: 'house',  name: 'בתים',            icon: '🏠', color: '#ef6c00' },
    { id: 'apt',    name: 'דירות',           icon: '🏢', color: '#5c6bc0' },
    { id: 'school', name: 'חינוך',           icon: '🏫', color: '#fbc02d' },
    { id: 'shop',   name: 'חנויות',          icon: '🏪', color: '#ec407a' },
    { id: 'clinic', name: 'בריאות',          icon: '🏥', color: '#e53935' },
    { id: 'civic', name: 'שירותי עיר', icon: '🚓', color: '#3949ab' },
    { id: 'park',   name: 'פנאי ופארקים',    icon: '🏞️', color: '#26a69a' },
    { id: 'attr',   name: 'אטרקציות',        icon: '🎡', color: '#8e24aa' },
    { id: 'props', name: 'דברים קטנים',     icon: '⛲', color: '#8d6e63' },
];

// --- סוגים: לכל סוג מחיר, תיאור, ותושבים (אם הוא מגורים) ---
// eco: השפעה על הסביבה (חיובי = עוזר, שלילי = פוגע). love: מה התושבים אוהבים בסוג הזה
// size: גודל של עץ או קישוט (הם קטנים מחלקה, ולכן יש להם גודל משלהם)
// id של סוג הוא גם מזהה השמור ב-localStorage, לכן אל תשנו אותם
const VARIANTS = [
    { id: 'road',       cat: 'road',   name: 'כביש אספלט',  icon: '🛣️', price: cheap(R.create),        eco: -1,   love: 'הדרכים מחברות בין כל הבתים', desc: 'כביש רחב עם קווים לבנים' },
    { id: 'dirt',       cat: 'road',   name: 'דרך עפר',     icon: '🟫', price: cheap(R.answer),        eco: 0,    love: 'אנחנו אוהבים את דרך העפר הפשוטה שלנו', desc: 'דרך פשוטה וזולה' },
    { id: 'stone',      cat: 'road',   name: 'שביל אבן',    icon: '🪨', price: cheap(R.answer * 2),    eco: -0.2,   love: 'השביל המרוצף בחלוקי נחל נראה מדהים', desc: 'שביל מרוצף בחלוקי נחל' },

    { id: 'tree',       cat: 'tree',   name: 'עץ',          icon: '🌳', price: cheap(R.create),        eco: 0.5,  size: 0.5,  love: 'אנחנו אוהבים את העצים שנותנים צל', desc: 'עץ יפה שנותן צל' },
    { id: 'palm',       cat: 'tree',   name: 'דקל',         icon: '🌴', price: cheap(R.create),        eco: 0.5,  size: 0.55, love: 'הדקלים מזכירים לנו חופשה', desc: 'דקל גבוה לאזור חם' },
    { id: 'blossom',    cat: 'tree',   name: 'עץ פריחה',    icon: '🌸', price: cheap(R.level),         eco: 0.6,  size: 0.5,  love: 'עץ הפריחה הוורוד הוא היופי של האביב', desc: 'פורח בוורוד באביב' },

    { id: 'house',      cat: 'house',  name: 'בית',         icon: '🏠', price: cheap(R.level),         eco: 0,    pop: 2, love: 'הבית שלנו חם ונעים', desc: 'בית למשפחה קטנה' },
    { id: 'cabin',      cat: 'house',  name: 'בקתת עץ',     icon: '🛖', price: cheap(R.create),        eco: 0,    pop: 1, love: 'הבקתה הקטנה נראית כמו חלום', desc: 'בקתה קטנה לאדם אחד' },
    { id: 'villa',      cat: 'house',  name: 'וילה',        icon: '🏡', price: cheap(R.perfect),       eco: 0,    pop: 4, love: 'הווילה הגדולה מרשימה מאוד', desc: 'בית גדול למשפחה גדולה' },

    { id: 'apt',        cat: 'apt',    name: 'בניין דירות', icon: '🏢', price: cheap(R.perfect),       eco: -0.5, pop: 6,  love: 'בבניין הדירות יש הרבה שכנים טובים', desc: 'הרבה משפחות בבניין אחד' },
    { id: 'tower',      cat: 'apt',    name: 'מגדל דירות',  icon: '🏙️', price: cheap(R.round * 5),     eco: -1,   pop: 12, love: 'מהמגדל הגבוה יש נוף יפה לכולם', desc: 'מגדל גבוה לעיר גדולה' },

    { id: 'school',     cat: 'school', name: 'בית ספר יסודי', icon: '🏫', price: cheap(R.perfect),     eco: 1,    love: 'בית הספר עוזר לילדים ללמוד ולגדול', desc: 'לכיתות א׳ עד ו׳' },
    { id: 'kinder',     cat: 'school', name: 'גן ילדים',    icon: '🧸', price: cheap(R.level),         eco: 0.5,  love: 'הגן הקטן מלא בצחוק של ילדים', desc: 'לגיל הרך' },
    { id: 'highschool', cat: 'school', name: 'תיכון',       icon: '🎓', price: cheap(R.round * 5),     eco: 1,    love: 'התיכון מכין את הבוגרים של העיר', desc: 'לתלמידים בוגרים' },

    { id: 'shop',       cat: 'shop',   name: 'חנות',        icon: '🏪', price: cheap(R.level),         eco: -0.5, love: 'אנחנו אוהבים ללכת לחנות השכונתית', desc: 'חנות שכונתית' },
    { id: 'mini',       cat: 'shop',   name: 'מכולת',       icon: '🧺', price: cheap(R.create),        eco: 0,    love: 'המכולת הקטנה ליד הבית נוחה מאוד', desc: 'מכולת קטנה ליד הבית' },
    { id: 'mall',       cat: 'shop',   name: 'קניון',       icon: '🛍️', price: cheap(R.round * 5),     eco: -1.5, love: 'בקניון יש הרבה דברים לקנות', desc: 'הרבה חנויות במקום אחד' },

    { id: 'clinic',     cat: 'clinic', name: 'מרפאה',       icon: '🏥', price: cheap(R.perfect),       eco: 0,    love: 'טוב לדעת שיש מרפאה קרובה', desc: 'טיפול בסיסי לתושבים' },
    { id: 'hospital',   cat: 'clinic', name: 'בית חולים',   icon: '🏨', price: cheap(R.round * 5),     eco: -0.5, love: 'בית החולים שומר על כולנו', desc: 'טיפול מורכב ודחוף' },

    { id: 'police',    cat: 'civic',  name: 'תחנת משטרה',   icon: '🚓', price: cheap(R.perfect),       eco: 0,    love: 'בזכות המשטרה אנחנו מרגישים בטוחים', desc: 'שומרת על הסדר והביטחון בעיר' },
    { id: 'fire',      cat: 'civic',  name: 'תחנת כיבוי',   icon: '🚒', price: cheap(R.round * 5),     eco: 0,    love: 'הכבאים תמיד מוכנים לעזור', desc: 'כבאים שמכבים שריפות' },
    { id: 'ambulance', cat: 'civic',  name: 'תחנת אמבולנס', icon: '🚑', price: cheap(R.perfect),       eco: 0,    love: 'האמבולנס מגיע מהר כשצריך', desc: 'צוות חירום לכל מקרה' },
    { id: 'post',      cat: 'civic',  name: 'דואר',         icon: '📮', price: cheap(R.level),         eco: 0,    love: 'הדואר מביא לנו מכתבים מכל העולם', desc: 'שולחים ומקבלים מכתבים' },
    { id: 'library',   cat: 'civic',  name: 'ספרייה',       icon: '📚', price: cheap(R.round * 2),     eco: 0,    love: 'בספרייה יש המון ספרים לקרוא', desc: 'ספרים לכל הגילאים' },
    { id: 'university', cat: 'civic', name: 'אוניברסיטה', icon: '🎓', price: cheap(R.round * 5), eco: 0.5, love: 'באוניברסיטה לומדים דברים חדשים כל יום', desc: 'לימודים לבוגרים' },
    { id: 'court', cat: 'civic', name: 'בית משפט', icon: '⚖️', price: cheap(R.round * 5), eco: 0, love: 'בבית המשפט שומרים על הצדק בעיר', desc: 'שופטים שמחליטים בעניינים של העיר' },
    { id: 'prison', cat: 'civic', name: 'כלא', icon: '🔒', price: cheap(R.round * 3), eco: -0.3, love: 'בכלא שומרים על כולם בטוחים', desc: 'מקום שבו מי שעבר עבירה מרצה עונש' },
    { id: 'park',       cat: 'park',   name: 'פארק',        icon: '🏞️', price: cheap(R.level),         eco: 2,    love: 'הפארק הוא המקום שאנחנו הכי אוהבים', desc: 'מקום לטיולים ולשחק' },
    { id: 'garden',     cat: 'park',   name: 'גינה קטנה',   icon: '🌷', price: cheap(R.create),        eco: 1.5,  love: 'הגינה הקטנה מלאה פרחים וריח טוב', desc: 'פרחים וספסל' },
    { id: 'playground', cat: 'park',   name: 'גן שעשועים',  icon: '🛝', price: cheap(R.level),         eco: 1,    love: 'בגן השעשועים הילדים משחקים כל היום', desc: 'מגלשה ונדנדה' },

    { id: 'zoo',        cat: 'attr',   name: 'גן חיות',     icon: '🦁', price: cheap(R.round * 10),    eco: 0.5,  love: 'בגן החיות אפשר לראות חיות מכל העולם', desc: 'יש כניסה למשחק: קונים חיות ומרוויחים מכרטיסים' },
    { id: 'amusement', cat: 'attr',   name: 'לונה פארק',   icon: '🎡', price: cheap(R.round * 12),    eco: -1, love: 'בלונה פארק כיף לעלות על המתקנים', desc: 'יש כניסה למשחק: קונים מתקנים ומרוויחים מכרטיסים' },

    { id: 'bench',      cat: 'props', name: 'ספסל',        icon: '🪑', price: cheap(R.answer),        eco: 0,    size: 0.6,  love: 'כיף לשבת על הספסל ולנוח', desc: 'מקום לשבת ולנוח' },
    { id: 'fountain',   cat: 'props',  name: 'מזרקה',       icon: '⛲', price: cheap(R.create),        eco: 1,    size: 0.5,  love: 'המזרקה נעימה לשמוע', desc: 'מים שזורמים במרכז' },
    { id: 'tap',        cat: 'props',  name: 'ברזייה',      icon: '🚰', price: cheap(R.answer),        eco: 0.5,  size: 0.8,  love: 'הברזייה מאפשרת לשתות מים קרים', desc: 'ברז מים לשתייה' },
    { id: 'lamp',       cat: 'props',  name: 'פנס רחוב',    icon: '🪔', price: cheap(R.answer),        eco: 0,    size: 0.7,  love: 'פנסי הרחוב מאירים לנו בערב', desc: 'מאיר בערב' },
    { id: 'bin',        cat: 'props',  name: 'פח אשפה',     icon: '🗑️', price: cheap(R.smallSuccess),  eco: 1,    size: 0.8,  love: 'בזכות פחי האשפה העיר נקייה', desc: 'שומר על העיר נקייה' },
    { id: 'flowers',    cat: 'props',  name: 'ערוגת פרחים', icon: '💐', price: cheap(R.answer),        eco: 1,    size: 0.6,  love: 'ערוגת הפרחים מצבעת את העיר', desc: 'צבעים לעיר' },

    // --- מבנים נוספים (כל קטגוריה לפחות שתי שורות) ---
    { id: 'bike',       cat: 'road',   name: 'שביל אופניים', icon: '🚲', price: cheap(R.answer * 2),   eco: 0.8,  love: 'שביל האופניים הירוק בטוח ונעים', desc: 'שביל ירוק לרוכבי אופניים' },
    { id: 'brick',      cat: 'road',   name: 'מדרכת לבנים', icon: '🧱', price: cheap(R.answer * 2),    eco: -0.2,   love: 'מדרכת הלבנים האדומה יפה מאוד', desc: 'מרוצפת בלבנים אדומות' },
    { id: 'sand',       cat: 'road',   name: 'דרך חול',     icon: '🏜️', price: cheap(R.answer),        eco: 0,    love: 'דרך החול רכה ונעימה להליכה', desc: 'דרך זולה בצבע חול' },
    { id: 'plank',      cat: 'road',   name: 'שביל עץ',     icon: '🪵', price: cheap(R.answer * 2),    eco: 0.2,  love: 'שביל העץ מרגיש כמו בטבע', desc: 'קרשי עץ לצעידה' },
    { id: 'highway',    cat: 'road',   name: 'כביש מהיר',   icon: '🏎️', price: cheap(R.create * 2),    eco: -1.5, love: 'הכביש המהיר מגיע מהר לכל מקום', desc: 'כביש כהה עם פסים צהובים' },

    { id: 'pine',       cat: 'tree',   name: 'אורן',        icon: '🌲', price: cheap(R.create),        eco: 0.6,  size: 0.5,  love: 'האורנים ירוקים כל השנה', desc: 'עץ מחודד שנשאר ירוק' },
    { id: 'apple',      cat: 'tree',   name: 'עץ תפוחים',   icon: '🍎', price: cheap(R.level),         eco: 0.6,  size: 0.5,  love: 'מעץ התפוחים אפשר לקטוף פירות', desc: 'עץ עם תפוחים אדומים' },
    { id: 'olive',      cat: 'tree',   name: 'עץ זית',      icon: '🫒', price: cheap(R.level),         eco: 0.6,  size: 0.5,  love: 'עץ הזית הוא סמל של שלום', desc: 'עץ עתיק עם עלים כסופים' },
    { id: 'willow',     cat: 'tree',   name: 'ערבה בוכייה', icon: '🍃', price: cheap(R.level),         eco: 0.7,  size: 0.55, love: 'ענפי הערבה יורדים בעדינות עד המים', desc: 'ענפים ארוכים שנופלים למטה' },
    { id: 'cactus',     cat: 'tree',   name: 'קקטוס',       icon: '🌵', price: cheap(R.answer),        eco: 0.3,  size: 0.5,  love: 'הקקטוס חזק ולא צריך הרבה מים', desc: 'צמח מדבר עם קוצים' },

    { id: 'cottage',    cat: 'house',  name: 'קוטג׳',       icon: '🏘️', price: cheap(R.level + R.create), eco: 0, pop: 3, love: 'הקוטג׳ קטן, חמוד ומשפחתי', desc: 'בית קטן לשלושה' },
    { id: 'duplex',     cat: 'house',  name: 'בית דו-משפחתי', icon: '🏠', price: cheap(R.create * 5),  eco: 0,    pop: 4, love: 'בבית הדו-משפחתי יש שכנים נחמדים', desc: 'שתי דלתות, שתי משפחות' },
    { id: 'modern',     cat: 'house',  name: 'בית מודרני',  icon: '🏡', price: cheap(R.create * 6),    eco: 0,    pop: 5, love: 'הבית המודרני עם החלונות הגדולים מדהים', desc: 'גג שטוח וחלונות גדולים' },
    { id: 'farm',       cat: 'house',  name: 'חווה',        icon: '🚜', price: cheap(R.perfect + R.level), eco: 0.5, pop: 3, love: 'בחווה יש אוויר נקי ושקט', desc: 'אסם אדום וממגורה' },
    { id: 'mansion',    cat: 'house',  name: 'אחוזה',       icon: '🏰', price: cheap(R.round * 5),     eco: 0,    pop: 8, love: 'האחוזה הענקית היא גאווה של העיר', desc: 'בית ענק עם מגדלון' },

    { id: 'studio',     cat: 'apt',    name: 'בניין סטודיו', icon: '🏬', price: cheap(R.level + R.create), eco: -0.3, pop: 4, love: 'דירות הסטודיו קטנות ונוחות', desc: 'דירות קטנות לזוגות' },
    { id: 'senior',     cat: 'apt',    name: 'בית אבות',    icon: '👵', price: cheap(R.perfect + R.level), eco: 0.5, pop: 8, love: 'בבית האבות יש הרבה סבים וסבתות מחייכים', desc: 'בית נעים עם גינה לקשישים' },
    { id: 'terrace',    cat: 'apt',    name: 'בניין מדורג', icon: '🏗️', price: cheap(R.perfect + R.level), eco: -0.3, pop: 8, love: 'במרפסות של הבניין המדורג יש פרחים', desc: 'קומות שמצטמצמות כמו מדרגות' },
    { id: 'dorm',       cat: 'apt',    name: 'מעונות סטודנטים', icon: '🛏️', price: cheap(R.perfect + R.level + R.create), eco: -0.3, pop: 10, love: 'במעונות גרים סטודנטים שוקקי חיים', desc: 'חדרים לסטודנטים' },
    { id: 'twin',       cat: 'apt',    name: 'מגדלים תאומים', icon: '🌆', price: cheap(R.round * 9),   eco: -1.5, pop: 22, love: 'המגדלים התאומים נראים מכל מקום בעיר', desc: 'שני מגדלים גבוהים יחד' },
    { id: 'skyscraper', cat: 'apt',    name: 'גורד שחקים',  icon: '🌃', price: cheap(R.round * 12),    eco: -2,   pop: 30, love: 'מגורד השחקים רואים את כל העיר', desc: 'הבניין הכי גבוה בעיר' },

    { id: 'nursery',    cat: 'school', name: 'מעון יום',    icon: '👶', price: cheap(R.level + R.smallSuccess * 2), eco: 0.5, love: 'במעון היום תינוקות ישנים ומשחקים', desc: 'שמירה על הקטנים' },
    { id: 'music',      cat: 'school', name: 'בית ספר למוזיקה', icon: '🎻', price: cheap(R.perfect + R.level), eco: 0.5, love: 'מבית הספר למוזיקה נשמעים צלילים יפים', desc: 'לומדים נגינה ושירה' },
    { id: 'art',        cat: 'school', name: 'בית ספר לאמנות', icon: '🎨', price: cheap(R.perfect + R.level), eco: 0.5, love: 'ילדי האמנות מציירים את העיר בצבעים', desc: 'ציור, פיסול ויצירה' },
    { id: 'science',    cat: 'school', name: 'בית ספר למדעים', icon: '🔭', price: cheap(R.perfect + R.level + R.create), eco: 0.5, love: 'בבית הספר למדעים מגלים דברים חדשים', desc: 'ניסויים וטלסקופ' },
    { id: 'sports',     cat: 'school', name: 'בית ספר לספורט', icon: '🏅', price: cheap(R.perfect + R.level), eco: 0.5, love: 'בבית הספר לספורט כולם רצים וקופצים', desc: 'כדורגל, ריצה וכושר' },

    { id: 'bakery',     cat: 'shop',   name: 'מאפייה',      icon: '🥖', price: cheap(R.level + R.create), eco: -0.3, love: 'ריח הלחם הטרי מהמאפייה מרים את הלב', desc: 'לחם ועוגות טריים' },
    { id: 'cafe',       cat: 'shop',   name: 'בית קפה',     icon: '☕', price: cheap(R.level + R.create), eco: -0.3, love: 'בבית הקפה נעים לשבת עם חברים', desc: 'שולחנות בחוץ ומשקאות חמים' },
    { id: 'toy',        cat: 'shop',   name: 'חנות צעצועים', icon: '🎲', price: cheap(R.perfect),      eco: -0.3, love: 'בחנות הצעצועים הילדים לא רוצים ללכת הביתה', desc: 'בלונים, משחקים ובובות' },
    { id: 'bookstore',  cat: 'shop',   name: 'חנות ספרים',  icon: '📖', price: cheap(R.perfect),       eco: -0.2, love: 'בחנות הספרים יש סיפורים לכל הגילאים', desc: 'מדפים מלאי ספרים' },
    { id: 'supermarket', cat: 'shop',  name: 'סופרמרקט',    icon: '🛒', price: cheap(R.round * 4 + R.create), eco: -1, love: 'בסופרמרקט יש כל מה שצריך בשבוע', desc: 'חנות גדולה עם עגלות' },

    { id: 'dentist',    cat: 'clinic', name: 'מרפאת שיניים', icon: '🦷', price: cheap(R.perfect + R.smallSuccess * 2), eco: 0, love: 'רופא השיניים שומר על חיוך בריא', desc: 'שיניים נקיות וחזקות' },
    { id: 'pharmacy',   cat: 'clinic', name: 'בית מרקחת',   icon: '💊', price: cheap(R.perfect),       eco: 0,    love: 'בבית המרקחת תמיד מוצאים תרופה', desc: 'תרופות וויטמינים' },
    { id: 'vet',        cat: 'clinic', name: 'וטרינר',      icon: '🐾', price: cheap(R.perfect + R.smallSuccess * 2), eco: 0.3, love: 'הווטרינר מטפל בכלבים ובחתולים שלנו', desc: 'רופא לחיות המחמד' },
    { id: 'tipat',      cat: 'clinic', name: 'טיפת חלב',    icon: '🍼', price: cheap(R.perfect),       eco: 0,    love: 'בטיפת חלב שוקלים את התינוקות', desc: 'בדיקות לתינוקות' },
    { id: 'eye',        cat: 'clinic', name: 'מכון עיניים', icon: '👁️', price: cheap(R.perfect + R.level), eco: 0, love: 'במכון העיניים מקבלים משקפיים חדשים', desc: 'בדיקת ראייה ומשקפיים' },
    { id: 'lab',        cat: 'clinic', name: 'מעבדה רפואית', icon: '🧪', price: cheap(R.perfect + R.level + R.create), eco: -0.3, love: 'המעבדה עוזרת לרופאים להבין מה קרה', desc: 'בדיקות דם ובדיקות אחרות' },

    { id: 'townhall',   cat: 'civic',  name: 'עירייה',      icon: '🏛️', price: cheap(R.round * 5),     eco: 0,    love: 'בעירייה מנהלים את העיר שלנו', desc: 'כאן מחליטים על העיר' },
    { id: 'bank',       cat: 'civic',  name: 'בנק',         icon: '🏦', price: cheap(R.round * 4),     eco: 0,    love: 'בבנק שומרים בבטחה את הכסף', desc: 'מקום בטוח לכסף' },
    { id: 'station',    cat: 'civic',  name: 'תחנת רכבת',   icon: '🚉', price: cheap(R.round * 5),     eco: 1,    love: 'הרכבת לוקחת אותנו לכל מקום', desc: 'שעון, רציף ורכבת' },
    { id: 'recycle',    cat: 'civic',  name: 'מרכז מחזור',  icon: '♻️', price: cheap(R.perfect + R.level), eco: 3, love: 'המחזור שומר על כדור הארץ נקי', desc: 'פחים צבעוניים למחזור' },

    { id: 'lake',       cat: 'park',   name: 'אגם',         icon: '🦆', price: cheap(R.perfect),       eco: 2,    love: 'באגם שוחים ברווזים יפים', desc: 'מים כחולים וברווז' },
    { id: 'picnic',     cat: 'park',   name: 'פינת פיקניק', icon: '🍉', price: cheap(R.level),         eco: 1.5,  love: 'הפיקניק על הדשא הוא הכי כיף', desc: 'מפה משובצת וסל אוכל' },
    { id: 'soccer',     cat: 'park',   name: 'מגרש כדורגל', icon: '🥅', price: cheap(R.perfect),       eco: 0.8,  love: 'במגרש הכדורגל תמיד יש משחק', desc: 'דשא, קווים ושערים' },
    { id: 'basket',     cat: 'park',   name: 'מגרש כדורסל', icon: '🏀', price: cheap(R.level + R.create), eco: 0.5, love: 'במגרש הכדורסל קולעים סלים', desc: 'סל ורצפה אפורה' },
    { id: 'skate',      cat: 'park',   name: 'סקייטפארק',   icon: '🛹', price: cheap(R.perfect),       eco: 0.5,  love: 'בסקייטפארק קופצים על הרמפות', desc: 'רמפות ומעקה' },

    // אטרקציות בלי כניסה למשחק: הן מביאות תיירים לבד (tourist = מטבעות בדקה כשהן פעילות)
    { id: 'museum',     cat: 'attr',   name: 'מוזיאון',     icon: '🖼️', price: cheap(R.round * 6),     eco: 0.3,  tourist: 0.4, love: 'במוזיאון רואים ציורים ופסלים מכל העולם', desc: 'אין כניסה למשחק. מביא תיירים' },
    { id: 'aquarium',   cat: 'attr',   name: 'אקווריום',    icon: '🐠', price: cheap(R.round * 8),     eco: 0.3,  tourist: 0.5, love: 'באקווריום שוחים דגים צבעוניים', desc: 'אין כניסה למשחק. מביא תיירים' },
    { id: 'cinema',     cat: 'attr',   name: 'קולנוע',      icon: '🎬', price: cheap(R.round * 5),     eco: -0.3, tourist: 0.3, love: 'בקולנוע צופים בסרטים עם פופקורן', desc: 'אין כניסה למשחק. מביא תיירים' },
    { id: 'stadium',    cat: 'attr',   name: 'אצטדיון',     icon: '🏟️', price: cheap(R.round * 10),    eco: -1, tourist: 0.6, love: 'באצטדיון כולם מעודדים ביחד', desc: 'אין כניסה למשחק. מביא תיירים' },
    { id: 'lookout',    cat: 'attr',   name: 'מגדל תצפית',  icon: '🗼', price: cheap(R.round * 7),     eco: 0,    tourist: 0.4, love: 'ממגדל התצפית רואים את כל העיר', desc: 'אין כניסה למשחק. מביא תיירים' },
    { id: 'circus',     cat: 'attr',   name: 'קרקס',        icon: '🎪', price: cheap(R.round * 6),     eco: -0.3, tourist: 0.4, love: 'בקרקס יש ליצנים ואמנים מדהימים', desc: 'אין כניסה למשחק. מביא תיירים' },

    { id: 'mailbox',    cat: 'props',  name: 'תיבת דואר',   icon: '📪', price: cheap(R.answer),        eco: 0,    size: 0.8,  love: 'בתיבת הדואר שולחים מכתבים', desc: 'תיבה אדומה למכתבים' },
    { id: 'sign',       cat: 'props',  name: 'תמרור עצור',  icon: '🛑', price: cheap(R.answer),        eco: 0,    size: 0.8,  love: 'התמרורים עוזרים לנו לחצות בבטחה', desc: 'שלט אדום בצורת מתומן' },
    { id: 'umbrella',   cat: 'props',  name: 'שמשייה',      icon: '⛱️', price: cheap(R.answer),        eco: 0.2,  size: 0.7,  love: 'תחת השמשייה נעים בצל', desc: 'צל ליום חם' },
    { id: 'statue',     cat: 'props',  name: 'פסל',         icon: '🗿', price: cheap(R.create),        eco: 0.3,  size: 0.7,  love: 'הפסל הגדול הוא סמל של העיר', desc: 'פסל אבן על בסיס' },
];
const VARIANT_BY_ID = Object.fromEntries(VARIANTS.map(v => [v.id, v]));
const START_COUNT = START_COLS * START_ROWS;
const LAND_PRICE = cheap(R.round * 2);   // מחיר קבוע לכל שטח נוסף (לא עולה ככל שהעיר גדלה)

// מה התושבים דורשים, לפי מספר התושבים. כל דרישה היא קטגוריה שצריך מבנה פעיל ממנה
const DEMANDS = [
    { id: 'school', pop: 4,  icon: '🏫', text: 'בית ספר לילדים' },
    { id: 'shop',   pop: 8,  icon: '🏪', text: 'חנות קרובה לבית' },
    { id: 'clinic', pop: 12, icon: '🏥', text: 'מרפאה לחולים' },
    { id: 'park',   pop: 16, icon: '🏞️', text: 'פארק לטיולים' },
];

// מעל 20 תושבים התושבים ממשיכים לבקש: כל סוג דורש עוד מבנים ככל שהעיר גדלה
const LATE_POP = 20;
const LATE_DEMANDS = [
    { id: 'clinic', every: 10, icon: '🏥', text: 'עוד מרפאות לחולים' },
    { id: 'school', every: 12, icon: '🏫', text: 'עוד בתי ספר וגנים' },
    { id: 'shop',   every: 10, icon: '🏪', text: 'עוד חנויות קרובות לבית' },
    { id: 'park',   every: 14, icon: '🏞️', text: 'עוד פארקים וגנים' },
    { id: 'civic',  every: 10, icon: '🚓', text: 'עוד שירותי עיר: משטרה, כבאים, דואר' },
];
// רשימת הדרישות לפי מספר התושבים, וכמה מבנים מכל סוג צריך (need)
function demandsNow(pop) {
    if (pop < LATE_POP) return DEMANDS.map(d => ({ ...d, need: 1 }));
    const lateIds = new Set(LATE_DEMANDS.map(d => d.id));
    const list = DEMANDS.filter(d => !lateIds.has(d.id)).map(d => ({ ...d, need: 1 }));
    LATE_DEMANDS.forEach(d => list.push({ ...d, pop: LATE_POP, need: Math.max(1, Math.floor(pop / d.every) - 1), late: true }));
    return list;
}

// שכנים: צפון = -z, מזרח = +x, דרום = +z, מערב = -x
const DIRS = [
    { name: 'N', dc: 0,  dr: -1 },
    { name: 'E', dc: 1,  dr: 0 },
    { name: 'S', dc: 0,  dr: 1 },
    { name: 'W', dc: -1, dr: 0 },
];
// סיבוב (סביב ציר Y) שמפנה את החזית של המבנה (+z) לעבר כיוון הדרך
const FACE_ROT = { S: 0, E: Math.PI / 2, N: Math.PI, W: -Math.PI / 2 };


const GRASS = ['#7cc35a', '#86cc62', '#72b651'];
const HOUSE_WALLS = ['#ffe0b2', '#c8e6c9', '#bbdefb', '#f8bbd0', '#fff59d'];
const HOUSE_ROOFS = ['#c0392b', '#6d4c41', '#5d4037'];
const FOLIAGE = ['#2e7d32', '#388e3c', '#43a047'];
const BUSH = ['#558b2f', '#689f38'];

const $ = (id) => document.getElementById(id);
let selected = 'house';
let selectedCat = 'house';
// מצב מחיקה: כשהוא דולק, לחיצה על חלקה מוחקת את מה שיש בה (ולא בונה)
let deleteMode = false;
const HINT_BASE = $('hint').textContent;

// --- מצב העיר ---
// owned:     Set של מפתחות "c,r" של החלקות שבבעלות הילד
// buildings: Map של "c,r" -> מזהה מבנה גדול (בית, דרך, בית ספר, פארק...). חלקה אחת לכל מבנה
// decor:     Map של "c,r" -> רשימת מזהים של עצים וקישוטים (לפי סדר ההוספה). כמה נכנסים: לפי המקום שכל אחד תופס
// levels:    Map של "c,r" -> רמת המבנה (2 או 3). מבנה בלי רשומה הוא ברמה 1
// helped:    כמה פעמים הילד עזר לתושבים באירועים. festAt: מתי הייתה החגיגה האחרונה
// met:       דרישות התושבים והמדדים שכבר נענו (כל אחד מזכה בכסף פעם אחת)
let owned = new Set();
let buildings = new Map();
let decor = new Map();
let met = [];
let levels = new Map();
let helped = 0;
let festAt = 0;
let notes = [];   // פרסים שנענו עכשיו, מוצגים יחד עם ההודעה הבאה

// --- חישוב בתי ספר מאוחדים (מתעדכן בכל ציור) ---
let schoolGid = new Map();          // "c,r" -> מזהה קבוצה
let schoolAnchors = new Set();      // חלקה אחת לכל קבוצה, שעליה מציירים את הדגל
let schoolActiveGids = new Set();   // קבוצות שיש להן דרך

// --- עזרים לנתונים ---
function key(c, r) { return c + ',' + r; }
function parseKey(k) { const [c, r] = k.split(',').map(Number); return { c, r }; }
function clamp(x) { return Math.max(0, Math.min(100, Math.round(x))); }
function isOwned(c, r) { return owned.has(key(c, r)); }
function buildingAt(c, r) { return buildings.get(key(c, r)) || null; }
function variantAt(c, r) { return VARIANT_BY_ID[buildingAt(c, r)] || null; }
function catAt(c, r) { const v = variantAt(c, r); return v ? v.cat : null; }
function roadAt(c, r) { return catAt(c, r) === 'road'; }
function decorAt(c, r) { return decor.get(key(c, r)) || []; }
function isDecorVariant(v) { return !!v && (v.cat === 'tree' || v.cat === 'props'); }
function balance() { return W ? W.balance() : 0; }

// --- מקום בחלקה ורמות ---
function spaceOf(id) {
    if (SPACE[id]) return SPACE[id];
    const v = VARIANT_BY_ID[id];
    if (!v) return 0;
    return v.cat === 'tree' ? 3 : v.cat === 'props' ? 2 : PLOT_SPACE;
}
function decorSpace(c, r) { return decorAt(c, r).reduce((n, id) => n + spaceOf(id), 0); }
function spaceUsed(c, r) { return (buildingAt(c, r) ? spaceOf(buildingAt(c, r)) : 0) + decorSpace(c, r); }
function spaceFree(c, r) { return Math.max(0, PLOT_SPACE - spaceUsed(c, r)); }
function canAddDecor(c, r, v) {
    return isOwned(c, r) && isDecorVariant(v) && !isEntrance(c, r) && spaceOf(v.id) <= spaceFree(c, r);
}
function canBuildAt(c, r, v) {
    return isOwned(c, r) && !!v && !isDecorVariant(v) && !buildingAt(c, r) && spaceOf(v.id) + decorSpace(c, r) <= PLOT_SPACE;
}
// כמה מהאמצע של החלקה המבנה תופס (חצי רוחב). העצים והקישוטים מסתדרים מסביבו
function plotBlock(v) {
    if (!v) return 0;
    const sp = spaceOf(v.id);
    return sp <= 10 ? 0.27 : sp <= 13 ? 0.33 : 0.45;
}
function levelAt(c, r) { return buildingAt(c, r) ? (levels.get(key(c, r)) || 1) : 1; }
function levelMult(c, r) { return LEVEL_MULT[levelAt(c, r) - 1] || 1; }
function canUpgradeAt(c, r) {
    const v = variantAt(c, r);
    if (!v || ['road', 'school', 'park'].includes(v.cat) || ATTRACTIONS[v.id]) return null;
    const lv = levelAt(c, r);
    if (lv >= LEVEL_MAX) return null;
    return { level: lv + 1, cost: v.price * lv };
}
// כמה הושקע במבנה (מחיר ושדרוגים). בהסרה מחזירים חצי
function investedAt(c, r) {
    const v = variantAt(c, r);
    if (!v) return 0;
    const lv = levelAt(c, r);
    return v.price * (1 + (lv >= 2 ? 1 : 0) + (lv >= 3 ? 2 : 0));
}
function feedback(msg) {
    const extra = notes.splice(0).map(n => ` 🎉 ${n}`).join('');
    $('feedback').textContent = msg + extra;
}
function isEntrance(c, r) { return c === entranceC && r === entranceR; }

// חלקה שעוד לא נקנתה, אבל נוגעת בשטח שבבעלות הילד
function isSale(c, r) {
    if (isOwned(c, r)) return false;
    return DIRS.some(d => isOwned(c + d.dc, r + d.dr));
}

function bounds() {
    let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity;
    for (const k of owned) {
        const { c, r } = parseKey(k);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
    }
    return { minC, maxC, minR, maxR };
}

function startingPlots() {
    const s = new Set();
    for (let r = 0; r < START_ROWS; r++) {
        for (let c = 0; c < START_COLS; c++) s.add(key(c, r));
    }
    return s;
}

// מחלקת מבנים לשתי הקבוצות: מבנה גדול, או עץ/קישוט (שנכנסים לרשימה של החלקה)
function assignBuildings(entries) {
    buildings = new Map();
    decor = new Map();
    for (const [k, id] of entries) {
        const v = VARIANT_BY_ID[id];
        if (!v) continue;   // מבנה שסוגו כבר לא קיים מוסרים בשקט
        if (isDecorVariant(v)) decor.set(k, [...(decor.get(k) || []), id].slice(0, DECOR_KEEP));
        else buildings.set(k, id);
    }
}

function loadStateRaw() {
    entranceC = 0;
    entranceR = 1;
    levels = new Map();
    helped = 0;
    festAt = 0;
    try {
        const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
        if (saved && Array.isArray(saved.owned)) {
            owned = new Set(saved.owned);
            entranceC = Number.isInteger(saved.entranceC) ? saved.entranceC : 0;
            entranceR = Number.isInteger(saved.entranceR) ? saved.entranceR : 1;
            assignBuildings(Object.entries(saved.buildings || {}));
            // עצים וקישוטים בשמירה החדשה: רשימה לכל חלקה
            if (saved.decor && typeof saved.decor === 'object') {
                for (const [k, ids] of Object.entries(saved.decor)) {
                    const list = (Array.isArray(ids) ? ids : [])
                        .filter(id => isDecorVariant(VARIANT_BY_ID[id]))
                        .slice(0, DECOR_KEEP);
                    if (list.length) decor.set(k, list);
                }
            }
            met = Array.isArray(saved.met) ? saved.met : [];
            // שדות חדשים: בשמירה ישנה הם חסרים, ואז כל המבנים ברמה 1
            if (saved.lv && typeof saved.lv === 'object') {
                for (const [k, n] of Object.entries(saved.lv)) {
                    if (buildings.has(k) && (n === 2 || n === 3)) levels.set(k, n);
                }
            }
            helped = Math.max(0, Math.floor(+saved.helped || 0));
            festAt = Math.max(0, +saved.festAt || 0);
            taxAt = Math.max(taxAt, +saved.lastTaxAt || 0, readTaxTouch());
            return;
        }
    } catch (e) { /* אין אחסון — מתחילים מחדש */ }

    // מעבר מהגרסה הקודמת: אותו שטח 5×4 ואותם מבנים
    owned = startingPlots();
    met = [];
    assignBuildings([]);
    try {
        const old = JSON.parse(localStorage.getItem(OLD_STORE_KEY) || 'null');
        if (Array.isArray(old) && old.length === START_COUNT) {
            const entries = [];
            old.forEach((id, i) => {
                if (id) entries.push([key(i % START_COLS, Math.floor(i / START_COLS)), id]);
            });
            assignBuildings(entries);
        }
    } catch (e) {}
}

function loadState() {
    loadStateRaw();
    // כביש הכניסה תמיד קיים (גם בשמירות ישנות). בחלקה שלו לא יכולים להיות קישוטים
    const k = key(entranceC, entranceR);
    decor.delete(k);
    if (!buildings.has(k) && owned.has(k)) buildings.set(k, 'road');
}

function saveState() {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify({
            owned: [...owned],
            buildings: Object.fromEntries(buildings),
            decor: Object.fromEntries(decor),
            met,
            lv: Object.fromEntries(levels),
            helped,
            festAt,
            entranceC,
            entranceR,
            lastTaxAt: taxAt,
            savedAt: Date.now(),
        }));
    } catch (e) {}
    cloudPush();
}

// --- שמירה בחשבון (Firebase): הנתונים נשמרים ב-users/{uid}/saves/ ---
function signedIn() {
    return !!(window.KidLearn && KidLearn.currentUser && KidLearn.currentUser());
}

function cloudPush() {
    if (!signedIn()) return;
    KidLearn.pushLocalStorageKey(STORE_KEY).catch(() => {});
}

// בהתחברות: הגרסה החדשה יותר (בענן או במכשיר) נשארת, והשנייה מתעדכנת
async function cloudSync() {
    if (!signedIn()) return;
    try {
        const cloud = await KidLearn.loadData(STORE_KEY);
        const remote = cloud && typeof cloud.raw === 'string' ? JSON.parse(cloud.raw) : null;
        const local = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
        if (remote && (!local || (remote.savedAt || 0) > (local.savedAt || 0))) {
            localStorage.setItem(STORE_KEY, cloud.raw);
            loadState();
            redrawAll();
        } else {
            cloudPush();
        }
        await syncAttractionKeys();
        renderAll();
    } catch (e) { /* אין רשת: נמשיך לשמור במכשיר */ }
}

// נתוני האטרקציות (גן חיות ולונה פארק) נשמרים בחשבון באותה דרך: הגרסה החדשה יותר מנצחת
async function syncAttractionKeys() {
    for (const id of Object.keys(ATTRACTIONS)) {
        const key = ATTRACTIONS[id].key;
        try {
            const cloud = await KidLearn.loadData(key);
            const remote = cloud && typeof cloud.raw === 'string' ? JSON.parse(cloud.raw) : null;
            const local = JSON.parse(localStorage.getItem(key) || 'null');
            if (remote && (!local || (remote.savedAt || 0) > (local.savedAt || 0))) localStorage.setItem(key, cloud.raw);
            else if (local) KidLearn.pushLocalStorageKey(key).catch(() => {});
        } catch (e) { /* ללא רשת: ממשיכים עם מה שיש במכשיר */ }
    }
}

function redrawAll() {
    if (scene) {
        drawAll();
        fitCamera();
    }
    renderAll();
}

// --- כללים: פעילות, בתי ספר מאוחדים, תושבים ---
function roadNextTo(c, r) {
    return DIRS.some(d => roadAt(c + d.dc, r + d.dr));
}

// בתי ספר סמוכים מתאחדים לקבוצה אחת (עד MERGE_MAX). קבוצה פעילה אם לאחד מחבריה יש דרך
function refreshSchoolGroups() {
    schoolGid = new Map();
    schoolAnchors = new Set();
    schoolActiveGids = new Set();

    const list = [];
    for (const [k] of buildings) {
        const { c, r } = parseKey(k);
        if (catAt(c, r) === 'school') list.push({ c, r });
    }
    list.sort((a, b) => a.r - b.r || a.c - b.c);

    let next = 0;
    for (const s of list) {
        const k = key(s.c, s.r);
        if (schoolGid.has(k)) continue;
        const id = next++;
        schoolAnchors.add(k);

        // מאחדים בתי ספר סמוכים (BFS), עד MERGE_MAX
        const members = [k];
        const seen = new Set([k]);
        const queue = [s];
        while (queue.length && members.length < MERGE_MAX) {
            const cur = queue.shift();
            for (const d of DIRS) {
                if (members.length >= MERGE_MAX) break;
                const nc = cur.c + d.dc, nr = cur.r + d.dr, nk = key(nc, nr);
                if (seen.has(nk) || schoolGid.has(nk) || catAt(nc, nr) !== 'school') continue;
                seen.add(nk);
                members.push(nk);
                queue.push({ c: nc, r: nr });
            }
        }
        members.forEach(m => {
            schoolGid.set(m, id);
            const p = parseKey(m);
            if (roadNextTo(p.c, p.r)) schoolActiveGids.add(id);
        });
    }
}

// מבנה גדול פעיל = יש לידו דרך. דרך תמיד פעילה
function buildingActive(c, r) {
    const cat = catAt(c, r);
    if (cat === 'school') return schoolActiveGids.has(schoolGid.get(key(c, r)));
    if (cat === 'road') return true;
    if (cat === 'park') return parkActive(c, r);
    if (cat === 'civic' && variantAt(c, r).id === 'library') return roadNextTo(c, r) || schoolActiveNextTo(c, r);
    return roadNextTo(c, r);
}

// ספרייה שנוגעת בבית ספר פעיל מתחברת אליו, ולא צריכה כביש משלה
function schoolActiveNextTo(c, r) {
    return DIRS.some(d => catAt(c + d.dc, r + d.dr) === 'school' && buildingActive(c + d.dc, r + d.dr));
}

// פארקים שנוגעים זה בזה (גם מסוגים שונים) הם פארק אחד גדול. מספיק שדרך תגיע לאחד מהם, והם כולם פעילים
function parkActive(c, r) {
    const seen = new Set([key(c, r)]);
    const queue = [{ c, r }];
    while (queue.length) {
        const cur = queue.pop();
        if (roadNextTo(cur.c, cur.r)) return true;
        DIRS.forEach(d => {
            const nc = cur.c + d.dc;
            const nr = cur.r + d.dr;
            const nk = key(nc, nr);
            if (seen.has(nk) || catAt(nc, nr) !== 'park') return;
            seen.add(nk);
            queue.push({ c: nc, r: nr });
        });
    }
    return false;
}

// סטטיסטיקה של העיר: כמה תושבים, כמה מבנים פעילים מכל קטגוריה, וכמה מחכים לדרך
function stats() {
    refreshSchoolGroups();
    let pop = 0;
    let inactive = 0;
    let roads = 0;
    const active = {};
    const byId = {};   // כמה מבנים פעילים מכל סוג (לפי מזהה), לחישוב המדדים
    for (const [k, id] of buildings) {
        const v = VARIANT_BY_ID[id];
        if (!v) continue;
        if (v.cat === 'road') { roads++; continue; }
        if (v.cat === 'school') continue;
        const { c, r } = parseKey(k);
        if (!buildingActive(c, r)) { inactive++; continue; }
        // מבנה משודרג: יותר תושבים, והוא נספר כמספר הרמות שלו (משרת יותר תושבים)
        const lv = levelAt(c, r);
        pop += Math.round((v.pop || 0) * LEVEL_MULT[lv - 1]);
        active[v.cat] = (active[v.cat] || 0) + lv;
        byId[v.id] = (byId[v.id] || 0) + lv;
    }
    for (const list of decor.values()) list.forEach(id => { byId[id] = (byId[id] || 0) + 1; });
    // בתי ספר נספרים לפי קבוצה מאוחדת
    const groupCount = new Set(schoolGid.values()).size;
    active.school = schoolActiveGids.size;
    inactive += groupCount - schoolActiveGids.size;
    return { pop, active, inactive, byId, roads };
}

// --- מדדים: סביבה ושמחה ---
// הסביבה: סכום ההשפעות של כל המבנים והעצים, חלקי גודל העיר. החלקה של הכניסה לא נספרת
function envScore() {
    const entranceKey = key(entranceC, entranceR);
    let sum = 0;
    for (const [k, id] of buildings) {
        const v = VARIANT_BY_ID[id];
        if (k !== entranceKey && v) sum += v.eco || 0;
    }
    for (const list of decor.values()) {
        for (const id of list) {
            const v = VARIANT_BY_ID[id];
            if (v) sum += v.eco || 0;
        }
    }
    // חלקי גודל העיר: עיר גדולה צריכה יותר ירק כדי להיות ירוקה באותה מידה
    return clamp(50 + 150 * sum / Math.max(1, owned.size));
}

// במדדים מספר שלא מסתיים ב-0 מוצג בלי ספרת האחדות: 67 מופיע כ-6*. מספרים עגולים (60, 100) נשארים כמו שהם
function maskValue(value) {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    return v % 10 === 0 ? String(v) : Math.floor(v / 10) + '*';
}

// כמה הסוג שומר על הסביבה (או פוגע בה): 1 קלה, 2 בינונית, 3 חזקה. 0 = לא משפיע
function ecoLevel(v) {
    const a = Math.abs(v.eco || 0);
    return a >= 1.5 ? 3 : a >= 0.7 ? 2 : a > 0 ? 1 : 0;
}
function ecoBadge(v) {
    const lvl = ecoLevel(v);
    if (!lvl) return '';
    if (v.eco > 0) {
        const t = ['עוזר קצת לסביבה', 'עוזר לסביבה', 'עוזר מאוד לסביבה'][lvl - 1];
        return `<span class="eco good">${'🌿'.repeat(lvl)} ${t}</span>`;
    }
    const t = ['פוגע קצת בסביבה', 'פוגע בסביבה', 'פוגע מאוד בסביבה'][lvl - 1];
    return `<span class="eco bad">${'🏭'.repeat(lvl)} ${t}</span>`;
}

// מה התושבים אוהבים: כל סוג שיש בעיר ויש לו משפט אהבה
function lovedKinds() {
    const present = new Set([...buildings.values(), ...[...decor.values()].flat()]);
    return VARIANTS.filter(v => v.love && present.has(v.id));
}

// השמחה: בסיס, דרישות שנענו (+) ושלא נענו (−), הסביבה, מגוון מה שאוהבים, ומבנים שמחכים לדרך (−)
function happyScore(st, env, lovedCount) {
    if (st.pop <= 0) return 0;
    let h = 20;
    demandsNow(st.pop).forEach(d => {
        if (st.pop >= d.pop) h += (st.active[d.id] || 0) >= d.need ? 6 : -6;
    });
    h += env * 0.3;
    h += Math.min(16, lovedCount * 2);
    h -= Math.min(16, st.inactive * 4);
    return clamp(h);
}

// חלקה של מבנים: כמה מבנים צריך לפי התושבים (מבנה אחד לכל perResidents תושבים). מחזיר בין 0 ל-1
function coverage(count, pop, perResidents) {
    if (pop <= 0) return 0;
    return Math.min(1, count / Math.max(1, pop / perResidents));
}

// מדדים נוספים (0-100): ביטחון, בריאות, חינוך, תעסוקה, פנאי ותנועה. נמדדים לפי מבנים פעילים ביחס לתושבים
function extraMeters(st, env) {
    const b = st.byId;
    const pop = st.pop;
    if (pop <= 0) return { safety: 0, health: 0, education: 0, jobs: 0, leisure: 0, traffic: 0 };
    const law = (b.police || 0) + (b.court || 0) + (b.prison || 0);
    const edu = (st.active.school || 0) + (b.library || 0) + (b.university || 0);
    // גן חיות ולונה פארק שווים לשני פארקים בפנאי
    const leisure = (st.active.park || 0) + 2 * (st.active.attr || 0) + (b.bench || 0) + (b.fountain || 0) + (b.flowers || 0);
    return {
        safety: clamp(100 * coverage(law, pop, 10)),
        health: clamp(75 * coverage(st.active.clinic || 0, pop, 8) + 25 * env / 100),
        education: clamp(100 * coverage(edu, pop, 6)),
        jobs: clamp(100 * coverage(st.active.shop || 0, pop, 8)),
        leisure: clamp(100 * coverage(leisure, pop, 6)),
        // פקקים: הרבה תושבים על מעט דרכים
        traffic: clamp(100 - Math.max(0, pop / Math.max(1, st.roads) - 4) * 10),
    };
}

function cityMeters() {
    const st = stats();
    const env = envScore();
    const loved = lovedKinds();
    return { st, env, loved, happy: happyScore(st, env, loved.length), extra: extraMeters(st, env) };
}

// הכנסה לפי מצב רוח: עד 2 לפי השמחה, ועד 1 לפי הממוצע של שאר המדדים
function cityBaseRate(m) {
    if (m.st.pop <= 0) return 0;
    const others = [m.env, ...Object.values(m.extra)];
    const avg = others.reduce((a, b) => a + b, 0) / others.length;
    return 2 * m.happy / 100 + avg / 100;
}

// מס קבוע לכל מבנה פעיל (מטבעות בדקה): מגורים וחנויות משלמים, שירותי עיר לא
const BUILDING_TAX = {
    cabin: 0.05, house: 0.1, villa: 0.2, apt: 0.3, tower: 0.6, mini: 0.1, shop: 0.2, mall: 0.6,
    cottage: 0.15, duplex: 0.25, modern: 0.3, farm: 0.15, mansion: 0.4,
    studio: 0.2, senior: 0.3, terrace: 0.45, dorm: 0.5, twin: 1.0, skyscraper: 1.4,
    bakery: 0.15, cafe: 0.2, toy: 0.2, bookstore: 0.2, supermarket: 0.45,
};
const COMBO_BONUS = 0.15;   // לכל חנות, בית ספר, פארק או מרפאה פעילים שיש לידם מגורים פעילים
const HOME_CATS = ['house', 'apt'];
const COMBO_CATS = ['shop', 'school', 'park', 'clinic'];
const ALL_GOOD_MULT = 1.5;  // כשכל המדדים (סביבה, שמחה ו-6 הנוספים) הם לפחות GOOD_LEVEL

// שילובים: מבנה שירות פעיל שנוגע (גם באלכסון) במגורים פעילים. כל מבנה נספר פעם אחת
function comboCount() {
    let n = 0;
    for (const [k, id] of buildings) {
        const v = VARIANT_BY_ID[id];
        if (!v || !COMBO_CATS.includes(v.cat)) continue;
        const { c, r } = parseKey(k);
        if (!buildingActive(c, r)) continue;
        let near = false;
        for (let dc = -1; dc <= 1 && !near; dc++) {
            for (let dr = -1; dr <= 1 && !near; dr++) {
                if ((dc || dr) && HOME_CATS.includes(catAt(c + dc, r + dr)) && buildingActive(c + dc, r + dr)) near = true;
            }
        }
        if (near) n++;
    }
    return n;
}

// הכנסה של אטרקציה אחת מהמשחק שלה (נשמרת לפי חלקה). בלי כניסה אליה עדיין מקבלים רק את התיירים
function attractionData(k, id) {
    const a = ATTRACTIONS[id];
    try {
        const all = JSON.parse(localStorage.getItem(a.key) || 'null');
        const cell = all && all.cells && all.cells[k];
        if (cell && typeof cell === 'object') return cell;
    } catch (e) {}
    return null;
}
function attractionRate(k, id) {
    const d = attractionData(k, id);
    const stored = d ? Math.max(0, Math.min(5, +d.rate || 0)) : 0;
    return Math.max(TOURIST_RATE, stored);
}

// כל ההכנסה של העיר, מפורטת: בסיס, מסי מבנים, שילובים, פי 1.5 על הכל ואטרקציות, ותקרה כוללת
function cityIncome(m) {
    const out = { base: 0, tax: 0, combo: 0, mult: 1, attr: 0, total: 0 };
    if (m.st.pop <= 0) return out;
    out.base = cityBaseRate(m);
    for (const [k, id] of buildings) {
        const { c, r } = parseKey(k);
        if (!VARIANT_BY_ID[id] || !buildingActive(c, r)) continue;
        const mult = levelMult(c, r);
        if (BUILDING_TAX[id]) out.tax += BUILDING_TAX[id] * mult;
        if (ATTRACTIONS[id]) out.attr += attractionRate(k, id);
        else if (VARIANT_BY_ID[id].tourist) out.attr += VARIANT_BY_ID[id].tourist * mult;   // אטרקציה בלי כניסה: תיירים בלבד
    }
    out.combo = comboCount() * COMBO_BONUS;
    const all = [m.env, m.happy, ...Object.values(m.extra)];
    if (all.every(x => x >= GOOD_LEVEL)) out.mult = ALL_GOOD_MULT;
    out.total = Math.min(CITY_RATE_MAX, (out.base + out.tax + out.combo) * out.mult + out.attr);
    return out;
}

// כמה מטבעות לדקה העיר מביאה
function cityCoinsPerMinute(m) { return cityIncome(m).total; }

// התשלום: שברי מטבע נצברים, ומשולמים כשיש מטבע שלם. נשמר בזיכרון בלבד (לא בשמירה)
let cityRate = 0;     // מטבעות לדקה, מתעדכן בכל ציור של התפריט
let cityTaxAcc = 0;
let taxAt = 0;        // מתי העיר שילמה בפעם האחרונה (או שהילד היה בה). נשמר, כדי לחשב כסף שנצבר בהיעדרו
let taxTouchClock = 0;

function readTaxTouch() {
    try { return +JSON.parse(localStorage.getItem(TAX_KEY) || '{}').at || 0; } catch (e) { return 0; }
}
// "הילד בעיר עכשיו": מעדכנים כל כמה שניות ובעזיבת הדף, בלי לשמור את כל העיר ובלי רשת
function touchTax() {
    taxAt = Date.now();
    try { localStorage.setItem(TAX_KEY, JSON.stringify({ at: taxAt })); } catch (e) {}
}

// כסף שנצבר כשהילד לא היה בעיר (דף סגור, בתוך משחק האטרקציה או לשונית מוסתרת): עד 3 שעות, משולם אוטומטית.
// מחזיר כמה מטבעות שולמו
function payOffline(now) {
    now = now || Date.now();
    const last = taxAt;
    touchTax();
    if (!last || !W || cityRate <= 0) return 0;
    const away = now - last;
    if (away < TAX_MIN_AWAY_MS) return 0;
    const ms = Math.min(TAX_CAP_MS, away);
    const coins = Math.floor(cityRate * ms / 60000);
    if (coins < 1) return 0;
    W.earn(coins, { reason: 'העיר הכניסה בזמן שלא הייתם', silent: true });
    const mins = Math.round(ms / 60000);
    const capped = away > TAX_CAP_MS ? ' (זה המקסימום, 3 שעות)' : '';
    notes.push(`בזמן שלא הייתם העיר הכניסה ${coins} 🪙 על ${mins} דקות${capped}`);
    return coins;
}
function payCityTaxes(dt) {
    taxTouchClock += dt;
    if (taxTouchClock >= 10) { taxTouchClock = 0; touchTax(); }
    if (!W || cityRate <= 0) return;
    cityTaxAcc += cityRate * dt / 60;
    const whole = Math.floor(cityTaxAcc);
    if (whole < 1) return;
    cityTaxAcc -= whole;
    W.earn(whole, { reason: 'העיר משלמת מסים', silent: true });
    floatText(entranceC, entranceR, `+${whole} 🪙`, 'gain');
}

// דרגות העיר: כשמספר התושבים עובר סף, העיר עולה דרגה ומקבלים פרס (פעם אחת)
const RANKS = [
    { pop: 10, name: 'כפר', icon: '🏡', prize: R.create },
    { pop: 25, name: 'עיירה', icon: '🏘️', prize: R.round },
    { pop: 50, name: 'עיר', icon: '🏙️', prize: R.level },
    { pop: 100, name: 'עיר גדולה', icon: '🌆', prize: R.level + R.create },
    { pop: 200, name: 'מטרופולין', icon: '🌃', prize: R.perfect },
];

// דרישות התושבים והמדדים שנענו בפעם הראשונה מזכים בכסף, פעם אחת בלבד
function checkRewards() {
    const m = cityMeters();
    const st = m.st;
    let changed = false;
    const reward = (id, amount, text) => {
        if (met.includes(id)) return;
        met.push(id);
        changed = true;
        if (W) {
            W.earn(amount, { reason: text });
            notes.push(`${text} (+${amount} 🪙)`);
        } else {
            notes.push(text);
        }
    };
    demandsNow(st.pop).forEach(d => {
        if (st.pop < d.pop || !((st.active[d.id] || 0) >= d.need)) return;
        reward(d.late ? `late-${d.id}-${d.need}` : d.id, R.round, `התושבים מרוצים: ${d.text}`);
    });
    if (st.pop > 0 && m.env >= GOOD_LEVEL) reward('env-good', R.round, 'הסביבה ירוקה ונקייה!');
    if (st.pop > 0 && m.happy >= GOOD_LEVEL) reward('happy-good', R.round, 'התושבים מאושרים בעיר!');
    RANKS.forEach(k => { if (st.pop >= k.pop) reward('rank-' + k.pop, k.prize, `${k.icon} העיר גדלה ועלתה לדרגת ${k.name}!`); });
    if (helped >= 10) reward('helper-10', R.round, '🦸 עזרתם לתושבים 10 פעמים!');
    if (helped >= 50) reward('helper-50', R.perfect, '🦸 עזרתם לתושבים 50 פעמים!');
    if (changed) saveState();
}

// --- גיאומטריה וחומרים (נשמרים במטמון כדי שלא ייווצרו מחדש בכל ציור) ---
const geoCache = new Map();
const matCache = new Map();

function cached(cache, k, make) {
    if (!cache.has(k)) cache.set(k, make());
    return cache.get(k);
}

function boxG(w, h, d) { return cached(geoCache, `b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)); }
function cylG(rt, rb, h, seg) { return cached(geoCache, `c${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)); }
function coneG(r, h, seg) { return cached(geoCache, `k${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg)); }
// כדור עם משולשים מעודנים (רמה 1): כתרי עצים ופרחים נראים עגולים יותר
function icoG(r) { return cached(geoCache, `i${r}`, () => new THREE.IcosahedronGeometry(r, 1)); }

function mat(color, extra) {
    const k = color + '|' + JSON.stringify(extra || {});
    // הקוד כותב צבעי מסך (sRGB), והתאורה מחושבת בליניארי: כך הצבעים עשירים ולא דהויים
    return cached(matCache, k, () => {
        const o = Object.assign({ roughness: 0.8, metalness: 0 }, extra || {});
        o.color = new THREE.Color(color).convertSRGBToLinear();
        if (o.emissive) o.emissive = new THREE.Color(o.emissive).convertSRGBToLinear();
        return new THREE.MeshStandardMaterial(o);
    });
}

function part(parent, geometry, color, x, y, z, extra) {
    const m = new THREE.Mesh(geometry, mat(color, extra));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
}

// גוון בהיר (f>1) או כהה (f<1) של צבע הקס
function tint(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (shift) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * f)));
    return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('');
}

// מספר "אקראי" קבוע לכל חלקה (כדי שהעיר לא תשתנה בכל רענון)
function rnd(seed, k) {
    const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);
}

function seedOf(c, r) {
    return (c + 500) * 1000 + (r + 500);
}

function facingRot(c, r) {
    for (const d of DIRS) {
        if (roadAt(c + d.dc, r + d.dr)) return FACE_ROT[d.name];
    }
    return 0;
}

// --- המודלים התלת-ממדיים (buildCell, buildSale, drawOutsideRoad, אנשים ומכוניות) נמצאים ב-models.js וב-models-b.js ---

// --- סצנה ---
let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let hoverMesh = null;
let selMesh = null;         // מסגרת סביב החלקה שהלוח שלה פתוח
let raycaster = null;
let groundPlane = null;
const groups = new Map();   // "c,r" -> Group שמוצג בסצנה

let citySun = null;
let cityHemi = null;
let cityStars = null;
let skyCtx = null;
const cityClouds = [];
const SUN_OFFSET = { x: 5, y: 11, z: 6 };

function init3D() {
    const container = $('scene');
    if (!window.THREE) {
        container.textContent = 'התלת-ממד לא נטען. רעננו את העמוד.';
        return false;
    }
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (e) {
        container.textContent = 'המכשיר הזה לא תומך בתלת-ממד.';
        return false;
    }
    // במכשיר שנוגעים בו (טלפון, טאבלט) מורידים את רמת הפירוט כדי שהסיבוב יהיה חלק
    const touchScreen = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touchScreen ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    // שמיים בגווני כחול: כהה למעלה ובהיר באופק
    const skyCv = document.createElement('canvas');
    skyCv.width = 4; skyCv.height = 256;
    skyCtx = skyCv.getContext('2d');
    scene.background = new THREE.CanvasTexture(skyCv);
    scene.background.encoding = THREE.sRGBEncoding;
    // ערפל עדין בקצה העיר: נותן עומק, והדשא מסתיים בלי קו חד
    scene.fog = new THREE.Fog(new THREE.Color('#e3f5ff').convertSRGBToLinear(), 22, 70);

    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 4;
    controls.maxPolarAngle = Math.PI * 0.42;

    const lin = (c) => new THREE.Color(c).convertSRGBToLinear();
    cityHemi = new THREE.HemisphereLight(lin('#eaf6ff'), lin('#86a868'), 0.95);
    scene.add(cityHemi);
    cityStars = makeStars();
    scene.add(cityStars);
    const sun = citySun = new THREE.DirectionalLight(lin('#fff1d0'), 1.5);   // שמש חמימה, עוקבת אחרי מרכז המבט
    sun.position.set(4, 9, 5);
    sun.castShadow = true;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun.target);
    // עננים שטים לאט מעל העיר
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 7; i++) {
        const cloud = new THREE.Group();
        const puffs = 3 + (i % 3);
        for (let k = 0; k < puffs; k++) {
            const puff = new THREE.Mesh(icoG(0.6), cloudMat);
            puff.position.set((k - puffs / 2) * 0.7, rnd(i, k) * 0.25, (rnd(i, k + 9) - 0.5) * 0.5);
            puff.scale.set(1 + rnd(i, k + 3) * 0.5, 0.6, 0.9);
            cloud.add(puff);
        }
        cloud.position.set((rnd(i, 20) - 0.5) * 50, 9 + rnd(i, 21) * 3, (rnd(i, 22) - 0.5) * 40 - 6);
        cloud.scale.setScalar(1 + rnd(i, 23));
        cloud.userData.v = 0.15 + rnd(i, 24) * 0.25;
        scene.add(cloud);
        cityClouds.push(cloud);
    }
    sun.shadow.mapSize.set(touchScreen ? 1024 : 2048, touchScreen ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
    sun.shadow.camera.updateProjectionMatrix();
    scene.add(sun);

    // הדשא שמתחת לעיר (נשאר במרכז, והשטח מתרחב מעליו)
    const base = new THREE.Mesh(boxG(60, 0.1, 60), mat('#5f9c45'));
    base.position.y = -0.15;
    base.receiveShadow = true;
    scene.add(base);

    // הדגשת החלקה שמתחת לסמן
    hoverMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.96, 0.96),
        new THREE.MeshBasicMaterial({ color: '#ffeb3b', transparent: true, opacity: 0.45, depthWrite: false })
    );
    hoverMesh.rotation.x = -Math.PI / 2;
    hoverMesh.position.y = 0.04;
    hoverMesh.visible = false;
    scene.add(hoverMesh);
    selMesh = new THREE.Mesh(
        new THREE.RingGeometry(0.6, 0.69, 4, 1, Math.PI / 4),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false })
    );
    selMesh.rotation.x = -Math.PI / 2;
    selMesh.visible = false;
    scene.add(selMesh);

    raycaster = new THREE.Raycaster();
    groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    resize();
    window.addEventListener('resize', resize);

    const canvas = renderer.domElement;
    const pointers = new Set();   // האצבעות (או העכבר) שנמצאים על המסך עכשיו
    let pressX = 0;
    let pressY = 0;
    let dragged = false;          // הייתה גרירה, או יותר מאצבע אחת: זה לא נחשב לחיצה
    canvas.addEventListener('pointerdown', (e) => {
        pointers.add(e.pointerId);
        if (pointers.size > 1) {
            dragged = true;       // שתי אצבעות = זום או הזזה, לא בנייה
        } else {
            pressX = e.clientX;
            pressY = e.clientY;
            dragged = false;
        }
    });
    canvas.addEventListener('pointermove', (e) => {
        if (Math.hypot(e.clientX - pressX, e.clientY - pressY) > 6) dragged = true;
        updateHover(e);
    });
    canvas.addEventListener('pointerup', (e) => {
        const isTap = pointers.size === 1 && !dragged;
        pointers.delete(e.pointerId);
        if (!isTap) return;
        const cell = eventCellAt(e) || cellAt(e);   // לחיצה על הבועה עצמה נחשבת לחיצה על החלקה שלה
        if (cell) onCell(cell.c, cell.r);
    });
    canvas.addEventListener('pointercancel', (e) => {
        dragged = true;           // הדפדפן לקח את המגע (למשל גלילה): לא לחיצה
        pointers.delete(e.pointerId);
    });
    canvas.addEventListener('pointerleave', () => { hoverMesh.visible = false; });

    drawAll();
    fitCamera();
    animate();
    return true;
}

// מכוון את המצלמה למרכז העיר. המרחק קבוע: העיר לא "מתרחקת" כשהיא גדלה
function fitCamera() {
    if (!controls) return;
    const b = bounds();
    const cx = (b.minC + b.maxC) / 2;
    const cz = (b.minR + b.maxR) / 2;
    controls.target.set(cx, 0, cz);
    camera.position.set(cx, 6.4, cz + 6.6);
    controls.maxDistance = 14;
    controls.update();
}

function resize() {
    const w = $('scene').clientWidth;
    const h = Math.min(Math.round(w * 0.8), 440);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = lastFrameMs ? Math.min(0.1, (now - lastFrameMs) / 1000) : 0;
    lastFrameMs = now;
    if (tourOn) stepTour(dt); else controls.update();
    citySun.target.position.copy(controls.target);
    citySun.position.copy(controls.target).add(SUN_OFFSET);
    cityClouds.forEach((c) => { c.position.x += c.userData.v * dt; if (c.position.x > 28) c.position.x = -28; });
    if (scene) updateMovers(dt);
    stepFX(dt, now / 1000);
    stepEvents(dt, now / 1000);
    stepFestival(dt);
    payCityTaxes(dt);
    renderer.render(scene, camera);
}

// לחיצה ישירה על בועת אירוע: מחזיר את החלקה שלה
function eventCellAt(e) {
    if (!cityEvents.length) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
    const hit = raycaster.intersectObjects(cityEvents.map(x => x.sprite))[0];
    const ev = hit && cityEvents.find(x => x.sprite === hit.object);
    return ev ? { c: ev.c, r: ev.r } : null;
}

// איזו חלקה נמצאת מתחת לסמן (שלנו או למכירה), או null אם מחוץ לעיר
function cellAt(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, p)) return null;
    const c = Math.round(p.x);
    const r = Math.round(p.z);
    return (isOwned(c, r) || isSale(c, r)) ? { c, r } : null;
}

// צבע הסמן: כחול = קנייה של שטח, צהוב = אפשר לבנות או להוסיף כאן, כתום = ייפתח לוח החלקה
function hoverColor(c, r) {
    if (!isOwned(c, r)) return '#4fc3f7';
    const v = VARIANT_BY_ID[selected];
    if (isDecorVariant(v)) return canAddDecor(c, r, v) ? '#ffeb3b' : '#ff9800';
    return buildingAt(c, r) || decorAt(c, r).length ? '#ff9800' : '#ffeb3b';
}

function updateHover(e) {
    const cell = tourOn ? null : cellAt(e);
    if (!cell) {
        hoverMesh.visible = false;
        return;
    }
    const { c, r } = cell;
    hoverMesh.position.x = c;
    hoverMesh.position.z = r;
    hoverMesh.material.color.set(hoverColor(c, r));
    hoverMesh.visible = true;
}

// ציור מחדש של חלקה
function drawCell(c, r) {
    if (!scene) return;
    const k = key(c, r);
    const old = groups.get(k);
    if (old) {
        scene.remove(old);
        groups.delete(k);
    }
    let g = null;
    if (isOwned(c, r)) g = buildCell(c, r);
    else if (isSale(c, r)) g = buildSale(c, r);
    if (g) {
        scene.add(g);
        groups.set(k, g);
    }
}

// ציור כל העיר מחדש. דרכים ובתי ספר מסתכלים על השכנים, ולכן מחשבים הכול מחדש
function drawAll() {
    refreshSchoolGroups();
    CityKit.resetFX();
    pops.length = 0;
    nightApplied = -1;   // חלונות ופנסים חדשים צריכים לקבל את מצב היום או הלילה
    const all = new Set(owned);
    for (const k of owned) {
        const { c, r } = parseKey(k);
        DIRS.forEach(d => all.add(key(c + d.dc, r + d.dr)));
    }
    all.forEach(k => {
        const { c, r } = parseKey(k);
        drawCell(c, r);
    });
    drawOutsideRoad();
}

// --- קטלוג: לשוניות לכל קטגוריה, ומוצגים רק הסוגים של הלשונית שנבחרה ---
function renderCatalog() {
    const box = $('shop');
    box.innerHTML = '';
    const bal = balance();

    // מה נבחר כרגע
    const cur = VARIANT_BY_ID[selected];
    if (cur) {
        const picked = document.createElement('div');
        picked.className = 'picked';
        picked.textContent = `נבחר: ${cur.icon} ${cur.name} · ${cur.price} 🪙`;
        box.appendChild(picked);
    }

    const tabs = document.createElement('div');
    tabs.className = 'tabs';
    tabs.setAttribute('role', 'tablist');
    [...CATS, { id: 'land', name: 'שטח', icon: '🗺️', color: '#7cb342' }].forEach(t => {
        const b = document.createElement('button');
        b.className = 'tab' + (t.id === selectedCat ? ' on' : '');
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', String(t.id === selectedCat));
        b.textContent = `${t.icon} ${t.name}`;
        b.style.setProperty('--tab', t.color);
        b.onclick = () => { selectedCat = t.id; renderCatalog(); };
        tabs.appendChild(b);
    });
    box.appendChild(tabs);

    const grid = document.createElement('div');
    grid.className = 'cards';
    if (selectedCat === 'land') {
        const land = document.createElement('button');
        land.className = 'card info' + (bal < LAND_PRICE ? ' cant' : '');
        land.innerHTML = `<span class="icon">🗺️</span><span class="name">שטח חדש</span><span class="desc">חלקה ליד העיר. לחצו עליה במפה</span><span class="price">${LAND_PRICE} 🪙</span>`;
        land.onclick = () => {
            $('hint').textContent = 'לחצו על חלקה בהירה עם דגל צהוב במפה כדי לקנות אותה. המחיר קבוע, והעיר לא מתרחקת כשהיא גדלה.';
        };
        grid.appendChild(land);
    } else {
        VARIANTS.filter(v => v.cat === selectedCat).forEach(v => {
            const btn = document.createElement('button');
            btn.className = 'card' + (v.id === selected ? ' selected' : '') + (bal < v.price ? ' cant' : '');
            btn.setAttribute('aria-pressed', String(v.id === selected));
            const pop = v.pop ? `<span class="pop">👥 +${v.pop} תושבים</span>` : '';
            const sp = spaceOf(v.id);
            const cap = isDecorVariant(v) ? `<span class="note">📐 תופס ${sp} מתוך ${PLOT_SPACE} מקומות</span>`
                : (sp < PLOT_SPACE ? `<span class="note">📐 נשארים לידו ${PLOT_SPACE - sp} מקומות לעצים וקישוטים</span>` : '');
            const eco = ecoBadge(v);
            btn.innerHTML = `<span class="icon">${v.icon}</span><span class="name">${v.name}</span><span class="desc">${v.desc}</span>${pop}${cap}${eco}<span class="price">${v.price} 🪙</span>`;
            btn.onclick = () => {
                selected = v.id;
                setDeleteMode(false);
                renderCatalog();
                $('hint').textContent = isDecorVariant(v)
                    ? `נבחר: ${v.name}, תופס ${sp} מתוך ${PLOT_SPACE} מקומות בחלקה. לחצו על חלקה שיש בה מקום, גם ליד מבנה קטן.`
                    : `נבחר: ${v.name}. לחצו על חלקה ריקה כדי לבנות.` + (sp < PLOT_SPACE ? ` לידו יישארו ${PLOT_SPACE - sp} מקומות לעצים וקישוטים.` : '');
            };
            grid.appendChild(btn);
        });
    }
    box.appendChild(grid);
}

function renderCounts() {
    const counts = {};
    buildings.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    decor.forEach(list => list.forEach(id => { counts[id] = (counts[id] || 0) + 1; }));
    const parts = VARIANTS.filter(v => counts[v.id]).map(v => `${v.icon} ${counts[v.id]} ${v.name}`);
    const land = `🗺️ ${owned.size} חלקות`;
    $('counts').textContent = parts.length ? `${land} · ${parts.join(' · ')}` : `${land}. העיר עוד ריקה, זמן לבנות!`;
}

// המדדים הנוספים: כותרת, הודעה לפי הערך (0 = טוב, 1 = בסדר, 2 = צריך שיפור), ומשפט של התושבים כשהמד נמוך
const EXTRA_METERS = [
    { id: 'safety', title: '🚓 מד ביטחון (פחות פשע)', notes: ['🛡️ בטוח ושקט', '🙂 בסדר, אפשר עוד משטרה', '⚠️ יש פשע, צריך משטרה או בית משפט'], complaint: 'אנחנו לא מרגישים בטוחים, צריך משטרה 🚓' },
    { id: 'health', title: '🏥 מד בריאות', notes: ['💚 בריאים ומטופלים', '🙂 בסדר, אפשר עוד מרפאה', '🤒 צריך מרפאה או בית חולים'], complaint: 'אנחנו צריכים מרפאה קרובה 🏥' },
    { id: 'education', title: '🎓 מד חינוך', notes: ['📚 לומדים הרבה', '🙂 בסדר, אפשר עוד בית ספר', '✏️ צריך בית ספר או גן'], complaint: 'אנחנו רוצים בית ספר וגן 🏫' },
    { id: 'jobs', title: '💼 מד תעסוקה', notes: ['💼 יש עבודה לכולם', '🙂 בסדר, אפשר עוד חנויות', '😟 מעט עבודה, צריך חנויות'], complaint: 'צריך עוד חנויות שייתנו עבודה 🏪' },
    { id: 'leisure', title: '🎈 מד פנאי ותרבות', notes: ['🎈 כיף לצאת', '🙂 בסדר, אפשר עוד פארק', '😐 משעמם, צריך פארק וספסלים'], complaint: 'משעמם לנו, צריך פארק 🏞️' },
    { id: 'traffic', title: '🚦 מד תנועה', notes: ['🚦 הדרכים זורמות', '🙂 קצת עומס', '🚗 פקקים, צריך עוד דרכים'], complaint: 'יש פקקים, צריך עוד דרכים 🚗' },
];
const levelOf = (v) => v >= GOOD_LEVEL ? 0 : v >= 40 ? 1 : 2;

// שני מדדים: שמירה על הסביבה ושמחה. כל מד צבוע לפי הערך שלו
function renderMeters(m) {
    const envNote = m.env >= GOOD_LEVEL ? '🌳 ירוק ונקי'
        : m.env >= 40 ? '🌿 בסדר, אפשר עוד ירק'
        : '🏭 צריך הרבה יותר ירק';
    const happyNote = m.st.pop === 0 ? 'בנו בית עם דרך כדי שיגיעו תושבים'
        : m.happy >= GOOD_LEVEL ? '😄 מאושרים מאוד'
        : m.happy >= 40 ? '🙂 בסדר'
        : '😟 עוד לא מרוצים';
    const meter = (title, value, cls, note) => `
        <div class="meter">
            <div class="meter-head"><span>${title}</span><strong>${maskValue(value)}%</strong></div>
            <div class="meter-bar"><div class="meter-fill ${cls}" style="width:${value}%"></div></div>
            <div class="meter-note">${note}</div>
        </div>`;
    const extra = EXTRA_METERS.map(d => meter(d.title, m.extra[d.id], d.id, d.notes[levelOf(m.extra[d.id])])).join('');
    const inc = cityIncome(m);
    const bits = [];
    if (inc.tax > 0) bits.push(`מסי מבנים ${inc.tax.toFixed(1)}`);
    if (inc.combo > 0) bits.push(`שילובים ${inc.combo.toFixed(1)}`);
    if (inc.attr > 0) bits.push(`אטרקציות ${inc.attr.toFixed(1)}`);
    if (inc.mult > 1) bits.push('⭐ פי 1.5 כי כל המדדים גבוהים');
    const income = `<div class="meter"><div class="meter-head"><span>💰 העיר מביאה</span><strong>${cityRate.toFixed(1)}</strong></div><div class="meter-note">מטבעות בדקה, משולם לבד. הכסף מצטבר גם כשאתם לא בעיר, עד 3 שעות.${bits.length ? ' (' + bits.join(' · ') + ')' : ''}</div></div>`;
    $('meters').innerHTML = meter('🌿 מד שמירה על הסביבה', m.env, 'env', envNote)
        + meter('😊 מד שמחה', m.happy, 'happy', happyNote)
        + extra + income;
}

// לוח התושבים: כמה יש, מה הם דורשים, ומה כבר נענה
function renderDemands(st) {
    const asking = [];
    const done = [];
    const soon = [];
    demandsNow(st.pop).forEach(d => {
        const have = st.active[d.id] || 0;
        const ok = have >= d.need;
        const text = d.need > 1 ? `${d.text} (יש ${have} מתוך ${d.need})` : d.text;
        if (st.pop < d.pop) soon.push(`${d.icon} ${text} (מ־${d.pop} תושבים)`);
        else if (ok) done.push(`✅ ${d.icon} ${text}`);
        else asking.push(`${d.icon} ${text}`);
    });

    const lines = [];
    lines.push(`<div class="pop">👥 ${st.pop} תושבים</div>`);
    // דרגת העיר, וכמה תושבים חסרים לדרגה הבאה
    const rankIdx = RANKS.filter(k => st.pop >= k.pop).length;
    const cur = rankIdx ? RANKS[rankIdx - 1] : { pop: 0, name: 'יישוב קטן', icon: '⛺' };
    const next = RANKS[rankIdx];
    const pct = next ? Math.round((st.pop - cur.pop) / (next.pop - cur.pop) * 100) : 100;
    lines.push(`<div class="rank"><span class="rank-name">${cur.icon} ${cur.name}</span>`
        + `<div class="rank-bar"><div class="rank-fill" style="width:${pct}%"></div></div>`
        + `<span class="rank-next">${next ? `עוד ${next.pop - st.pop} תושבים ל${next.name} (+${next.prize} 🪙)` : 'הדרגה הגבוהה ביותר!'}</span></div>`);
    if (st.pop === 0) lines.push('<div class="ask">בנו בית שיש לו דרך כדי שיגיעו תושבים.</div>');
    if (asking.length) lines.push(`<div class="ask">התושבים דורשים: ${asking.join(' · ')}</div>`);
    if (done.length) lines.push(`<div class="done">${done.join(' · ')}</div>`);
    if (soon.length) lines.push(`<div class="soon">בקרוב יבקשו: ${soon.join(' · ')}</div>`);
    if (st.inactive > 0) lines.push(`<div class="warn">🚧 ${st.inactive} מבנים ממתינים לדרך. בלי דרך הם לא עובדים.</div>`);
    $('demands').innerHTML = lines.join('');
}

// מה התושבים אוהבים בעיר: משפט בשם התושבים לכל דבר שבנוי בעיר, ומה מפריע להם
function renderLoves(m) {
    const box = $('loves');
    const title = '<div class="loves-title">💬 מה התושבים אוהבים בעיר</div>';
    if (m.st.pop === 0) {
        box.innerHTML = title + '<div class="loves-empty">עוד אין תושבים. בנו בית עם דרך והם יגיעו!</div>';
        return;
    }
    const bubbles = m.loved.map(v => `<div class="bubble">${v.icon} „${v.love}“</div>`).join('');
    const complaints = [];
    if (m.env < 40) complaints.push('אנחנו צריכים עוד עצים ופארקים 🌳');
    EXTRA_METERS.forEach(d => { if (m.extra[d.id] < 40) complaints.push(d.complaint); });
    if (m.st.inactive > 0) complaints.push('יש בית שמחכה לדרך, כדי שנוכל להגיע אליו 🚧');
    box.innerHTML = title
        + (bubbles ? `<div class="bubbles">${bubbles}</div>` : '<div class="loves-empty">עוד לא בנינו משהו שאוהבים</div>')
        + complaints.map(t => `<div class="complaint">💭 ${t}</div>`).join('');
}

// אטרקציות בעיר: לכל אחת כפתור כניסה למשחק שלה (החלקה נשלחת בכתובת). נדרשת דרך כדי להיכנס
function renderAttractions() {
    const box = $('attractions');
    if (!box) return;
    const list = [];
    for (const [k, id] of buildings) {
        if (!ATTRACTIONS[id]) continue;
        const { c, r } = parseKey(k);
        list.push({ k, id, c, r, v: VARIANT_BY_ID[id], active: buildingActive(c, r) });
    }
    if (!list.length) { box.innerHTML = ''; box.hidden = true; return; }
    list.sort((a, b) => a.id.localeCompare(b.id) || a.r - b.r || a.c - b.c);
    box.hidden = false;
    const seen = {};
    const rows = list.map(a => {
        seen[a.id] = (seen[a.id] || 0) + 1;
        const d = attractionData(a.k, a.id);
        const rate = a.active ? attractionRate(a.k, a.id) : 0;
        const sum = d && d.summary ? ` · ${String(d.summary).slice(0, 60)}` : ' · עוד לא נכנסתם';
        const name = `${a.v.icon} ${ATTRACTIONS[a.id].label} ${seen[a.id]} (חלקה ${a.c + 1},${a.r + 1})`;
        const action = a.active
            ? `<a class="enter-btn" href="${ATTRACTIONS[a.id].page}?cell=${encodeURIComponent(a.k)}">🚪 כניסה</a>`
            : '<span class="enter-off">🚧 צריך דרך לידו</span>';
        return `<div class="attr-row"><span class="attr-name">${name}<small>${a.active ? ` · ${rate.toFixed(1)} 🪙 לדקה` : ''}${a.active ? sum : ''}</small></span>${action}</div>`;
    });
    box.innerHTML = '<div class="loves-title">🎡 אטרקציות: לחצו על כניסה כדי לנהל</div>' + rows.join('');
}

function renderAll() {
    renderCatalog();
    renderCounts();
    const m = cityMeters();
    cityRate = cityCoinsPerMinute(m);
    renderAttractions();
    renderMeters(m);
    renderDemands(m.st);
    renderLoves(m);
    renderSel();
    updateFestBtn();
}

// --- פעולות ---
// שינוי בעיר: שומרים, מציירים מחדש (דרכים ובתי ספר מסתכלים על השכנים), בודקים פרסים, ומציגים
function commit() {
    saveState();
    drawAll();
    checkRewards();
    renderAll();
}

// לחיצה על חלקה. שטח למכירה: קונים. אירוע (בועה מעל מבנה): מטפלים בו.
// נבחר עץ או קישוט ויש לו מקום בחלקה: מוסיפים. חלקה ריקה: בונים. אחרת נפתח לוח החלקה (שדרוג, הסרה, התקרבות)
function onCell(c, r) {
    if (tourOn) return;
    if (deleteMode) return deleteAt(c, r);
    if (!isOwned(c, r)) return buyLand(c, r);
    if (resolveEvent(c, r)) return;
    const v = VARIANT_BY_ID[selected];
    const busy = !!buildingAt(c, r) || decorAt(c, r).length > 0;
    if (isDecorVariant(v)) {
        if (canAddDecor(c, r, v)) return place(c, r);
        if (!busy) return;
        selectCell(c, r);
        if (!roadAt(c, r)) feedback(`אין מספיק מקום ל${v.name} בחלקה הזו (תופס ${spaceOf(v.id)}, נשארו ${spaceFree(c, r)})`);
        return;
    }
    if (busy) return selectCell(c, r);
    place(c, r);
}

function buyLand(c, r) {
    if (!W) return feedback('אי אפשר לקנות עכשיו 🪙');
    const price = LAND_PRICE;
    const bal = balance();
    if (bal < price) return feedback(`חסרים לכם ${price - bal} 🪙 כדי לקנות שטח נוסף`);
    if (!W.spend(price)) return feedback('משהו השתבש, נסו שוב');
    // שטח חדש שהוא מערב לכל העיר: השער זז אליו (גם אם הוא בשורה אחרת), והכביש החוצה ממשיך ממנו
    const gateMoved = c < bounds().minC;
    owned.add(key(c, r));
    if (gateMoved) {
        entranceC = c;
        entranceR = r;
        buildings.set(key(c, r), 'road');
    }
    commit();
    fitCamera();
    popCell(c, r);
    floatText(c, r, `−${price} 🪙`, 'pay');
    feedback(gateMoved ? `קניתם שטח חדש, והשער זז אליו! −${price} 🪙` : `קניתם שטח חדש! −${price} 🪙`);
}

function place(c, r) {
    const v = VARIANT_BY_ID[selected];
    if (!v) return;
    const bal = balance();
    if (!W) return feedback('אי אפשר לבנות עכשיו 🪙');
    if (isDecorVariant(v) ? !canAddDecor(c, r, v) : !canBuildAt(c, r, v)) return feedback(`אין מספיק מקום ל${v.name} בחלקה הזו`);
    if (bal < v.price) {
        return feedback(`חסרים לכם ${v.price - bal} 🪙 כדי לבנות ${v.name}`);
    }
    if (!W.spend(v.price)) return feedback('משהו השתבש, נסו שוב');

    if (isDecorVariant(v)) {
        decor.set(key(c, r), [...decorAt(c, r), v.id]);
        commit();
        popCell(c, r);
        floatText(c, r, `−${v.price} 🪙`, 'pay');
        return feedback(`הוספתם ${v.name}. מקום בחלקה: ${spaceUsed(c, r)} מתוך ${PLOT_SPACE}. −${v.price} 🪙`);
    }

    buildings.set(key(c, r), v.id);
    commit();
    popCell(c, r);
    floatText(c, r, `−${v.price} 🪙`, 'pay');
    if (v.cat === 'road' || buildingActive(c, r)) {
        feedback(`בניתם ${v.name}! −${v.price} 🪙`);
    } else {
        feedback(`בניתם ${v.name}, אבל בלי דרך לידו הוא לא יעבוד 🚧 (−${v.price} 🪙)`);
    }
}

// שדרוג מבנה: רמה 2 ורמה 3. מבנה משודרג מכניס יותר תושבים, מסים ותיירים, ומשרת יותר תושבים
function upgradeAt(c, r) {
    const up = canUpgradeAt(c, r);
    const v = variantAt(c, r);
    if (!up) return;
    if (!W) return feedback('אי אפשר לשדרג עכשיו 🪙');
    const bal = balance();
    if (bal < up.cost) return feedback(`חסרים לכם ${up.cost - bal} 🪙 כדי לשדרג את ${v.name}`);
    if (!W.spend(up.cost)) return feedback('משהו השתבש, נסו שוב');
    levels.set(key(c, r), up.level);
    commit();
    popCell(c, r);
    floatText(c, r, `−${up.cost} 🪙`, 'pay');
    feedback(`⬆️ ${v.name} שודרג לרמה ${up.level}! −${up.cost} 🪙`);
}

function removeAt(c, r) {
    const v = variantAt(c, r);
    if (!confirm(`למחוק את ${v.name}? יוחזר חצי מהמחיר.`)) return;
    const refund = Math.floor(investedAt(c, r) / 2);
    buildings.delete(key(c, r));
    levels.delete(key(c, r));
    dropEventAt(c, r);
    commit();
    if (W && refund > 0) { W.earn(refund, { reason: `החזר ${v.name}` }); floatText(c, r, `+${refund} 🪙`, 'gain'); }
    dustAt(c, r);
    feedback(`הורדתם ${v.name}. הוחזרו ${refund} 🪙`);
}

// מסירים את העץ או הקישוט האחרון שנוסף לחלקה
function removeDecorAt(c, r) {
    const list = decorAt(c, r);
    const id = list[list.length - 1];
    const v = VARIANT_BY_ID[id];
    if (!confirm(`למחוק את ${v.name}? יוחזר חצי מהמחיר.`)) return;
    const refund = Math.floor(v.price / 2);
    if (list.length > 1) decor.set(key(c, r), list.slice(0, -1));
    else decor.delete(key(c, r));
    commit();
    if (W && refund > 0) { W.earn(refund, { reason: `החזר ${v.name}` }); floatText(c, r, `+${refund} 🪙`, 'gain'); }
    feedback(`הורדתם ${v.name} מהחלקה. הוחזרו ${refund} 🪙`);
}

// מחיקה: מוחקים את המבנה, או את כל העצים והקישוטים בחלקה. מחזירים חצי מחיר לכל דבר (כמו בהסרה רגילה)
function deleteAt(c, r) {
    if (!isOwned(c, r)) return feedback('החלקה הזו עוד לא שלכם, אז אין מה למחוק בה');
    if (buildingAt(c, r)) {
        if (isEntrance(c, r) && roadAt(c, r)) return feedback('הכביש הזה מחבר את העיר לעולם החיצון, לכן אי אפשר למחוק אותו');
        return removeAt(c, r);
    }
    if (decorAt(c, r).length) return removeAllDecorAt(c, r);
    feedback('אין מה למחוק בחלקה הזו');
}

function removeAllDecorAt(c, r) {
    const list = decorAt(c, r);
    if (!confirm(`למחוק ${list.length} פריטים מהחלקה? יוחזר חצי מהמחיר.`)) return;
    const refund = list.reduce((sum, id) => sum + Math.floor(VARIANT_BY_ID[id].price / 2), 0);
    decor.delete(key(c, r));
    commit();
    if (W && refund > 0) { W.earn(refund, { reason: 'החזר עצים וקישוטים' }); floatText(c, r, `+${refund} 🪙`, 'gain'); }
    dustAt(c, r);
    feedback(`מחקתם ${list.length} פריטים מהחלקה. הוחזרו ${refund} 🪙`);
}

// --- לוח החלקה: נפתח בלחיצה על מבנה או על חלקה עם עצים וקישוטים ---
let selCell = null;
function selectCell(c, r) {
    selCell = key(c, r);
    renderSel();
}
function renderSel() {
    const box = $('citySel');
    if (!box) return;
    const cell = selCell ? parseKey(selCell) : null;
    const v = cell ? variantAt(cell.c, cell.r) : null;
    const list = cell ? decorAt(cell.c, cell.r) : [];
    if (!cell || !isOwned(cell.c, cell.r) || (!v && !list.length)) {
        selCell = null;
        box.hidden = true;
        if (selMesh) selMesh.visible = false;
        return;
    }
    const { c, r } = cell;
    if (selMesh) { selMesh.position.set(c, 0.045, r); selMesh.visible = true; }
    const btn = (act, text, cls) => `<button class="act${cls ? ' ' + cls : ''}" data-act="${act}">${text}</button>`;
    const info = [];
    const acts = [];
    let title = '🌳 עצים וקישוטים';
    if (v) {
        const lv = levelAt(c, r), mult = LEVEL_MULT[lv - 1];
        title = `${v.icon} ${v.name}${lv > 1 ? ' ' + '⭐'.repeat(lv - 1) : ''}`;
        if (v.cat === 'road') info.push(isEntrance(c, r) ? 'הכביש שמחבר את העיר לעולם החיצון' : v.desc);
        else if (!buildingActive(c, r)) info.push('🚧 אין דרך ליד המבנה, ולכן הוא לא עובד');
        else {
            if (v.pop) info.push(`👥 ${Math.round(v.pop * mult)} תושבים`);
            if (BUILDING_TAX[v.id]) info.push(`💰 ${(BUILDING_TAX[v.id] * mult).toFixed(2)} לדקה`);
            if (v.tourist) info.push(`🧳 תיירים: ${(v.tourist * mult).toFixed(1)} לדקה`);
            if (!v.pop && !BUILDING_TAX[v.id] && !v.tourist) info.push(v.desc);
        }
        const up = canUpgradeAt(c, r);
        if (up) acts.push(btn('up', `⬆️ שדרוג לרמה ${up.level} (${up.cost} 🪙)`, balance() < up.cost ? 'cant' : ''));
        else if (levelAt(c, r) >= LEVEL_MAX) info.push('הרמה הגבוהה ביותר');
        if (ATTRACTIONS[v.id] && buildingActive(c, r)) acts.push(`<a class="act" href="${ATTRACTIONS[v.id].page}?cell=${encodeURIComponent(selCell)}">🚪 כניסה</a>`);
    }
    if (!v || v.cat !== 'road') info.push(`📐 מקום בחלקה: ${spaceUsed(c, r)} מתוך ${PLOT_SPACE}`);
    acts.push(btn('zoom', '🔍 התקרבות'));
    const pick = VARIANT_BY_ID[selected];
    if (!v && pick && !isDecorVariant(pick) && canBuildAt(c, r, pick)) acts.push(btn('build', `🏗️ לבנות כאן ${pick.name} (${pick.price} 🪙)`));
    if (list.length) {
        const last = VARIANT_BY_ID[list[list.length - 1]];
        acts.push(btn('undecor', `הסרת ${last.name} (+${Math.floor(last.price / 2)} 🪙)`, 'ghost'));
        if (list.length > 1) acts.push(btn('cleardecor', `הסרת כל ${list.length} הדברים הקטנים`, 'ghost'));
    }
    if (v && !(isEntrance(c, r) && v.cat === 'road')) acts.push(btn('remove', `🗑️ הסרת ${v.name} (+${Math.floor(investedAt(c, r) / 2)} 🪙)`, 'ghost'));
    acts.push(btn('close', '✖ סגירה', 'ghost'));
    box.hidden = false;
    box.innerHTML = `<div class="sel-info"><strong>${title}</strong><small>${info.join(' · ')}</small></div><div class="sel-acts">${acts.join('')}</div>`;
}
function onSelAct(act) {
    if (!selCell) return;
    const { c, r } = parseKey(selCell);
    if (act === 'close') selCell = null;
    else if (act === 'up') upgradeAt(c, r);
    else if (act === 'remove') removeAt(c, r);
    else if (act === 'undecor') removeDecorAt(c, r);
    else if (act === 'cleardecor') removeAllDecorAt(c, r);
    else if (act === 'build') place(c, r);
    else if (act === 'zoom' && controls) {
        controls.target.set(c, 0.25, r);
        camera.position.set(c, 2.1, r + 2.6);
        controls.update();
    }
    renderSel();
}

// כפתור המחיקה: דולק או כבוי. כשהוא דולק, ההינט מסביר מה לעשות
function setDeleteMode(on) {
    deleteMode = on;
    if (on && selCell) { selCell = null; renderSel(); }
    const btn = $('deleteBtn');
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('on', on);
    $('hint').textContent = on
        ? 'מצב מחיקה: לחצו על חלקה כדי למחוק את כל מה שיש בה. מחזירים חצי מהמחיר. לחצו שוב על 🗑️ מחיקה כדי לחזור לבנייה.'
        : HINT_BASE;
}

// --- אנשים ומכוניות ברחובות: הולכים ונוסעים לאורך הכבישים שבבעלות הילד ---
// אנשים גם עוצרים ומנפנפים, קופצים או מדברים עם מישהו. מכוניות רק נוסעות
const MOVERS_PEOPLE_MAX = 14;
const MOVERS_CARS_MAX = 6;
const PEOPLE_SHIRTS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#ff7043'];
const PEOPLE_PANTS = ['#37474f', '#5d4037', '#1a237e'];
const PEOPLE_SKINS = ['#f1c27d', '#8d5524', '#ffdbac'];
const CAR_COLORS = ['#e53935', '#1e88e5', '#fdd835', '#ffffff', '#8e24aa', '#43a047'];
// מי שביקש להפחית תנועה במערכת לא רואה אנשים ומכוניות שזזים
const MOVERS_OFF = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
// אנשים הולכים על המדרכה, לצד הכביש (האספלט רחב כ-0.42 בחלקה)
const SIDEWALK_OFFSET = 0.36;
// גובה כפות הרגליים: מעל הדשא והכביש, כדי שההולכים לא ייבלעו בתוך הקרקע
const WALK_Y = 0.03;
const movers = [];
let roadsNow = [];          // הכבישים שבבעלות הילד, מתעדכנים פעם בחצי שנייה
let moversClock = 0;
let lastFrameMs = 0;
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

function roadCellsNow() {
    const list = [];
    for (const [k, id] of buildings) {
        const v = VARIANT_BY_ID[id];
        if (v && v.cat === 'road') list.push(parseKey(k));
    }
    return list;
}

function makePerson() {
    const m = makePersonModel();
    return {
        kind: 'person', g: m.g, legs: m.legs, arms: m.arms, speed: 0.6 + Math.random() * 0.4, time: Math.random() * 10, phase: Math.random() * 6,
        side: Math.random() < 0.5 ? -1 : 1, latX: 0, latZ: 0,   // לאיזה צד של הכביש, והיסט נוכחי מהמרכז
    };
}

function makeCar() {
    return { kind: 'car', g: makeCarModel(), speed: 1.2 + Math.random() * 0.5, side: 0, latX: 0, latZ: 0 };
}

// מעמידים את הדמות או המכונית על כביש אקראי
function placeOnRoad(m) {
    if (!roadsNow.length) return;
    const s = pickRandom(roadsNow);
    m.c = m.fromC = m.toC = s.c;
    m.r = m.fromR = m.toR = s.r;
    m.prevC = null; m.prevR = null;
    m.t = 1; m.mode = 'walk'; m.timer = 0;
}

// צד ההליכה: הולכים בצד של הכביש שבו אין בניין או עץ צמוד, כדי שלא יסתתרו מאחורי מבנים.
// אם שני הצדדים חסומים, הולכים באמצע הכביש. מכוניות תמיד באמצע
function pickSide(m) {
    const dx = m.toC - m.fromC, dz = m.toR - m.fromR;
    const blockedOn = (s) => [[m.fromC, m.fromR], [m.toC, m.toR]].some(([c, r]) => blockedCell(c - dz * s, r + dx * s));
    const freeLeft = !blockedOn(1), freeRight = !blockedOn(-1);
    if (freeLeft && freeRight) return m.side || 1;
    if (freeLeft) return 1;
    if (freeRight) return -1;
    return 0;
}

// חסום: בניין, או עץ וקישוט בחלקה. דרך לא חוסמת
function blockedCell(c, r) {
    const v = variantAt(c, r);
    if (v && v.cat !== 'road') return true;
    return decorAt(c, r).length > 0;
}

// בוחרים כביש שכן להמשיך אליו. לא חוזרים בחזרה אלא אם אין ברירה
function chooseNext(m) {
    const options = DIRS.map(d => ({ c: m.c + d.dc, r: m.r + d.dr })).filter(o => roadAt(o.c, o.r));
    if (!options.length) return false;
    const fresh = options.filter(o => o.c !== m.prevC || o.r !== m.prevR);
    const next = pickRandom(fresh.length ? fresh : options);
    m.fromC = m.c; m.fromR = m.r; m.toC = next.c; m.toR = next.r; m.t = 0;
    if (m.kind === 'person') m.side = pickSide(m);
    return true;
}

function startAction(p, mode, seconds) { p.mode = mode; p.timer = seconds; }

function poseStill(p) {
    [...p.legs, ...p.arms].forEach(j => j.rotation.set(0, 0, 0));
}

function poseWalk(p, dt) {
    p.phase += dt * 9 * p.speed;
    const s = Math.sin(p.phase);
    p.legs[0].rotation.set(s * 0.6, 0, 0);
    p.legs[1].rotation.set(-s * 0.6, 0, 0);
    p.arms[0].rotation.set(-s * 0.5, 0, 0);
    p.arms[1].rotation.set(s * 0.5, 0, 0);
}

// הפעולה של אדם שעצר: מנפנף, קופץ או מדבר
function stepAction(p, dt) {
    p.timer -= dt;
    p.g.position.set(p.c + p.latX, WALK_Y, p.r + p.latZ);
    poseStill(p);
    if (p.mode === 'wave') p.arms[1].rotation.set(Math.PI * 0.9, 0, Math.sin(p.time * 12) * 0.4);
    else if (p.mode === 'jump') p.g.position.y = WALK_Y + Math.abs(Math.sin(p.time * 9)) * 0.14;
    else p.arms[0].rotation.set(-0.6 + Math.sin(p.time * 5) * 0.25, 0, 0);
    if (p.timer <= 0) {
        p.mode = 'walk';
        if (!chooseNext(p)) placeOnRoad(p);
    }
}

function stepMover(m, dt) {
    if (!roadAt(m.c, m.r)) { placeOnRoad(m); return; }
    m.time = (m.time || 0) + dt;
    if (m.mode !== 'walk') { stepAction(m, dt); return; }
    m.t += dt * m.speed;
    if (m.t >= 1) {
        // הגענו לחלקה הבאה
        m.prevC = m.c; m.prevR = m.r;
        m.c = m.toC; m.r = m.toR; m.t = 0;
        if (m.kind === 'person') {
            const roll = Math.random();
            if (roll < 0.1) { startAction(m, 'wave', 1.6); return; }
            if (roll < 0.18) { startAction(m, 'jump', 1.0); return; }
            if (roll < 0.25) { startAction(m, 'chat', 2.0); return; }
        }
        if (!chooseNext(m)) { placeOnRoad(m); return; }
    }
    const dx = m.toC - m.fromC;
    const dz = m.toR - m.fromR;
    // הולכים בצד הכביש, לא על האספלט. ההיסט זז בעדינות, כך שבפנייה אין קפיצה
    const len = Math.hypot(dx, dz);
    if (len) {
        const tx = (-dz / len) * m.side * SIDEWALK_OFFSET;
        const tz = (dx / len) * m.side * SIDEWALK_OFFSET;
        const k = Math.min(1, dt * 6);
        m.latX += (tx - m.latX) * k;
        m.latZ += (tz - m.latZ) * k;
    }
    m.g.position.set(m.fromC + dx * m.t + m.latX, WALK_Y, m.fromR + dz * m.t + m.latZ);
    if (dx || dz) m.g.rotation.y = Math.atan2(dx, dz);
    if (m.kind === 'person') poseWalk(m, dt);
}

// מוסיפים או מסירים דמויות/מכוניות עד שיש מספר מתאים לגודל העיר
function syncKind(kind, want, make) {
    const have = movers.filter(m => m.kind === kind);
    while (have.length < want) {
        const m = make();
        placeOnRoad(m);
        scene.add(m.g);
        movers.push(m);
        have.push(m);
    }
    while (have.length > want) {
        const m = have.pop();
        scene.remove(m.g);
        movers.splice(movers.indexOf(m), 1);
    }
}

function updateMovers(dt) {
    moversClock -= dt;
    if (moversClock <= 0) {
        moversClock = 0.5;
        roadsNow = roadCellsNow();
        const ok = !MOVERS_OFF && roadsNow.length >= 2;
        syncKind('person', ok ? Math.min(MOVERS_PEOPLE_MAX, 1 + Math.floor(roadsNow.length / 2)) : 0, makePerson);
        syncKind('car', ok ? Math.min(MOVERS_CARS_MAX, Math.floor(roadsNow.length / 4)) : 0, makeCar);
    }
    movers.forEach(m => stepMover(m, dt));
}

// --- אירועים בעיר: מדי פעם קורה משהו ליד מבנה (בועה מעליו). לחיצה על החלקה מטפלת בזה ומזכה במטבעות ---
// כשיש בעיר מבנה שעוזר (תחנת כיבוי, מרפאה, משטרה...) הטיפול מצליח יותר והפרס גדול יותר
const EVENTS = [
    { id: 'gift',  icon: '🎁', cats: ['house', 'apt'], ok: 'תושב שמח השאיר לכם מתנה' },
    { id: 'fire',  icon: '🔥', cats: ['house', 'apt', 'shop', 'civic', 'clinic', 'attr'], help: { id: 'fire' },
        ok: 'הכבאים הגיעו מהר וכיבו את האש', no: 'כיביתם את האש לבד. תחנת כיבוי הייתה עוזרת' },
    { id: 'sick',  icon: '🤒', cats: ['house', 'apt'], help: { cat: 'clinic' },
        ok: 'החולה קיבל טיפול במרפאה והבריא', no: 'הבאתם לחולה תה. מרפאה בעיר הייתה עוזרת' },
    { id: 'thief', icon: '🦹', cats: ['shop'], help: { id: 'police' },
        ok: 'השוטרים תפסו את הגנב', no: 'הגנב ברח. תחנת משטרה הייתה עוזרת' },
    { id: 'pet',   icon: '🐶', cats: ['house'], help: { id: 'vet' },
        ok: 'הווטרינר טיפל בכלב והוא שוב מכשכש בזנב', no: 'מצאתם את הכלב שאבד. וטרינר היה עוזר לו' },
    { id: 'trash', icon: '🗑️', cats: ['park', 'road'], help: { id: 'bin' },
        ok: 'האשפה נאספה לפחים', no: 'אספתם את האשפה ביד. פחי אשפה היו עוזרים' },
];
const cityEvents = [];   // { c, r, ev, sprite, left }
let eventClock = 20;     // שניות עד האירוע הבא

function bubbleSprite(icon) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const x = cv.getContext('2d');
    x.fillStyle = '#ffffff';
    x.beginPath(); x.moveTo(46, 96); x.lineTo(64, 126); x.lineTo(82, 96); x.fill();
    x.beginPath(); x.arc(64, 54, 48, 0, Math.PI * 2); x.fill();
    x.lineWidth = 6; x.strokeStyle = '#ff7043'; x.stroke();
    x.font = '60px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(icon, 64, 58);
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, fog: false }));
    sp.scale.set(0.6, 0.6, 1);
    sp.renderOrder = 10;
    return sp;
}

function spawnEvent() {
    if (!W || !scene || document.hidden || cityEvents.length >= 2) return;
    const spots = [];
    for (const [k, id] of buildings) {
        const v = VARIANT_BY_ID[id];
        const { c, r } = parseKey(k);
        if (!v || isEntrance(c, r) || cityEvents.some(e => e.c === c && e.r === r)) continue;
        if (v.cat !== 'road' && !buildingActive(c, r)) continue;
        EVENTS.forEach(ev => { if (ev.cats.includes(v.cat)) spots.push({ c, r, ev }); });
    }
    if (!spots.length) return;
    const s = pickRandom(spots);
    const g = groups.get(key(s.c, s.r));
    s.y = ((g && g.userData.top) || 0.5) + 0.5;
    s.sprite = bubbleSprite(s.ev.icon);
    s.sprite.position.set(s.c, s.y, s.r);
    s.left = 50;
    scene.add(s.sprite);
    cityEvents.push(s);
}
function dropEvent(e) {
    scene.remove(e.sprite);
    e.sprite.material.map.dispose();
    e.sprite.material.dispose();
    cityEvents.splice(cityEvents.indexOf(e), 1);
}
function dropEventAt(c, r) {
    const e = cityEvents.find(x => x.c === c && x.r === r);
    if (e) dropEvent(e);
}
// לחיצה על חלקה שיש מעליה בועה: מטפלים באירוע. מחזיר true אם היה אירוע
function resolveEvent(c, r) {
    const e = cityEvents.find(x => x.c === c && x.r === r);
    if (!e) return false;
    const st = stats();
    const h = e.ev.help;
    const helped_ = !h || (h.cat ? (st.active[h.cat] || 0) > 0 : (st.byId[h.id] || 0) > 0);
    const coins = helped_ ? R.answer : R.smallSuccess;
    W.earn(coins, { reason: 'עזרה לתושבי העיר', silent: true });
    floatText(c, r, `+${coins} 🪙`, 'gain');
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        spawnPuff(c, e.y - 0.2, r, { col: i % 2 ? '#ffd54f' : '#ff8fab', glow: true, life: 0.8, vx: Math.cos(a) * 0.6, vy: 0.5, vz: Math.sin(a) * 0.6, grow: 0.5, a: 1, g: 1.2 });
    }
    dropEvent(e);
    helped++;
    saveState();
    checkRewards();
    renderAll();
    feedback(`${e.ev.icon} ${helped_ ? e.ev.ok : e.ev.no}. +${coins} 🪙`);
    return true;
}
function stepEvents(dt, t) {
    eventClock -= dt;
    if (eventClock <= 0) { eventClock = 40 + Math.random() * 40; spawnEvent(); }
    for (let i = cityEvents.length - 1; i >= 0; i--) {
        const e = cityEvents[i];
        e.left -= dt;
        if (e.left <= 0 || !buildingAt(e.c, e.r)) { dropEvent(e); continue; }
        e.sprite.position.y = e.y + (MOVERS_OFF ? 0 : Math.sin(t * 4 + i) * 0.06);
        e.sprite.material.opacity = Math.min(1, e.left / 3);
    }
}

// --- חגיגה עירונית: מופע זיקוקים מעל העיר. התושבים משאירים מטבעות, ואפשר שוב אחרי כמה דקות ---
const FEST_MS = 5 * 60 * 1000;
const FIRE_COLORS = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb', '#ffffff'];
let festShow = 0;      // כמה שניות נשארו למופע
let festClock = 0;
function festWait() { return Math.max(0, festAt + FEST_MS - Date.now()); }
function updateFestBtn() {
    const btn = $('festBtn');
    if (!btn) return;
    const wait = festWait();
    btn.textContent = wait > 0 ? `🎆 בעוד ${Math.ceil(wait / 60000)} דק׳` : '🎆 חגיגה';
    btn.classList.toggle('wait', wait > 0);
}
function runFestival() {
    const pop = stats().pop;
    if (pop < RANKS[0].pop) return feedback(`חגיגה עירונית אפשר לערוך מדרגת ${RANKS[0].name} (${RANKS[0].pop} תושבים)`);
    const wait = festWait();
    if (wait > 0) return feedback(`הזיקוקים עוד לא מוכנים. נסו שוב בעוד ${Math.ceil(wait / 60000)} דקות`);
    if (!W) return feedback('אי אפשר לערוך חגיגה עכשיו');
    const tips = 3 + 2 * RANKS.filter(k => pop >= k.pop).length;
    festAt = Date.now();
    W.earn(tips, { reason: 'חגיגה עירונית', silent: true });
    saveState();
    festShow = 9;
    movers.forEach(m => { if (m.kind === 'person') startAction(m, 'jump', 6 + Math.random() * 2); });
    floatText(entranceC, entranceR, `+${tips} 🪙`, 'gain');
    feedback(`🎆 איזו חגיגה! התושבים השאירו ${tips} 🪙`);
    updateFestBtn();
}
function stepFestival(dt) {
    if (festShow <= 0) return;
    festShow -= dt;
    festClock -= dt;
    if (festClock > 0 || festShow < 1) return;
    festClock = 0.4;
    const c = controls.target;
    fireworkAt(c.x + (Math.random() - 0.5) * 7, 2.6 + Math.random() * 2, c.z + (Math.random() - 0.5) * 5);
}
function fireworkAt(x, y, z) {
    const col = pickRandom(FIRE_COLORS);
    for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * Math.PI * 0.8, sp = 1.4 + Math.random() * 0.8;
        spawnPuff(x, y, z, { col, glow: true, life: 1.1 + Math.random() * 0.4, vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp + 0.6, vz: Math.sin(a) * Math.cos(e) * sp, grow: 0.3, a: 1, g: 1.6, big: 1.6 });
    }
}

// --- סיור בעיר: המצלמה נוסעת עם מכונית (או הולכת עם תושב) ברחובות ---
let tourOn = false;
let tourM = null;
let tourLeft = 0;
const tourPrev = window.THREE ? new THREE.Vector3() : null;
const tourDir = window.THREE ? new THREE.Vector3(0, 0, 1) : null;
function setTour(on) {
    if (!controls) return;
    if (on) {
        const cars = movers.filter(m => m.kind === 'car');
        const list = cars.length ? cars : movers;
        if (!list.length) return feedback('כדי לצאת לסיור צריך כמה כבישים מחוברים בעיר, עם אנשים ומכוניות');
        tourM = pickRandom(list);
        tourPrev.copy(tourM.g.position);
        tourLeft = 30;
        hoverMesh.visible = false;
        selCell = null;
        renderSel();
        feedback(tourM.kind === 'car' ? '🚌 יוצאים לסיור! אתם נוסעים ברחובות העיר' : '🚶 יוצאים לסיור רגלי בעיר');
    } else if (tourOn) {
        fitCamera();
    }
    tourOn = on;
    controls.enabled = !on;
    const btn = $('tourBtn');
    btn.textContent = on ? '⏹ סיום הסיור' : '🚌 סיור';
    btn.classList.toggle('on', on);
}
function stepTour(dt) {
    tourLeft -= dt;
    if (tourLeft <= 0 || !movers.includes(tourM)) return setTour(false);
    const pos = tourM.g.position;
    fxTmp.copy(pos).sub(tourPrev);
    if (fxTmp.lengthSq() > 1e-8) tourDir.lerp(fxTmp.normalize(), 0.08).normalize();
    tourPrev.copy(pos);
    const car = tourM.kind === 'car';
    fxTmp.copy(pos).addScaledVector(tourDir, car ? -0.75 : -0.5);
    fxTmp.y = car ? 0.5 : 0.42;
    camera.position.lerp(fxTmp, 0.12);
    controls.target.copy(pos);
    camera.lookAt(pos.x + tourDir.x * 1.5, 0.2, pos.z + tourDir.z * 1.5);
}

// --- אפקטים: יום ולילה, עשן מארובות, קפיצה של מבנה חדש, אבק ומספרים צפים ---
const NIGHT_KEY = 'kidlearn-city-night';   // העדפת תצוגה בלבד, נשמרת במכשיר
let night = false;
try { night = localStorage.getItem(NIGHT_KEY) === '1'; } catch (e) { /* בלי אחסון: נשארים ביום */ }
let nightK = night ? 1 : 0;   // 0 = יום, 1 = לילה. משתנה בהדרגה
let nightApplied = -1;
const pops = [];              // מבנים שקופצים עכשיו לגודל המלא
const puffs = [];             // עשן ואבק
let smokeClock = 0;
const fxTmp = window.THREE ? new THREE.Vector3() : null;

function makeStars() {
    const pos = [];
    for (let i = 0; i < 260; i++) {
        const a = rnd(i, 31) * Math.PI * 2, e = 0.12 + rnd(i, 32) * 1.3;
        pos.push(Math.cos(a) * Math.cos(e) * 90, Math.sin(e) * 90, Math.sin(a) * Math.cos(e) * 90);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    stars.visible = false;
    return stars;
}

function applyNight(k) {
    const mix = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), k);
    const top = mix('#58b7ff', '#0a1030'), low = mix('#e3f5ff', '#33406e');
    const grad = skyCtx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, top.getStyle()); grad.addColorStop(1, low.getStyle());
    skyCtx.fillStyle = grad; skyCtx.fillRect(0, 0, 4, 256);
    scene.background.needsUpdate = true;
    scene.fog.color.copy(low).convertSRGBToLinear();
    cityHemi.intensity = 0.95 - 0.42 * k;
    citySun.intensity = 1.5 - 1.1 * k;
    citySun.color.copy(mix('#fff1d0', '#9db4ff')).convertSRGBToLinear();
    cityStars.material.opacity = k;
    cityStars.visible = k > 0.01;
    if (cityClouds[0]) cityClouds[0].children[0].material.opacity = 0.9 - 0.55 * k;
    // בלילה החלונות נדלקים והפנסים מתחזקים
    const glow = new THREE.Color('#ffd98a').convertSRGBToLinear();
    CityKit.FX.glass.forEach(m => { m.emissive.copy(glow); m.emissiveIntensity = k * 0.9; });
    CityKit.FX.lights.forEach(m => { m.emissiveIntensity = m.userData.base + k * 1.3; });
}

function setNight(on) {
    night = on;
    try { localStorage.setItem(NIGHT_KEY, on ? '1' : '0'); } catch (e) { /* לא נורא */ }
    const btn = $('nightBtn');
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('on', on);
    btn.textContent = on ? '☀️ יום' : '🌙 לילה';
    if (MOVERS_OFF) nightK = on ? 1 : 0;
}

function spawnPuff(x, y, z, o) {
    if (MOVERS_OFF || !scene) return;
    let p = puffs.find(q => q.life <= 0);
    if (!p) {
        if (puffs.length >= 170) return;
        const mesh = new THREE.Mesh(icoG(0.035), new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, opacity: 0, depthWrite: false }));
        scene.add(mesh);
        p = { mesh };
        puffs.push(p);
    }
    Object.assign(p, { life: o.life, max: o.life, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, grow: o.grow, a: o.a, g: o.g || 0, big: o.big || 1 });
    p.mesh.material.color.set(o.col).convertSRGBToLinear();
    p.mesh.material.emissive.copy(p.mesh.material.color);
    p.mesh.material.emissiveIntensity = o.glow ? 1.6 : 0;
    p.mesh.position.set(x, y, z);
    p.mesh.visible = true;
}

// ענן אבק קטן סביב החלקה (בבנייה ובהריסה)
function dustAt(c, r) {
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + Math.random() * 0.5;
        spawnPuff(c + Math.cos(a) * 0.25, 0.06, r + Math.sin(a) * 0.25,
            { col: '#e8dcc0', life: 0.7, vx: Math.cos(a) * 0.5, vy: 0.25, vz: Math.sin(a) * 0.5, grow: 2.2, a: 0.7 });
    }
}

// הדבר החדש בחלקה קופץ מהקרקע לגודל המלא
function popCell(c, r) {
    dustAt(c, r);
    if (MOVERS_OFF) return;
    const g = groups.get(key(c, r));
    const o = g && g.userData.pop;
    if (!o) return;
    pops.push({ o, base: o.scale.clone(), t: 0 });
    o.scale.multiplyScalar(0.01);
}

// מספר שצף מעל חלקה (כמה שילמתם או קיבלתם)
function floatText(c, r, text, cls) {
    if (!camera || !renderer) return;
    const v = new THREE.Vector3(c, 0.7, r).project(camera);
    if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) return;
    const cv = renderer.domElement;
    const el = document.createElement('div');
    el.className = 'float-text ' + cls;
    el.textContent = text;
    el.style.left = (cv.offsetLeft + (v.x + 1) / 2 * cv.clientWidth) + 'px';
    el.style.top = (cv.offsetTop + (1 - v.y) / 2 * cv.clientHeight) + 'px';
    cv.closest('.scene-wrap').appendChild(el);
    setTimeout(() => el.remove(), 1300);
}

function stepFX(dt, t) {
    // יום ולילה
    const target = (night || festShow > 0) ? 1 : 0;   // בזמן חגיגה יורד לילה לכמה שניות
    if (nightK !== target) nightK = target > nightK ? Math.min(1, nightK + dt * 1.2) : Math.max(0, nightK - dt * 1.2);
    if (nightK !== nightApplied) { applyNight(nightK); nightApplied = nightK; }
    cityStars.position.copy(controls.target);
    // הבהוב עדין של הסמן, וסימני "אין דרך" שקופצים
    if (!MOVERS_OFF) hoverMesh.material.opacity = 0.38 + 0.12 * Math.sin(t * 5);
    const fx = CityKit.FX;
    if (!MOVERS_OFF) {
        fx.spinners.forEach(s => { s.o.rotation[s.axis] += s.speed * dt; });
        fx.bobbers.forEach(b => { b.o.position.y = b.y + b.a * Math.sin(t * b.sp + b.ph); });
        // עשן מהארובות
        smokeClock -= dt;
        if (smokeClock <= 0 && fx.chimneys.length) {
            smokeClock = 0.3;
            const n = Math.min(4, Math.ceil(fx.chimneys.length / 5));
            for (let i = 0; i < n; i++) {
                pickRandom(fx.chimneys).getWorldPosition(fxTmp);
                spawnPuff(fxTmp.x, fxTmp.y + 0.03, fxTmp.z,
                    { col: nightK > 0.5 ? '#9aa0b4' : '#f4f4f4', life: 2.2, vx: 0.05, vy: 0.2, vz: 0.02, grow: 1.8, a: 0.55 });
            }
        }
    }
    puffs.forEach(p => {
        if (p.life <= 0) return;
        p.life -= dt;
        if (p.life <= 0) { p.mesh.visible = false; return; }
        const k = 1 - p.life / p.max;
        p.vy -= p.g * dt;
        p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt;
        p.mesh.scale.setScalar(p.big * (1 + k * p.grow));
        p.mesh.material.opacity = p.a * (1 - k);
    });
    for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i];
        p.t += dt / 0.45;
        const x = Math.min(1, p.t) - 1;
        const s = 1 + 2.7 * x * x * x + 1.7 * x * x;   // קפיצה קטנה מעבר לגודל, וחזרה
        p.o.scale.copy(p.base).multiplyScalar(Math.max(0.01, s));
        if (p.t >= 1) pops.splice(i, 1);
    }
}

// --- התחלה ---
loadState();
if (!init3D()) {
    feedback('אי אפשר להציג את העיר בתלת-ממד במכשיר הזה.');
}
if (W) {
    W.onChange((bal) => {
        $('balance').textContent = bal;
        renderCatalog();
        renderSel();
    });
} else {
    $('balance').textContent = 0;
}
$('centerBtn').onclick = () => fitCamera();
$('deleteBtn').onclick = () => setDeleteMode(!deleteMode);
$('nightBtn').onclick = () => setNight(!night);
$('festBtn').onclick = () => runFestival();
$('tourBtn').onclick = () => setTour(!tourOn);
$('citySel').onclick = (e) => { const b = e.target.closest('[data-act]'); if (b) onSelAct(b.dataset.act); };
setInterval(updateFestBtn, 15000);
setNight(night);
if (window.KidLearn && KidLearn.onAuthChange) {
    KidLearn.onAuthChange((profile) => { if (profile) cloudSync(); });
}
renderAll();
// מסים אוטומטיים: כסף שנצבר בזמן שהילד לא בעיר (עד 3 שעות) משולם בכניסה, וגם כשחוזרים ללשונית
if (payOffline() > 0) feedback('ברוכים השבים!');
document.addEventListener('visibilitychange', () => {
    if (document.hidden) { touchTax(); return; }
    if (payOffline() > 0) feedback('ברוכים השבים!');
    renderAll();
});
window.addEventListener('pagehide', touchTax);
window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    loadState();
    redrawAll();
    if (payOffline() > 0) feedback('ברוכים השבים!');
});
