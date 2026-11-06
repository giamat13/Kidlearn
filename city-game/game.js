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
// המחירים והפרסים נגזרים מ-REWARDS כדי להישאר בפרופורציה לשאר המשחקים.

const START_COLS = 5;      // השטח ההתחלתי: 5 על 4 חלקות
const START_ROWS = 4;
const STORE_KEY = 'kidlearn-city-v2';
const OLD_STORE_KEY = 'kidlearn-city';   // הגרסה הקודמת (רשת קבועה 5×4), לצורך מעבר חלק
const MERGE_MAX = 5;                     // מקסימום בתי ספר שמתאחדים לאחד
const DECOR_MAX = 7;                     // מקסימום עצים וקישוטים בחלקה אחת
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
    { id: 'stone',      cat: 'road',   name: 'שביל אבן',    icon: '🪨', price: cheap(R.answer * 2),    eco: 0,    love: 'השביל המרוצף בחלוקי נחל נראה מדהים', desc: 'שביל מרוצף בחלוקי נחל' },

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
    { id: 'prison', cat: 'civic', name: 'כלא', icon: '🔒', price: cheap(R.round * 3), eco: 0, love: 'בכלא שומרים על כולם בטוחים', desc: 'מקום שבו מי שעבר עבירה מרצה עונש' },
    { id: 'park',       cat: 'park',   name: 'פארק',        icon: '🏞️', price: cheap(R.level),         eco: 2,    love: 'הפארק הוא המקום שאנחנו הכי אוהבים', desc: 'מקום לטיולים ולשחק' },
    { id: 'garden',     cat: 'park',   name: 'גינה קטנה',   icon: '🌷', price: cheap(R.create),        eco: 1.5,  love: 'הגינה הקטנה מלאה פרחים וריח טוב', desc: 'פרחים וספסל' },
    { id: 'playground', cat: 'park',   name: 'גן שעשועים',  icon: '🛝', price: cheap(R.level),         eco: 1,    love: 'בגן השעשועים הילדים משחקים כל היום', desc: 'מגלשה ונדנדה' },

    { id: 'zoo',        cat: 'attr',   name: 'גן חיות',     icon: '🦁', price: cheap(R.round * 10),    eco: 0.5,  love: 'בגן החיות אפשר לראות חיות מכל העולם', desc: 'יש כניסה למשחק: קונים חיות ומרוויחים מכרטיסים' },
    { id: 'amusement', cat: 'attr',   name: 'לונה פארק',   icon: '🎡', price: cheap(R.round * 12),    eco: -0.5, love: 'בלונה פארק כיף לעלות על המתקנים', desc: 'יש כניסה למשחק: קונים מתקנים ומרוויחים מכרטיסים' },

    { id: 'bench',      cat: 'props', name: 'ספסל',        icon: '🪑', price: cheap(R.answer),        eco: 0,    size: 0.6,  love: 'כיף לשבת על הספסל ולנוח', desc: 'מקום לשבת ולנוח' },
    { id: 'fountain',   cat: 'props',  name: 'מזרקה',       icon: '⛲', price: cheap(R.create),        eco: 1,    size: 0.5,  love: 'המזרקה נעימה לשמוע', desc: 'מים שזורמים במרכז' },
    { id: 'tap',        cat: 'props',  name: 'ברזייה',      icon: '🚰', price: cheap(R.answer),        eco: 0.5,  size: 0.8,  love: 'הברזייה מאפשרת לשתות מים קרים', desc: 'ברז מים לשתייה' },
    { id: 'lamp',       cat: 'props',  name: 'פנס רחוב',    icon: '🪔', price: cheap(R.answer),        eco: 0,    size: 0.7,  love: 'פנסי הרחוב מאירים לנו בערב', desc: 'מאיר בערב' },
    { id: 'bin',        cat: 'props',  name: 'פח אשפה',     icon: '🗑️', price: cheap(R.smallSuccess),  eco: 1,    size: 0.8,  love: 'בזכות פחי האשפה העיר נקייה', desc: 'שומר על העיר נקייה' },
    { id: 'flowers',    cat: 'props',  name: 'ערוגת פרחים', icon: '💐', price: cheap(R.answer),        eco: 1,    size: 0.6,  love: 'ערוגת הפרחים מצבעת את העיר', desc: 'צבעים לעיר' },
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

// מקומות לעצים וקישוטים בתוך חלקה אחת (לפי סדר ההוספה). קודם המרכז, אחר כך הפינות
const DECOR_SLOTS = [[0, 0], [-0.26, -0.26], [0.26, 0.26], [0.26, -0.26], [-0.26, 0.26], [0, -0.26], [0, 0.26]];

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
// decor:     Map של "c,r" -> רשימת מזהים של עצים וקישוטים (עד DECOR_MAX, לפי סדר ההוספה)
// met:       דרישות התושבים והמדדים שכבר נענו (כל אחד מזכה בכסף פעם אחת)
let owned = new Set();
let buildings = new Map();
let decor = new Map();
let met = [];
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
        if (isDecorVariant(v)) decor.set(k, [...(decor.get(k) || []), id].slice(0, DECOR_MAX));
        else buildings.set(k, id);
    }
}

function loadStateRaw() {
    entranceC = 0;
    entranceR = 1;
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
                        .slice(0, DECOR_MAX);
                    if (list.length) decor.set(k, list);
                }
            }
            met = Array.isArray(saved.met) ? saved.met : [];
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
        pop += v.pop || 0;
        active[v.cat] = (active[v.cat] || 0) + 1;
        byId[v.id] = (byId[v.id] || 0) + 1;
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
const BUILDING_TAX = { cabin: 0.05, house: 0.1, villa: 0.2, apt: 0.3, tower: 0.6, mini: 0.1, shop: 0.2, mall: 0.6 };
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
        if (BUILDING_TAX[id]) out.tax += BUILDING_TAX[id];
        if (ATTRACTIONS[id]) out.attr += attractionRate(k, id);
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
}

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
    return cached(matCache, k, () => new THREE.MeshStandardMaterial(
        Object.assign({ color, roughness: 0.8, metalness: 0 }, extra || {})
    ));
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

// --- בניית חלקה שבבעלות הילד ---
function buildCell(c, r) {
    const group = new THREE.Group();
    group.position.set(c, 0, r);
    const seed = seedOf(c, r);

    // קרקע: קובייה כהה כמסגרת, ומעליה לוח דשא קצת קטן יותר. כך רואים את גבולות החלקות
    part(group, boxG(1, 0.1, 1), '#4f8a3a', 0, -0.05, 0);
    part(group, boxG(0.96, 0.02, 0.96), GRASS[Math.floor(rnd(seed, 1) * GRASS.length)], 0, 0, 0);

    const v = variantAt(c, r);
    const cat = v ? v.cat : null;
    const list = decorAt(c, r);
    let top = 0.9;
    if (cat === 'road') buildRoad(group, c, r, v);
    if (cat === 'road' && isEntrance(c, r)) buildGate(group);
    else if (cat === 'house') top = buildHouse(group, seed, c, r, v);
    else if (cat === 'apt') top = buildApartments(group, seed, c, r, v);
    else if (cat === 'school') buildSchool(group, c, r, v);
    else if (cat === 'shop') top = buildShop(group, c, r, v);
    else if (cat === 'clinic') top = buildClinic(group, c, r, v);
    else if (cat === 'civic') top = buildCivic(group, c, r, v);
    else if (cat === 'park') buildPark(group, seed, v, parkSides(c, r));
    else if (cat === 'attr') top = buildAttraction(group, c, r, v);

    // עצים וקישוטים קטנים: כמה שיש בחלקה, כל אחד במקומו
    if (list.length) buildDecor(group, seed, list);
    else if (!cat && rnd(seed, 8) < 0.3) buildBush(group, seed);   // שיחים קטנים על שטח ריק בלבד

    // מבנה בלי דרך לא עובד: מסמנים אותו בעמוד אדום מעל הגג
    if (cat && !buildingActive(c, r)) {
        part(group, coneG(0.07, 0.16, 6), '#e53935', 0, top + 0.2, 0);
    }
    return group;
}

// חלקה למכירה: לוח דשא בהיר עם דגל צהוב
function buildSale(c, r) {
    const group = new THREE.Group();
    group.position.set(c, 0, r);
    part(group, boxG(0.94, 0.03, 0.94), '#eef8e0', 0, 0.015, 0);
    part(group, cylG(0.02, 0.02, 0.45, 5), '#8d6e63', -0.3, 0.22, -0.3);
    part(group, boxG(0.22, 0.14, 0.02), '#ffca28', -0.2, 0.4, -0.3);
    return group;
}

// דרך: ריבוע מרכזי + זרוע לכל שכנה שהיא דרך. הזרועות מגיעות עד שפת החלקה,
// ולכן דרך מחוברת בדיוק לדרך שלידה (גם אם הסוגים שונים)
function buildRoad(group, c, r, v) {
    const style = {
        road:   { base: '#41444f', dashes: true },
        dirt:   { base: '#b08968', dashes: false },
        stone:  { base: '#bdbdbd', dashes: false },
    }[v.id];
    const LINE = '#f5f5f5';
    const y = 0.012;
    part(group, boxG(0.42, 0.024, 0.42), style.base, 0, y, 0);

    for (const d of DIRS) {
        const outside = isEntrance(c, r) && d.name === 'W';   // הכביש ממשיך החוצה
        if (!roadAt(c + d.dc, r + d.dr) && !outside) continue;
        const sx = d.dc !== 0 ? 0.5 : 0.42;
        const sz = d.dr !== 0 ? 0.5 : 0.42;
        part(group, boxG(sx, 0.024, sz), style.base, d.dc * 0.25, y, d.dr * 0.25);
        if (style.dashes) {
            // קו הפרדה מקווקו באמצע הזרוע
            const lx = d.dc !== 0 ? 0.12 : 0.03;
            const lz = d.dr !== 0 ? 0.12 : 0.03;
            part(group, boxG(lx, 0.006, lz), LINE, d.dc * 0.36, y + 0.015, d.dr * 0.36);
        }
    }

    // פרטים לפי סוג: חלוקי נחל בשביל האבן, אבנים קטנות בדרך העפר
    if (v.id === 'stone') {
        [[-0.12, -0.1, '#9e9e9e'], [0.1, -0.12, '#8d8d8d'], [0.02, 0.04, '#a1887f'], [-0.09, 0.11, '#8d8d8d'], [0.12, 0.09, '#9e9e9e']]
            .forEach(([x, z, col]) => part(group, icoG(0.035), col, x, 0.026, z));
    } else if (v.id === 'dirt') {
        [[-0.1, 0.05, '#8d6e63'], [0.12, -0.08, '#8d6e63'], [0.03, 0.13, '#795548']]
            .forEach(([x, z, col]) => part(group, icoG(0.022), col, x, 0.02, z));
    }
}

// עץ או דקל. בחלקה יכולים להיות כמה, לכן גודלם נקבע לפי VARIANTS.size
function buildTree(group, seed, v) {
    const s = 0.9 + rnd(seed, 2) * 0.3;
    const ox = (rnd(seed, 3) - 0.5) * 0.25;
    const oz = (rnd(seed, 4) - 0.5) * 0.25;
    if (v.id === 'palm') {
        // דקל: גזע דק, כמה עלים ארוכים שנפרשים לכל הכיוונים, וקוקוס
        part(group, cylG(0.03, 0.05, 0.55, 7), '#a1887f', ox, 0.275, oz);
        for (let k = 0; k < 4; k++) {
            const frond = part(group, icoG(0.16), '#388e3c', ox, 0.58, oz);
            frond.scale.set(1.6, 0.22, 0.45);
            frond.rotation.y = k * Math.PI / 2 + rnd(seed, 12) * 0.5;
        }
        part(group, icoG(0.04), '#795548', ox + 0.02, 0.54, oz + 0.02);
        return;
    }
    // עץ רגיל: גזע מחודד, וכתר של שלושה כדורים שמתלכדים, כל אחד בגוון קצת אחר
    const base = v.id === 'blossom' ? '#f48fb1' : FOLIAGE[Math.floor(rnd(seed, 5) * FOLIAGE.length)];
    part(group, cylG(0.045, 0.07, 0.32, 8), '#6d4c41', ox, 0.16, oz);
    part(group, icoG(0.23), base, ox, 0.46, oz).scale.setScalar(s);
    part(group, icoG(0.15), tint(base, 1.14), ox + 0.12 * s, 0.38, oz - 0.07 * s).scale.setScalar(s);
    part(group, icoG(0.14), tint(base, 0.88), ox - 0.11 * s, 0.36, oz + 0.09 * s).scale.setScalar(s);
}

function buildBush(group, seed) {
    const ox = (rnd(seed, 9) - 0.5) * 0.6;
    const oz = (rnd(seed, 10) - 0.5) * 0.6;
    const b = part(group, icoG(0.12), BUSH[Math.floor(rnd(seed, 11) * BUSH.length)], ox, 0.09, oz);
    b.scale.set(1, 0.8, 1);
}

// עצים וקישוטים בחלקה: כל פריט בקטן ובמקום שלו (לפי DECOR_SLOTS), עם מעט אקראיות קבועה
function buildDecor(group, seed, ids) {
    ids.forEach((id, i) => {
        const v = VARIANT_BY_ID[id];
        if (!v) return;
        const [sx, sz] = DECOR_SLOTS[i];
        const g = new THREE.Group();
        g.position.set(sx + (rnd(seed, 40 + i) - 0.5) * 0.06, 0, sz + (rnd(seed, 50 + i) - 0.5) * 0.06);
        g.rotation.y = rnd(seed, 60 + i) * Math.PI * 2;
        g.scale.setScalar(v.size || 0.6);
        group.add(g);
        const itemSeed = seed + (i + 1) * 17;   // זרע משלו לכל פריט, כדי שכל עץ ייראה קצת אחרת
        if (v.cat === 'tree') buildTree(g, itemSeed, v);
        else buildProp(g, itemSeed, v);
    });
}

// שביל קצר מהכניסה אל הדרך (רק אם יש דרך סמוכה)
function addDoorPath(parent, hasRoad, frontZ) {
    if (!hasRoad) return;
    const start = frontZ - 0.02;
    const len = 0.5 - start;
    part(parent, boxG(0.14, 0.01, len), '#d7ccc8', 0, 0.005, start + len / 2);
}

// בתים: בית רגיל, בקתה קטנה או וילה. ההבדל הוא במידות ובצבעים
function buildHouse(group, seed, c, r, v) {
    const dims = {
        house:  { w: 0.56, h: 0.42, rh: 0.30, wall: HOUSE_WALLS[Math.floor(rnd(seed, 6) * HOUSE_WALLS.length)], roof: HOUSE_ROOFS[Math.floor(rnd(seed, 7) * HOUSE_ROOFS.length)] },
        cabin:  { w: 0.44, h: 0.32, rh: 0.26, wall: '#a1887f', roof: '#5d4037' },
        villa:  { w: 0.70, h: 0.50, rh: 0.34, wall: '#fff8e1', roof: '#8d6e63' },
    }[v.id];
    const b = new THREE.Group();
    b.rotation.y = facingRot(c, r);
    const half = dims.w / 2;
    const front = half + 0.005;

    part(b, boxG(dims.w, dims.h, dims.w), dims.wall, 0, dims.h / 2, 0);
    const roof = part(b, coneG(dims.w * 0.72, dims.rh, 4), dims.roof, 0, dims.h + dims.rh / 2, 0);
    roof.rotation.y = Math.PI / 4;   // פינות הגג באלכסון, כדי שהצלעות יתיישרו עם הקירות
    part(b, boxG(0.08, 0.2, 0.08), '#8d6e63', dims.w * 0.27, dims.h + 0.18, -dims.w * 0.18);   // ארובה

    // חלונות עם מסגרת לבנה (צלב), ודלת במסגרת
    const win = (x, y) => {
        part(b, boxG(0.13, 0.13, 0.02), '#90caf9', x, y, front, { roughness: 0.3 });
        part(b, boxG(0.13, 0.014, 0.024), '#ffffff', x, y, front + 0.002);
        part(b, boxG(0.014, 0.13, 0.024), '#ffffff', x, y, front + 0.002);
    };
    win(-dims.w * 0.28, 0.27);
    win(dims.w * 0.28, 0.27);
    part(b, boxG(0.17, 0.25, 0.012), '#fff3e0', 0, 0.125, front);       // מסגרת הדלת
    part(b, boxG(0.12, 0.2, 0.02), '#6d4c41', 0, 0.1, front + 0.006);   // דלת
    part(b, icoG(0.012), '#ffca28', 0.04, 0.1, front + 0.02);            // ידית

    if (v.id === 'villa') {
        // עמודים לפני הכניסה
        part(b, boxG(0.04, 0.4, 0.04), '#ffffff', -0.14, 0.2, front + 0.05);
        part(b, boxG(0.04, 0.4, 0.04), '#ffffff', 0.14, 0.2, front + 0.05);
    }
    addDoorPath(b, roadNextTo(c, r), front);
    group.add(b);
    return dims.h + dims.rh;
}

// בניין דירות (קטן) או מגדל דירות: שורות חלונות ומרפסות לפי מספר הקומות
function buildApartments(group, seed, c, r, v) {
    const tower = v.id === 'tower';
    const w = tower ? 0.44 : 0.5;
    const h = tower ? 1.25 : 0.85;
    const floors = tower ? 7 : 4;
    const wall = HOUSE_WALLS[Math.floor(rnd(seed, 6) * HOUSE_WALLS.length)];
    const b = new THREE.Group();
    b.rotation.y = facingRot(c, r);
    const front = w / 2 + 0.005;
    part(b, boxG(w, h, w), wall, 0, h / 2, 0);
    part(b, boxG(w + 0.04, 0.05, w + 0.04), '#6d4c41', 0, h + 0.025, 0);   // גג
    for (let row = 0; row < floors; row++) {
        const y = 0.12 + row * 0.16;
        part(b, boxG(w + 0.03, 0.02, 0.06), '#b0bec5', 0, y - 0.075, front + 0.02);   // מרפסת
        for (const x of [-w * 0.24, w * 0.24]) part(b, boxG(0.1, 0.1, 0.02), '#90caf9', x, y, front, { roughness: 0.3 });
    }
    part(b, boxG(0.14, 0.2, 0.02), '#6d4c41', 0, 0.1, front);   // דלת
    addDoorPath(b, roadNextTo(c, r), front);
    group.add(b);
    return h + 0.05;
}

// חנות: גג בצבעי פסים לפי הסוג, שלט מעל הכניסה, וחלונות ראווה משני צדי הדלת
const SHOP_STYLE = {
    shop:  { w: 0.70, h: 0.42, body: '#ffe082', awn: ['#ef5350', '#ffffff', '#ef5350'] },
    mini:  { w: 0.56, h: 0.34, body: '#c5e1a5', awn: ['#43a047', '#ffffff'] },
    mall:  { w: 0.80, h: 0.50, body: '#e1bee7', awn: ['#ab47bc', '#ffffff', '#ab47bc', '#ffffff'] },
};
function buildShop(group, c, r, v) {
    const st = SHOP_STYLE[v.id];
    const b = new THREE.Group();
    b.rotation.y = facingRot(c, r);
    const depth = 0.6;
    const front = depth / 2 + 0.005;
    part(b, boxG(st.w, st.h, depth), st.body, 0, st.h / 2, 0);
    const n = st.awn.length;
    st.awn.forEach((color, i) => {
        const x = -st.w / 2 + (i + 0.5) * (st.w / n);
        part(b, boxG(st.w / n, 0.1, 0.08), color, x, st.h - 0.06, front + 0.03);
    });
    [-1, 1].forEach(sg => part(b, boxG(st.w * 0.22, 0.14, 0.02), '#b3e5fc', sg * st.w * 0.27, 0.2, front, { roughness: 0.3 }));
    part(b, boxG(st.w * 0.55, 0.1, 0.02), '#8d6e63', 0, st.h + 0.08, front);   // שלט
    part(b, boxG(0.16, 0.2, 0.02), '#6d4c41', 0, 0.1, front);                  // דלת
    addDoorPath(b, roadNextTo(c, r), front);
    group.add(b);
    return st.h + 0.12;
}

// מרפאה: בניין לבן עם צלב אדום. בית חולים גבוה יותר עם שני צלבים
function buildClinic(group, c, r, v) {
    const hosp = v.id === 'hospital';
    const w = 0.7;
    const h = hosp ? 0.85 : 0.5;
    const b = new THREE.Group();
    b.rotation.y = facingRot(c, r);
    const front = w / 2 + 0.005;
    part(b, boxG(w, h, w), hosp ? '#eceff1' : '#ffffff', 0, h / 2, 0);
    part(b, boxG(w + 0.02, 0.04, w + 0.02), '#90a4ae', 0, h + 0.02, 0);
    const crossAt = hosp ? [-0.17, 0.17] : [0];
    const cs = hosp ? 0.2 : 0.34;
    crossAt.forEach(x => {
        part(b, boxG(cs, cs * 0.24, 0.02), '#e53935', x, h * 0.72, front);
        part(b, boxG(cs * 0.24, cs, 0.02), '#e53935', x, h * 0.72, front);
    });
    part(b, boxG(0.16, 0.22, 0.02), '#6d4c41', 0, 0.11, front);   // דלת
    addDoorPath(b, roadNextTo(c, r), front);
    group.add(b);
    return h + 0.04;
}

// שירותי עיר: משטרה, כבאים, אמבולנס, דואר וספרייה. לכל אחד מבנה וצבעים משלו
const CIVIC_STYLE = {
    police:    { w: 0.72, h: 0.5,  body: '#eceff1', roof: '#1e4fa3' },
    fire:      { w: 0.8,  h: 0.45, body: '#ef5350', roof: '#8e0000' },
    ambulance: { w: 0.7,  h: 0.46, body: '#ffffff', roof: '#90a4ae' },
    post:      { w: 0.7,  h: 0.42, body: '#ffd54f', roof: '#c62828' },
    library:   { w: 0.72, h: 0.44, body: '#d7ccc8', roof: '#6d4c41' },
    university: { w: 0.8, h: 0.55, body: '#8d6e63', roof: '#4e342e' },
    court:     { w: 0.76, h: 0.5, body: '#f5f5f5', roof: '#6d4c41' },
    prison:    { w: 0.74, h: 0.42, body: '#78909c', roof: '#37474f' },
};
function buildCivic(group, c, r, v) {
    const st = CIVIC_STYLE[v.id];
    const b = new THREE.Group();
    b.rotation.y = facingRot(c, r);
    const h = st.h;
    const front = st.w / 2 + 0.005;
    let top = h + 0.04;
    part(b, boxG(st.w, h, st.w), st.body, 0, h / 2, 0);
    if (v.id === 'library' || v.id === 'court') {
        // גג משולש (פירמידה) ושני עמודים בחזית
        part(b, coneG(st.w * 0.72, 0.2, 4), st.roof, 0, h + 0.1, 0).rotation.y = Math.PI / 4;
        [-0.26, 0.26].forEach(x => part(b, cylG(0.03, 0.03, h * 0.9, 8), '#ffffff', x, h * 0.45, front));
        top = h + 0.2;
    } else {
        part(b, boxG(st.w + 0.02, 0.04, st.w + 0.02), st.roof, 0, h + 0.02, 0);
    }

    if (v.id === 'police') {
        // פס לבן ופנס כחול על הגג
        part(b, boxG(st.w * 0.92, 0.05, 0.02), '#ffffff', 0, h * 0.62, front);
        part(b, boxG(0.16, 0.08, 0.12), '#42a5f5', 0, h + 0.08, 0, { emissive: '#42a5f5', emissiveIntensity: 0.5 });
        top = h + 0.12;
    } else if (v.id === 'fire') {
        // מגדל ייבוש צינורות ופתח גדול לרכבי הכיבוי
        part(b, cylG(0.08, 0.08, 0.62, 10), '#ffcdd2', 0.2, h + 0.31, -0.2);
        part(b, boxG(st.w * 0.5, h * 0.55, 0.02), '#37474f', 0, h * 0.28, front);
        top = h + 0.62;
    } else if (v.id === 'ambulance') {
        // צלב אדום ופתח גדול לאמבולנס
        part(b, boxG(0.24, 0.06, 0.02), '#e53935', 0, h * 0.7, front);
        part(b, boxG(0.06, 0.22, 0.02), '#e53935', 0, h * 0.7, front);
        part(b, boxG(st.w * 0.5, h * 0.5, 0.02), '#90a4ae', 0, h * 0.25, front);
    } else if (v.id === 'post') {
        // שלט דואר וקופסת דואר אדומה בחזית
        part(b, boxG(0.3, 0.07, 0.02), '#1565c0', 0, h * 0.72, front);
        part(b, boxG(0.12, 0.16, 0.12), '#e53935', 0.27, 0.08, front + 0.05);
    } else if (v.id === 'prison') {
        // חלונות קטנים עם סורגים כהים בחזית
        [-0.22, 0, 0.22].forEach(x => {
            part(b, boxG(0.1, 0.08, 0.02), '#cfd8dc', x, h * 0.6, front);
            part(b, boxG(0.02, 0.08, 0.03), '#263238', x, h * 0.6, front + 0.01);
        });
    } else if (v.id === 'university') {
        // חלונות גדולים ודגל כחול על הגג
        [-0.22, 0, 0.22].forEach(x => part(b, boxG(0.1, 0.12, 0.02), '#e3f2fd', x, h * 0.55, front));
        part(b, cylG(0.01, 0.01, 0.3, 5), '#eeeeee', 0, h + 0.17, 0);
        part(b, boxG(0.12, 0.07, 0.01), '#1e88e5', 0.06, h + 0.25, 0);
        top = h + 0.32;
    } else {
        // ספרייה ובית משפט: שלט קטן מעל הדלת
        part(b, boxG(0.3, 0.06, 0.02), '#8d6e63', 0, h * 0.72, front);
    }

    // לרכבים יש פתח משלו. לשאר יש דלת רגילה
    if (v.id !== 'fire' && v.id !== 'ambulance') part(b, boxG(0.16, 0.22, 0.02), '#6d4c41', 0, 0.11, front);
    addDoorPath(b, roadNextTo(c, r), front);
    group.add(b);
    return top;
}

// אטרקציה: גן חיות (גדר, שער וחיות) או לונה פארק (גלגל ענק ואוהל). השער פונה לדרך
function torusG(r, tube) { return cached(geoCache, `t${r}|${tube}`, () => new THREE.TorusGeometry(r, tube, 6, 20)); }
function buildAttraction(group, c, r, v) {
    const b = new THREE.Group();
    b.rotation.y = facingRot(c, r);
    const front = 0.44;
    let top = 0.5;
    if (v.id === 'zoo') {
        part(b, boxG(0.9, 0.02, 0.9), '#a5d6a7', 0, 0.01, 0);
        // גדר סביב, עם פתח בחזית
        const wood = '#8d6e63';
        part(b, boxG(0.9, 0.12, 0.03), wood, 0, 0.07, -0.44);
        part(b, boxG(0.03, 0.12, 0.9), wood, -0.44, 0.07, 0);
        part(b, boxG(0.03, 0.12, 0.9), wood, 0.44, 0.07, 0);
        part(b, boxG(0.28, 0.12, 0.03), wood, -0.31, 0.07, front);
        part(b, boxG(0.28, 0.12, 0.03), wood, 0.31, 0.07, front);
        // שער עם שלט
        part(b, boxG(0.04, 0.34, 0.04), '#5d4037', -0.14, 0.17, front);
        part(b, boxG(0.04, 0.34, 0.04), '#5d4037', 0.14, 0.17, front);
        part(b, boxG(0.36, 0.08, 0.04), '#ffca28', 0, 0.36, front);
        // פיל: גוף, ראש וחדק
        part(b, icoG(0.15), '#9e9e9e', -0.2, 0.2, -0.15);
        part(b, icoG(0.09), '#9e9e9e', -0.08, 0.26, -0.15);
        part(b, cylG(0.02, 0.02, 0.12, 6), '#9e9e9e', -0.02, 0.2, -0.15).rotation.z = 1.2;
        // ג'ירפה: גוף וצוואר גבוה
        part(b, boxG(0.16, 0.1, 0.1), '#ffb300', 0.22, 0.14, -0.1);
        part(b, cylG(0.025, 0.03, 0.3, 6), '#ffb300', 0.28, 0.3, -0.1);
        part(b, icoG(0.04), '#ffb300', 0.3, 0.46, -0.1);
        // עץ קטן
        part(b, cylG(0.02, 0.025, 0.12, 6), '#6d4c41', 0.25, 0.06, 0.2);
        part(b, icoG(0.1), '#43a047', 0.25, 0.2, 0.2);
        top = 0.56;
    } else {
        part(b, boxG(0.9, 0.02, 0.9), '#e1bee7', 0, 0.01, 0);
        // גלגל ענק: טבעת, קרניים וקרונות
        const wheel = new THREE.Group();
        wheel.position.set(0.12, 0.5, -0.1);
        const ring = new THREE.Mesh(torusG(0.3, 0.02), mat('#e53935'));
        ring.castShadow = true;
        wheel.add(ring);
        for (let k = 0; k < 4; k++) {
            const spoke = new THREE.Mesh(boxG(0.6, 0.015, 0.015), mat('#fafafa'));
            spoke.rotation.z = k * Math.PI / 4;
            wheel.add(spoke);
        }
        for (let k = 0; k < 8; k++) {
            const a = k * Math.PI / 4;
            const pod = new THREE.Mesh(boxG(0.07, 0.07, 0.07), mat(['#ffca28', '#42a5f5', '#66bb6a', '#ec407a'][k % 4]));
            pod.position.set(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0);
            wheel.add(pod);
        }
        b.add(wheel);
        part(b, boxG(0.03, 0.5, 0.03), '#78909c', 0.02, 0.25, -0.1);
        part(b, boxG(0.03, 0.5, 0.03), '#78909c', 0.22, 0.25, -0.1);
        // אוהל פסים
        part(b, cylG(0.14, 0.14, 0.14, 8), '#ff7043', -0.24, 0.09, 0.14);
        part(b, coneG(0.17, 0.16, 8), '#fafafa', -0.24, 0.24, 0.14);
        // שער
        part(b, boxG(0.04, 0.34, 0.04), '#8e24aa', -0.14, 0.17, front);
        part(b, boxG(0.04, 0.34, 0.04), '#8e24aa', 0.14, 0.17, front);
        part(b, boxG(0.36, 0.08, 0.04), '#ffca28', 0, 0.36, front);
        top = 0.85;
    }
    addDoorPath(b, roadNextTo(c, r), front);
    group.add(b);
    return top;
}

// פארק, גינה קטנה או גן שעשועים
// חלקות פארק שכנות מתחברות לפארק אחד: בודקים לאילו כיוונים יש חלקת פארק שכנה
function parkSides(c, r) {
    const sides = {};
    DIRS.forEach(d => { sides[d.name] = catAt(c + d.dc, r + d.dr) === 'park'; });
    return sides;
}
function buildPark(group, seed, v, sides) {
    // הדשא מתרחב עד הקו המשותף עם השכנה, כך שאין קו בין החלקות
    const x0 = sides.W ? -0.5 : -0.45, x1 = sides.E ? 0.5 : 0.45;
    const z0 = sides.N ? -0.5 : -0.45, z1 = sides.S ? 0.5 : 0.45;
    part(group, boxG(x1 - x0, 0.02, z1 - z0), '#a5d6a7', (x0 + x1) / 2, 0.01, (z0 + z1) / 2);
    if (v.id === 'park') {
        part(group, cylG(0.2, 0.2, 0.03, 14), '#eceff1', 0, 0.015, 0);       // שפת הבריכה
        part(group, cylG(0.18, 0.18, 0.02, 14), '#4fc3f7', 0, 0.03, 0, { roughness: 0.2 });
        part(group, boxG(0.2, 0.05, 0.06), '#8d6e63', -0.3, 0.05, 0.3);
        part(group, boxG(0.2, 0.05, 0.06), '#8d6e63', 0.3, 0.05, -0.3);
        part(group, icoG(0.12), '#2e7d32', 0.3, 0.16, 0.3);
        part(group, icoG(0.1), '#43a047', -0.3, 0.14, -0.3);
    } else if (v.id === 'garden') {
        [[-0.25, -0.2, '#f06292'], [0.05, -0.28, '#ffd54f'], [0.28, -0.05, '#f06292'], [-0.1, 0.22, '#ffd54f'], [0.25, 0.25, '#ff8a65']]
            .forEach(([x, z, col]) => part(group, icoG(0.06), col, x, 0.06, z));
        part(group, boxG(0.2, 0.05, 0.06), '#8d6e63', 0.0, 0.05, 0.36);
    } else {
        // גן שעשועים: מגלשה, עמודי נדנדה וספסל תלוי
        const slide = part(group, boxG(0.12, 0.02, 0.4), '#ff7043', 0.22, 0.2, 0.05);
        slide.rotation.x = 0.45;
        part(group, boxG(0.04, 0.4, 0.04), '#ffca28', 0.12, 0.2, -0.15);
        part(group, boxG(0.03, 0.3, 0.03), '#ffca28', -0.3, 0.15, -0.2);
        part(group, boxG(0.03, 0.3, 0.03), '#ffca28', -0.2, 0.15, -0.2);
        part(group, boxG(0.14, 0.03, 0.03), '#ffca28', -0.25, 0.3, -0.2);
        part(group, boxG(0.08, 0.02, 0.06), '#5c6bc0', -0.25, 0.18, -0.2);
    }
}

// דברים קטנים: ספסל, מזרקה, ברזייה, פנס, פח ופרחים. לא צריכים דרך. נבנים בגודל קטן בתוך החלקה
function buildProp(group, seed, v) {
    const ox = (rnd(seed, 13) - 0.5) * 0.2;
    const oz = (rnd(seed, 14) - 0.5) * 0.2;
    if (v.id === 'bench') {
        part(group, boxG(0.34, 0.05, 0.12), '#8d6e63', ox, 0.14, oz);          // מושב
        part(group, boxG(0.34, 0.14, 0.03), '#6d4c41', ox, 0.24, oz - 0.07);   // משענת
        part(group, boxG(0.04, 0.14, 0.12), '#424242', ox - 0.14, 0.07, oz);   // רגליים
        part(group, boxG(0.04, 0.14, 0.12), '#424242', ox + 0.14, 0.07, oz);
    } else if (v.id === 'fountain') {
        part(group, cylG(0.3, 0.32, 0.14, 16), '#b0bec5', 0, 0.07, 0);                   // אגן
        part(group, cylG(0.26, 0.26, 0.02, 16), '#4fc3f7', 0, 0.13, 0, { roughness: 0.2 }); // מים
        part(group, cylG(0.03, 0.04, 0.22, 8), '#cfd8dc', 0, 0.25, 0);                   // עמוד
        part(group, icoG(0.05), '#e1f5fe', 0, 0.38, 0);                                  // זרם
    } else if (v.id === 'tap') {
        part(group, cylG(0.04, 0.05, 0.22, 8), '#1976d2', ox, 0.11, oz);
        part(group, boxG(0.1, 0.04, 0.04), '#1976d2', ox, 0.21, oz + 0.04);
    } else if (v.id === 'lamp') {
        part(group, cylG(0.025, 0.03, 0.6, 8), '#37474f', ox, 0.3, oz);
        part(group, icoG(0.07), '#fff59d', ox, 0.63, oz, { emissive: '#fff176', emissiveIntensity: 0.6 });
    } else if (v.id === 'bin') {
        part(group, cylG(0.07, 0.06, 0.2, 8), '#607d8b', ox, 0.1, oz);
        part(group, cylG(0.075, 0.075, 0.02, 8), '#455a64', ox, 0.21, oz);
    } else {
        // ערוגת פרחים: מסגרת עץ וכמה פרחים צבעוניים
        part(group, boxG(0.36, 0.04, 0.2), '#8d6e63', 0, 0.02, 0);
        const colors = ['#f06292', '#ffd54f', '#ff8a65', '#ba68c8', '#ffffff'];
        for (let k = 0; k < 6; k++) {
            const fx = (rnd(seed, 20 + k) - 0.5) * 0.3;
            const fz = (rnd(seed, 30 + k) - 0.5) * 0.14;
            part(group, icoG(0.045), colors[k % colors.length], fx, 0.07, fz);
        }
    }
}

// בית ספר: מתאחד עם בתי ספר סמוכים באותה קבוצה (עד 5). בין החלקות נבנית גם הכניסה והחלונות
const SCHOOL_STYLE = {
    school:     { wall: '#ffd166', roof: '#9e9e9e' },
    kinder:     { wall: '#ffab91', roof: '#ff7043' },
    highschool: { wall: '#b0bec5', roof: '#546e7a' },
};
function buildSchool(group, c, r, v) {
    const { wall: WALL, roof: ROOF } = SCHOOL_STYLE[v.id];
    const gid = schoolGid.get(key(c, r));
    const linked = {};
    DIRS.forEach(d => {
        linked[d.name] = gid !== undefined && schoolGid.get(key(c + d.dc, r + d.dr)) === gid;
    });

    // גוף מרכזי + זרוע לכל חלקה מאוחדת שכנה
    part(group, boxG(0.8, 0.6, 0.8), WALL, 0, 0.3, 0);
    part(group, boxG(0.86, 0.06, 0.86), ROOF, 0, 0.63, 0);
    DIRS.forEach(d => {
        if (!linked[d.name]) return;
        const px = d.dc * 0.25;
        const pz = d.dr * 0.25;
        part(group, boxG(d.dc !== 0 ? 0.5 : 0.8, 0.6, d.dr !== 0 ? 0.5 : 0.8), WALL, px, 0.3, pz);
        part(group, boxG(d.dc !== 0 ? 0.5 : 0.86, 0.06, d.dr !== 0 ? 0.5 : 0.86), ROOF, px, 0.63, pz);
    });

    // חזיתות חופשיות: חלונות, ובחזית אחת דלת לכיוון הדרך
    const exposed = DIRS.filter(d => !linked[d.name]);
    const entrance = exposed.find(d => roadAt(c + d.dc, r + d.dr)) || exposed[0];
    exposed.forEach(d => {
        const isEntr = d === entrance;
        const offs = isEntr ? [-0.24, 0.24] : [-0.24, 0, 0.24];
        const winSize = d.dr !== 0 ? [0.14, 0.14, 0.02] : [0.02, 0.14, 0.14];
        offs.forEach(t => {
            const x = d.dr !== 0 ? t : 0.41 * d.dc;
            const z = d.dr !== 0 ? 0.41 * d.dr : t;
            part(group, boxG(...winSize), '#90caf9', x, 0.36, z, { roughness: 0.3 });
        });
        if (isEntr) {
            const doorSize = d.dr !== 0 ? [0.16, 0.22, 0.02] : [0.02, 0.22, 0.16];
            part(group, boxG(...doorSize), '#6d4c41', 0.41 * d.dc, 0.11, 0.41 * d.dr);
            const len = 0.1;
            const pathSize = d.dr !== 0 ? [0.14, 0.01, len] : [len, 0.01, 0.14];
            part(group, boxG(...pathSize), '#d7ccc8', 0.45 * d.dc, 0.005, 0.45 * d.dr);
        }
    });

    // דגל רק על החלקה העליונה של הקבוצה (לגן ילדים אין דגל)
    if (schoolAnchors.has(key(c, r)) && v.id !== 'kinder') {
        part(group, cylG(0.015, 0.015, 0.5, 5), '#eeeeee', -0.3, 0.88, -0.3);
        part(group, boxG(0.2, 0.12, 0.01), '#e53935', -0.2, 1.08, -0.3);
    }
}

// שער בכניסה לעיר: שני עמודים וקורה מעל הכביש (בקואורדינטות של החלקה)
function buildGate(group) {
    part(group, boxG(0.05, 0.4, 0.05), '#8d6e63', -0.5, 0.2, -0.26);
    part(group, boxG(0.05, 0.4, 0.05), '#8d6e63', -0.5, 0.2, 0.26);
    part(group, boxG(0.06, 0.06, 0.6), '#ffca28', -0.5, 0.41, 0);
}

// הכביש שמגיע מבחוץ: מהשער עד הקצה של השטח שבבעלות הילד. לא עובר דרך חלקות שנקנו
let outsideGroup = null;
function drawOutsideRoad() {
    if (!scene) return;
    if (outsideGroup) scene.remove(outsideGroup);
    outsideGroup = new THREE.Group();
    scene.add(outsideGroup);

    const row = entranceR;
    let c = entranceC - 1;
    while (c > -29 && !isOwned(c, row)) c--;
    const startX = entranceC - 0.5;    // המערב של השער
    const endX = c + 0.5;              // המזרח של החלקה הראשונה שבבעלות, או הקצה
    const len = startX - endX;
    if (len <= 0.01) return;
    part(outsideGroup, boxG(len, 0.024, 0.42), '#41444f', (startX + endX) / 2, 0.034, row);
    for (let x = startX - 0.4; x > endX + 0.1; x -= 0.8) {
        part(outsideGroup, boxG(0.12, 0.006, 0.03), '#f5f5f5', x, 0.049, row);
    }
}

// --- סצנה ---
let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let hoverMesh = null;
let raycaster = null;
let groundPlane = null;
const groups = new Map();   // "c,r" -> Group שמוצג בסצנה

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
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#bfe9ff');
    // ערפל עדין בקצה העיר: נותן עומק, והדשא מסתיים בלי קו חד
    scene.fog = new THREE.Fog('#bfe9ff', 22, 70);

    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 4;
    controls.maxPolarAngle = Math.PI * 0.42;

    scene.add(new THREE.HemisphereLight('#ffffff', '#7a9a55', 0.85));
    const sun = new THREE.DirectionalLight('#ffffff', 0.9);
    sun.position.set(4, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(touchScreen ? 1024 : 2048, touchScreen ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
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
        const cell = cellAt(e);
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
    controls.update();
    if (scene) updateMovers(dt);
    payCityTaxes(dt);
    renderer.render(scene, camera);
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

// צבע הסמן: כחול = קנייה של שטח, כתום = יוסר, צהוב = לבנייה או להוספת עץ/קישוט
function hoverColor(c, r) {
    if (!isOwned(c, r)) return '#4fc3f7';
    if (buildingAt(c, r)) return '#ff9800';
    const list = decorAt(c, r);
    if (list.length) {
        const v = VARIANT_BY_ID[selected];
        const canAdd = isDecorVariant(v) && list.length < DECOR_MAX;
        return canAdd ? '#ffeb3b' : '#ff9800';
    }
    return '#ffeb3b';
}

function updateHover(e) {
    const cell = cellAt(e);
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
            const cap = isDecorVariant(v) ? `<span class="note">🔢 עד ${DECOR_MAX} בחלקה</span>` : '';
            const eco = v.eco > 0 ? '<span class="eco good">🌿 עוזר לסביבה</span>'
                : v.eco < 0 ? '<span class="eco bad">🏭 פוגע בסביבה</span>' : '';
            btn.innerHTML = `<span class="icon">${v.icon}</span><span class="name">${v.name}</span><span class="desc">${v.desc}</span>${pop}${cap}${eco}<span class="price">${v.price} 🪙</span>`;
            btn.onclick = () => {
                selected = v.id;
                setDeleteMode(false);
                renderCatalog();
                $('hint').textContent = isDecorVariant(v)
                    ? `נבחר: ${v.name}. לחצו על חלקה ריקה או על חלקה עם עצים כדי להוסיף (עד ${DECOR_MAX} בחלקה).`
                    : `נבחר: ${v.name}. לחצו על חלקה ריקה כדי לבנות.`;
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
            <div class="meter-head"><span>${title}</span><strong>${value}%</strong></div>
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
}

// --- פעולות ---
// שינוי בעיר: שומרים, מציירים מחדש (דרכים ובתי ספר מסתכלים על השכנים), בודקים פרסים, ומציגים
function commit() {
    saveState();
    drawAll();
    checkRewards();
    renderAll();
}

// לחיצה על חלקה: שטח חדש אם היא למכירה. אחרת: מבנה גדול נמחק, עץ או קישוט מתווסף או מוסר, ובנייה רגילה
function onCell(c, r) {
    if (deleteMode) return deleteAt(c, r);
    if (!isOwned(c, r)) return buyLand(c, r);
    if (buildingAt(c, r)) {
        if (isEntrance(c, r) && roadAt(c, r)) return feedback('הכביש הזה מחבר את העיר לעולם החיצון, לכן אי אפשר להסיר אותו');
        return removeAt(c, r);
    }
    const list = decorAt(c, r);
    if (list.length) {
        // יש עצים או קישוטים: אם בחרתם עץ או קישוט חדש ויש מקום, מוסיפים. אחרת מסירים את האחרון
        const v = VARIANT_BY_ID[selected];
        if (isDecorVariant(v) && list.length < DECOR_MAX) return place(c, r);
        return removeDecorAt(c, r);
    }
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
    feedback(gateMoved ? `קניתם שטח חדש, והשער זז אליו! −${price} 🪙` : `קניתם שטח חדש! −${price} 🪙`);
}

function place(c, r) {
    const v = VARIANT_BY_ID[selected];
    if (!v) return;
    const bal = balance();
    if (!W) return feedback('אי אפשר לבנות עכשיו 🪙');
    if (bal < v.price) {
        return feedback(`חסרים לכם ${v.price - bal} 🪙 כדי לבנות ${v.name}`);
    }
    if (!W.spend(v.price)) return feedback('משהו השתבש, נסו שוב');

    if (isDecorVariant(v)) {
        const list = [...decorAt(c, r), v.id];
        decor.set(key(c, r), list);
        commit();
        return feedback(`הוספתם ${v.name} לחלקה (${list.length} מתוך ${DECOR_MAX}). −${v.price} 🪙`);
    }

    buildings.set(key(c, r), v.id);
    commit();
    if (v.cat === 'road' || buildingActive(c, r)) {
        feedback(`בניתם ${v.name}! −${v.price} 🪙`);
    } else {
        feedback(`בניתם ${v.name}, אבל בלי דרך לידו הוא לא יעבוד 🚧 (−${v.price} 🪙)`);
    }
}

function removeAt(c, r) {
    const v = variantAt(c, r);
    if (!confirm(`למחוק את ${v.name}? יוחזר חצי מהמחיר.`)) return;
    const refund = Math.floor(v.price / 2);
    buildings.delete(key(c, r));
    commit();
    if (W && refund > 0) W.earn(refund, { reason: `החזר ${v.name}` });
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
    if (W && refund > 0) W.earn(refund, { reason: `החזר ${v.name}` });
    feedback(`הורדתם ${v.name} מהחלקה (נשארו ${list.length - 1} מתוך ${DECOR_MAX}). הוחזרו ${refund} 🪙`);
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
    if (W && refund > 0) W.earn(refund, { reason: 'החזר עצים וקישוטים' });
    feedback(`מחקתם ${list.length} פריטים מהחלקה. הוחזרו ${refund} 🪙`);
}

// כפתור המחיקה: דולק או כבוי. כשהוא דולק, ההינט מסביר מה לעשות
function setDeleteMode(on) {
    deleteMode = on;
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
    const g = new THREE.Group();
    g.scale.set(0.6, 0.6, 0.6);   // קטנים יותר
    const shirt = pickRandom(PEOPLE_SHIRTS);
    part(g, boxG(0.13, 0.16, 0.08), shirt, 0, 0.22, 0);                        // גוף
    part(g, icoG(0.055), pickRandom(PEOPLE_SKINS), 0, 0.38, 0);               // ראש
    part(g, boxG(0.12, 0.035, 0.1), '#3e2723', 0, 0.435, 0);                   // שיער
    const pants = pickRandom(PEOPLE_PANTS);
    // רגליים וזרועות על ציר בירך ובכתף, כך שהן מתנדנדות בהליכה
    const legs = [-0.035, 0.035].map(x => {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0.14, 0);
        part(pivot, boxG(0.05, 0.14, 0.05), pants, 0, -0.07, 0);
        g.add(pivot);
        return pivot;
    });
    const arms = [-0.085, 0.085].map(x => {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0.29, 0);
        part(pivot, boxG(0.04, 0.16, 0.04), shirt, 0, -0.08, 0);
        g.add(pivot);
        return pivot;
    });
    return {
        kind: 'person', g, legs, arms, speed: 0.6 + Math.random() * 0.4, time: Math.random() * 10, phase: Math.random() * 6,
        side: Math.random() < 0.5 ? -1 : 1, latX: 0, latZ: 0,   // לאיזה צד של הכביש, והיסט נוכחי מהמרכז
    };
}

function makeCar() {
    const g = new THREE.Group();
    part(g, boxG(0.2, 0.1, 0.36), pickRandom(CAR_COLORS), 0, 0.1, 0);          // גוף
    part(g, boxG(0.16, 0.08, 0.18), '#b3e5fc', 0, 0.19, -0.02, { roughness: 0.3 }); // חלון
    [[-0.1, 0.12], [0.1, 0.12], [-0.1, -0.12], [0.1, -0.12]].forEach(([x, z]) => {
        const wheel = part(g, cylG(0.05, 0.05, 0.04, 8), '#263238', x, 0.05, z);
        wheel.rotation.z = Math.PI / 2;
    });
    return { kind: 'car', g, speed: 1.2 + Math.random() * 0.5, side: 0, latX: 0, latZ: 0 };
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

// --- התחלה ---
loadState();
if (!init3D()) {
    feedback('אי אפשר להציג את העיר בתלת-ממד במכשיר הזה.');
}
if (W) {
    W.onChange((bal) => {
        $('balance').textContent = bal;
        renderCatalog();
    });
} else {
    $('balance').textContent = 0;
}
$('centerBtn').onclick = () => fitCamera();
$('deleteBtn').onclick = () => setDeleteMode(!deleteMode);
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
