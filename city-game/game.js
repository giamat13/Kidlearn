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
//   • העיר מתרחבת: קונים שטח חדש ליד השטח הקיים. מחיר השטח קבוע, והמצלמה לא מתרחקת ככל שהעיר גדלה.
// המחירים והפרסים נגזרים מ-REWARDS כדי להישאר בפרופורציה לשאר המשחקים.

const START_COLS = 5;      // השטח ההתחלתי: 5 על 4 חלקות
const START_ROWS = 4;
const STORE_KEY = 'kidlearn-city-v2';
const OLD_STORE_KEY = 'kidlearn-city';   // הגרסה הקודמת (רשת קבועה 5×4), לצורך מעבר חלק
const MERGE_MAX = 5;                     // מקסימום בתי ספר שמתאחדים לאחד
const DECOR_MAX = 7;                     // מקסימום עצים וקישוטים בחלקה אחת
const GOOD_LEVEL = 70;                   // מעל הערך הזה במדד מקבלים פרס (פעם אחת)
// שער הכניסה לעיר: כביש שמגיע מבחוץ. תמיד קיים ואי אפשר להסיר אותו.
// הוא תמיד על החלקה המערבית ביותר בעיר. כשקונים שטח שהוא מערב לכל העיר, השער זז לשטח החדש (נשמר בשמירה)
let entranceC = 0;
let entranceR = 1;

const W = window.KidLearnWallet;
const R = W ? W.REWARDS : { answer: 2, smallSuccess: 1, round: 8, level: 10, perfect: 20, create: 5 };
// כל המחירים בעיר יורדים בחצי (ומעוגלים). הפרסים שהילד מקבל לא משתנים
const PRICE_FACTOR = 0.5;
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
    { id: 'park',   name: 'פנאי ופארקים',    icon: '🏞️', color: '#26a69a' },
    { id: 'props',  name: 'דברים קטנים',     icon: '⛲', color: '#8d6e63' },
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

    { id: 'school',     cat: 'school', name: 'בית ספר יסודי', icon: '🏫', price: cheap(R.perfect),     eco: 0,    love: 'בית הספר עוזר לילדים ללמוד ולגדול', desc: 'לכיתות א׳ עד ו׳' },
    { id: 'kinder',     cat: 'school', name: 'גן ילדים',    icon: '🧸', price: cheap(R.level),         eco: 0,    love: 'הגן הקטן מלא בצחוק של ילדים', desc: 'לגיל הרך' },
    { id: 'highschool', cat: 'school', name: 'תיכון',       icon: '🎓', price: cheap(R.round * 5),     eco: 0,    love: 'התיכון מכין את הבוגרים של העיר', desc: 'לתלמידים בוגרים' },

    { id: 'shop',       cat: 'shop',   name: 'חנות',        icon: '🏪', price: cheap(R.level),         eco: -0.5, love: 'אנחנו אוהבים ללכת לחנות השכונתית', desc: 'חנות שכונתית' },
    { id: 'mini',       cat: 'shop',   name: 'מכולת',       icon: '🧺', price: cheap(R.create),        eco: 0,    love: 'המכולת הקטנה ליד הבית נוחה מאוד', desc: 'מכולת קטנה ליד הבית' },
    { id: 'mall',       cat: 'shop',   name: 'קניון',       icon: '🛍️', price: cheap(R.round * 5),     eco: -1.5, love: 'בקניון יש הרבה דברים לקנות', desc: 'הרבה חנויות במקום אחד' },

    { id: 'clinic',     cat: 'clinic', name: 'מרפאה',       icon: '🏥', price: cheap(R.perfect),       eco: 0,    love: 'טוב לדעת שיש מרפאה קרובה', desc: 'טיפול בסיסי לתושבים' },
    { id: 'hospital',   cat: 'clinic', name: 'בית חולים',   icon: '🏨', price: cheap(R.round * 5),     eco: -0.5, love: 'בית החולים שומר על כולנו', desc: 'טיפול מורכב ודחוף' },

    { id: 'park',       cat: 'park',   name: 'פארק',        icon: '🏞️', price: cheap(R.level),         eco: 2,    love: 'הפארק הוא המקום שאנחנו הכי אוהבים', desc: 'מקום לטיולים ולשחק' },
    { id: 'garden',     cat: 'park',   name: 'גינה קטנה',   icon: '🌷', price: cheap(R.create),        eco: 1.5,  love: 'הגינה הקטנה מלאה פרחים וריח טוב', desc: 'פרחים וספסל' },
    { id: 'playground', cat: 'park',   name: 'גן שעשועים',  icon: '🛝', price: cheap(R.level),         eco: 1,    love: 'בגן השעשועים הילדים משחקים כל היום', desc: 'מגלשה ונדנדה' },

    { id: 'bench',      cat: 'props',  name: 'ספסל',        icon: '🪑', price: cheap(R.answer),        eco: 0,    size: 0.6,  love: 'כיף לשבת על הספסל ולנוח', desc: 'מקום לשבת ולנוח' },
    { id: 'fountain',   cat: 'props',  name: 'מזרקה',       icon: '⛲', price: cheap(R.create),        eco: 1,    size: 0.5,  love: 'המזרקה נעימה לשמוע', desc: 'מים שזורמים במרכז' },
    { id: 'tap',        cat: 'props',  name: 'ברזייה',      icon: '🚰', price: cheap(R.answer),        eco: 0.5,  size: 0.8,  love: 'הברזייה מאפשרת לשתות מים קרים', desc: 'ברז מים לשתייה' },
    { id: 'lamp',       cat: 'props',  name: 'פנס רחוב',    icon: '🪔', price: cheap(R.answer),        eco: 0,    size: 0.7,  love: 'פנסי הרחוב מאירים לנו בערב', desc: 'מאיר בערב' },
    { id: 'bin',        cat: 'props',  name: 'פח אשפה',     icon: '🗑️', price: cheap(R.smallSuccess),  eco: 1,    size: 0.8,  love: 'בזכות פחי האשפה העיר נקייה', desc: 'שומר על העיר נקייה' },
    { id: 'flowers',    cat: 'props',  name: 'ערוגת פרחים', icon: '💐', price: cheap(R.answer),        eco: 1,    size: 0.6,  love: 'ערוגת הפרחים מצבעת את העיר', desc: 'צבעים לעיר' },
];
const VARIANT_BY_ID = Object.fromEntries(VARIANTS.map(v => [v.id, v]));
const START_COUNT = START_COLS * START_ROWS;
const LAND_PRICE = cheap(R.create);   // מחיר קבוע לכל שטח נוסף (לא עולה ככל שהעיר גדלה)

// מה התושבים דורשים, לפי מספר התושבים. כל דרישה היא קטגוריה שצריך מבנה פעיל ממנה
const DEMANDS = [
    { id: 'school', pop: 4,  icon: '🏫', text: 'בית ספר לילדים' },
    { id: 'shop',   pop: 8,  icon: '🏪', text: 'חנות קרובה לבית' },
    { id: 'clinic', pop: 12, icon: '🏥', text: 'מרפאה לחולים' },
    { id: 'park',   pop: 16, icon: '🏞️', text: 'פארק לטיולים' },
];

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
    } catch (e) { /* אין רשת: נמשיך לשמור במכשיר */ }
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
    return roadNextTo(c, r);
}

// סטטיסטיקה של העיר: כמה תושבים, כמה מבנים פעילים מכל קטגוריה, וכמה מחכים לדרך
function stats() {
    refreshSchoolGroups();
    let pop = 0;
    let inactive = 0;
    const active = {};
    for (const [k, id] of buildings) {
        const v = VARIANT_BY_ID[id];
        if (!v || v.cat === 'road' || v.cat === 'school') continue;
        const { c, r } = parseKey(k);
        if (!roadNextTo(c, r)) { inactive++; continue; }
        pop += v.pop || 0;
        active[v.cat] = (active[v.cat] || 0) + 1;
    }
    // בתי ספר נספרים לפי קבוצה מאוחדת
    const groupCount = new Set(schoolGid.values()).size;
    active.school = schoolActiveGids.size;
    inactive += groupCount - schoolActiveGids.size;
    return { pop, active, inactive };
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
    DEMANDS.forEach(d => {
        if (st.pop >= d.pop) h += st.active[d.id] > 0 ? 6 : -6;
    });
    h += env * 0.3;
    h += Math.min(16, lovedCount * 2);
    h -= Math.min(16, st.inactive * 4);
    return clamp(h);
}

function cityMeters() {
    const st = stats();
    const env = envScore();
    const loved = lovedKinds();
    return { st, env, loved, happy: happyScore(st, env, loved.length) };
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
    DEMANDS.forEach(d => {
        if (st.pop < d.pop || !(st.active[d.id] > 0)) return;
        reward(d.id, R.round, `התושבים מרוצים: ${d.text}`);
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
    else if (cat === 'park') buildPark(group, seed, v);

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

// פארק, גינה קטנה או גן שעשועים
function buildPark(group, seed, v) {
    part(group, boxG(0.9, 0.02, 0.9), '#a5d6a7', 0, 0.01, 0);
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
    controls.update();
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
    $('meters').innerHTML = meter('🌿 מד שמירה על הסביבה', m.env, 'env', envNote)
        + meter('😊 מד שמחה', m.happy, 'happy', happyNote);
}

// לוח התושבים: כמה יש, מה הם דורשים, ומה כבר נענה
function renderDemands(st) {
    const asking = [];
    const done = [];
    const soon = [];
    DEMANDS.forEach(d => {
        const ok = st.active[d.id] > 0;
        if (st.pop < d.pop) soon.push(`${d.icon} ${d.text} (מ־${d.pop} תושבים)`);
        else if (ok) done.push(`✅ ${d.icon} ${d.text}`);
        else asking.push(`${d.icon} ${d.text}`);
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
    if (m.st.inactive > 0) complaints.push('יש בית שמחכה לדרך, כדי שנוכל להגיע אליו 🚧');
    box.innerHTML = title
        + (bubbles ? `<div class="bubbles">${bubbles}</div>` : '<div class="loves-empty">עוד לא בנינו משהו שאוהבים</div>')
        + complaints.map(t => `<div class="complaint">💭 ${t}</div>`).join('');
}

function renderAll() {
    renderCatalog();
    renderCounts();
    const m = cityMeters();
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
    const refund = Math.floor(v.price / 2);
    if (list.length > 1) decor.set(key(c, r), list.slice(0, -1));
    else decor.delete(key(c, r));
    commit();
    if (W && refund > 0) W.earn(refund, { reason: `החזר ${v.name}` });
    feedback(`הורדתם ${v.name} מהחלקה (נשארו ${list.length - 1} מתוך ${DECOR_MAX}). הוחזרו ${refund} 🪙`);
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
if (window.KidLearn && KidLearn.onAuthChange) {
    KidLearn.onAuthChange((profile) => { if (profile) cloudSync(); });
}
renderAll();
