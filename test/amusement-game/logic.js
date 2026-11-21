// לונה פארק: החוקים והחישובים (בלי מסך, כדי שאפשר יהיה לבדוק אותם).
// ההכנסה לדקה (rate) נשמרת יחד עם הנתונים של החלקה. העיר מוסיפה אותה למסים שלה ומשלמת אוטומטית.
(function (root) {
  // thrill: כמה מושך. cap: כמה מבקרים בדקה המתקן יכול לשרת (תור)
  // id הוא גם המזהה השמור בנתונים, לכן לא משנים אותו. חדשים מוסיפים בסוף
  const RIDES = [
    { id: 'swing',    icon: '🪁', name: 'נדנדות',       price: 30,  thrill: 1,   cap: 6 },
    { id: 'carousel', icon: '🎠', name: 'קרוסלה',       price: 40,  thrill: 1.5, cap: 5 },
    { id: 'bumper',   icon: '🚗', name: 'מכוניות מתנגשות', price: 60, thrill: 2, cap: 5 },
    { id: 'ferris',   icon: '🎡', name: 'גלגל ענק',     price: 70,  thrill: 2.5, cap: 6 },
    { id: 'water',    icon: '🌊', name: 'מגלשת מים',    price: 90,  thrill: 3,   cap: 4 },
    { id: 'coaster',  icon: '🎢', name: 'רכבת הרים',    price: 130, thrill: 4,   cap: 3 },
    { id: 'teacups',  icon: '☕', name: 'ספלים מסתובבים', price: 50, thrill: 1.5, cap: 5 },
    { id: 'pirate',   icon: '🏴‍☠️', name: 'ספינת פיראטים', price: 80, thrill: 3,  cap: 4 },
    { id: 'tower',    icon: '🗼', name: 'מגדל נפילה',   price: 110, thrill: 3.5, cap: 3 },
  ];
  // דוכנים: תופסים משבצת, לא מושכים מבקרים, אבל המבקרים מוציאים אצלם כסף
  const STALLS = [
    { id: 'popcorn',  icon: '🍿', name: 'דוכן פופקורן', price: 25, stall: true },
    { id: 'icecream', icon: '🍦', name: 'דוכן גלידה',   price: 30, stall: true },
    { id: 'balloon',  icon: '🎈', name: 'דוכן בלונים',  price: 20, stall: true },
  ];
  const ITEMS = RIDES.concat(STALLS);
  const ITEM_BY_ID = Object.fromEntries(ITEMS.map((r) => [r.id, r]));
  const RIDE_BY_ID = ITEM_BY_ID;
  const START_COLS = 4;
  const START_ROWS = 3;
  const MAX_ROWS = 8;
  const RATE_MAX = 3;            // מטבעות בדקה ללונה פארק אחד, לפני דוכנים
  const PRICES = [1, 2, 3];
  const ELASTIC = { 1: 1, 2: 0.75, 3: 0.5 };
  const SAFETY_LOSS_PER_MIN = 1.5;
  const SAFETY_FLOOR = 20;
  const AWAY_CAP_MS = 3 * 60 * 60 * 1000;
  const MODES = ['entry', 'perRide'];   // כרטיס כניסה אחד, או תשלום על כל מתקן (מטבע אחד)
  const MAX_LEVEL = 3;
  const BREAK_MS = 4 * 60 * 1000;       // כל כמה זמן מתקן עלול להתקלקל (כשהבטיחות נמוכה)
  const SHOW_MS = 3 * 60 * 1000;        // הפסקה בין מופעי זיקוקים

  const clampN = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const cellKey = (x, y) => x + ',' + y;

  function newState(now) {
    return {
      cols: START_COLS, rows: START_ROWS, grid: {}, lv: {}, broken: {}, safety: 100, price: 1, mode: 'entry',
      done: [], shows: 0, repairs: 0, rode: 0, showAt: 0, breakAt: 0, at: now || Date.now(), rate: 0, summary: '',
    };
  }

  function normalize(d, now) {
    const s = newState(now);
    if (!d || typeof d !== 'object') return s;
    s.rows = clampN(Math.floor(+d.rows || START_ROWS), START_ROWS, MAX_ROWS);
    if (d.grid && typeof d.grid === 'object') {
      for (const [k, id] of Object.entries(d.grid)) {
        const m = /^(\d+),(\d+)$/.exec(k);
        if (!m || !ITEM_BY_ID[id]) continue;
        if (+m[1] >= s.cols || +m[2] >= s.rows) continue;
        s.grid[k] = id;
        const lv = clampN(Math.floor(+(d.lv && d.lv[k]) || 1), 1, MAX_LEVEL);
        if (lv > 1 && !ITEM_BY_ID[id].stall) s.lv[k] = lv;
        if (d.broken && d.broken[k] && !ITEM_BY_ID[id].stall) s.broken[k] = true;
      }
    }
    s.safety = d.safety === undefined ? 100 : clampN(+d.safety || 0, 0, 100);
    s.price = PRICES.includes(+d.price) ? +d.price : 1;
    s.mode = MODES.includes(d.mode) ? d.mode : 'entry';
    if (Array.isArray(d.done)) s.done = GOALS.map((g) => g.id).filter((id) => d.done.includes(id));
    ['shows', 'repairs', 'rode'].forEach((f) => { s[f] = clampN(Math.floor(+d[f] || 0), 0, 99999); });
    s.showAt = +d.showAt || 0;
    s.breakAt = +d.breakAt || 0;
    s.at = +d.at || s.at;
    s.rate = rateOf(s);
    s.summary = summaryOf(s);
    return s;
  }

  const levelOf = (s, k) => (s.lv && s.lv[k]) || 1;
  const isBroken = (s, k) => !!(s.broken && s.broken[k]);
  // המתקנים שפועלים עכשיו (בלי דוכנים ובלי מקולקלים)
  const live = (s) => Object.entries(s.grid).filter(([k, id]) => !ITEM_BY_ID[id].stall && !isBroken(s, k)).map(([k, id]) => ({ k, r: ITEM_BY_ID[id], lv: levelOf(s, k) }));
  const thrillOf = (e) => e.r.thrill * (1 + 0.3 * (e.lv - 1));
  const capOf = (e) => e.r.cap * (1 + 0.25 * (e.lv - 1));
  const rideCount = (s) => Object.values(s.grid).filter((id) => !ITEM_BY_ID[id].stall).length;
  const itemCount = (s) => Object.keys(s.grid).length;
  const kinds = (s) => new Set(live(s).map((e) => e.r.id)).size;
  const stallKinds = (s) => new Set(Object.values(s.grid).filter((id) => ITEM_BY_ID[id].stall)).size;
  const brokenCount = (s) => Object.keys(s.broken).length;
  const freeCells = (s) => s.cols * s.rows - itemCount(s);
  const expandCost = (s) => 50 * (s.rows - START_ROWS + 1);
  const inspectCost = (s) => 2 + Math.floor(rideCount(s) / 3);
  const spendMult = (s) => 1 + 0.1 * stallKinds(s);
  const rateMax = (s) => RATE_MAX + 0.3 * stallKinds(s);

  // מתקן שיש לידו מתקן או דוכן מסוג אחר מוסיף עניין: "מסלול כיף"
  function funPairs(s) {
    let n = 0;
    for (const [k, id] of Object.entries(s.grid)) {
      const [x, y] = k.split(',').map(Number);
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const o = s.grid[cellKey(x + dx, y + dy)];
        return o && o !== id;
      });
      if (near) n++;
    }
    return n;
  }

  // עניין = כמה המתקנים מושכים + מגוון + מסלול כיף
  function interest(s) {
    const on = live(s);
    if (!on.length) return 0;
    return on.reduce((a, e) => a + thrillOf(e), 0) + kinds(s) * 1.5 + funPairs(s) * 0.5;
  }
  // בטיחות נמוכה מרחיקה מבקרים (בין 40% ל-100%)
  const safetyFactor = (s) => 0.4 + 0.6 * (s.safety / 100);
  const ridesPerVisitor = (s) => Math.min(3, live(s).length);
  const capacityPerMin = (s) => live(s).reduce((a, e) => a + capOf(e), 0);

  // מבקרים שרוצים להגיע בדקה, ומבקרים שמתקבלים בפועל: אם התור ארוך מדי חלק עוזבים
  function wantedPerMin(s) {
    return 0.12 * interest(s) * safetyFactor(s) * (s.mode === 'entry' ? (ELASTIC[s.price] || 1) : 1);
  }
  function queueRatio(s) {
    const need = wantedPerMin(s) * ridesPerVisitor(s);
    const cap = capacityPerMin(s);
    return cap > 0 ? need / cap : 0;
  }
  function servedPerMin(s) {
    const q = queueRatio(s);
    const w = wantedPerMin(s);
    return q > 1 ? w / q : w;
  }
  function rateOf(s) {
    const perVisitor = s.mode === 'entry' ? s.price : ridesPerVisitor(s);
    return Math.round(Math.min(rateMax(s), servedPerMin(s) * perVisitor * spendMult(s)) * 100) / 100;
  }
  // כוכבים (0 עד 5): לפי העניין בפארק והבטיחות
  const STAR_STEPS = [2, 6, 12, 20, 30];
  function stars(s) {
    const score = interest(s) * safetyFactor(s);
    return STAR_STEPS.filter((t) => score >= t).length;
  }
  function summaryOf(s) {
    const n = rideCount(s);
    if (!n) return 'עוד אין מתקנים';
    const q = queueRatio(s);
    return `${'⭐'.repeat(stars(s))} ${n} מתקנים, ${kinds(s)} סוגים, ${servedPerMin(s).toFixed(1)} מבקרים בדקה${q > 1 ? ', יש תור ארוך' : ''}`.trim();
  }

  function decay(s, ms) {
    const min = clampN(ms, 0, AWAY_CAP_MS) / 60000;
    s.safety = Math.max(SAFETY_FLOOR, s.safety - SAFETY_LOSS_PER_MIN * min);
    return s;
  }

  function inGrid(s, x, y) { return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < s.cols && y >= 0 && y < s.rows; }
  function canPlace(s, id, x, y) {
    const r = ITEM_BY_ID[id];
    if (!r) return { ok: false, msg: 'מתקן לא מוכר' };
    if (!inGrid(s, x, y)) return { ok: false, msg: 'המקום מחוץ לשטח' };
    if (s.grid[cellKey(x, y)]) return { ok: false, msg: 'כבר יש שם מתקן' };
    return { ok: true, cost: r.price };
  }
  function place(s, id, x, y) {
    const c = canPlace(s, id, x, y);
    if (c.ok) s.grid[cellKey(x, y)] = id;
    return c;
  }
  function firstFree(s) {
    for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) if (!s.grid[cellKey(x, y)]) return { x, y };
    return null;
  }
  function remove(s, x, y) {
    const k = cellKey(x, y), id = s.grid[k];
    if (!id) return { ok: false, msg: 'אין שם מתקן' };
    delete s.grid[k];
    delete s.lv[k];
    delete s.broken[k];
    return { ok: true, refund: Math.floor(ITEM_BY_ID[id].price / 2), id };
  }
  function canExpand(s) {
    if (s.rows >= MAX_ROWS) return { ok: false, msg: 'השטח כבר במקסימום' };
    return { ok: true, cost: expandCost(s) };
  }
  function expand(s) {
    const c = canExpand(s);
    if (c.ok) s.rows++;
    return c;
  }
  function inspect(s) {
    if (!rideCount(s)) return { ok: false, msg: 'עוד אין מתקנים לבדוק' };
    if (s.safety >= 95) return { ok: false, msg: 'המתקנים בטוחים' };
    return { ok: true, cost: inspectCost(s) };
  }
  function setPrice(s, p) { if (!PRICES.includes(p)) return false; s.price = p; return true; }
  function setMode(s, m) { if (!MODES.includes(m)) return false; s.mode = m; return true; }

  // שדרוג מתקן: יותר מושך ומשרת יותר מבקרים (עד רמה 3)
  function canUpgrade(s, k) {
    const r = ITEM_BY_ID[s.grid[k]];
    if (!r || r.stall) return { ok: false, msg: 'אי אפשר לשדרג את זה' };
    const lv = levelOf(s, k);
    if (lv >= MAX_LEVEL) return { ok: false, msg: 'המתקן כבר ברמה הגבוהה ביותר' };
    return { ok: true, cost: Math.round(r.price * 0.5 * lv), level: lv + 1 };
  }
  function upgrade(s, k) {
    const c = canUpgrade(s, k);
    if (c.ok) s.lv[k] = c.level;
    return c;
  }

  // תקלות: כשהבטיחות נמוכה, מדי פעם מתקן מתקלקל ומפסיק לעבוד עד שמתקנים אותו. מחזיר את המשבצת או null
  function tickBreak(s, now, rand) {
    if (!s.breakAt) { s.breakAt = now + BREAK_MS; return null; }
    if (now < s.breakAt) return null;
    s.breakAt = now + BREAK_MS;
    const on = live(s);
    if (!on.length || (rand || Math.random)() > (100 - s.safety) / 100 * 1.2) return null;
    const e = on[Math.floor((rand || Math.random)() * on.length)];
    s.broken[e.k] = true;
    return e.k;
  }
  const repairCost = (s, k) => 4 + 2 * levelOf(s, k);
  function repair(s, k) {
    if (!isBroken(s, k)) return { ok: false, msg: 'המתקן תקין' };
    return { ok: true, cost: repairCost(s, k) };
  }
  function fixed(s, k) { delete s.broken[k]; s.repairs++; }

  // מופע זיקוקים: פעם בכמה דקות, המבקרים משאירים טיפים
  function showWait(s, now) { return Math.max(0, (s.showAt || 0) + SHOW_MS - now); }
  function runShow(s, now) {
    if (!live(s).length) return { ok: false, msg: 'צריך לפחות מתקן אחד פועל בשביל מופע' };
    if (showWait(s, now) > 0) return { ok: false, msg: 'הזיקוקים עוד לא מוכנים' };
    s.showAt = now;
    s.shows++;
    return { ok: true, tips: 2 + stars(s) };
  }

  // משימות: כל אחת מזכה בפרס פעם אחת
  const GOALS = [
    { id: 'first',  icon: '🎠', text: 'בנו מתקן ראשון',            reward: 5,  ok: (s) => rideCount(s) >= 1 },
    { id: 'stall',  icon: '🍿', text: 'פתחו דוכן',                 reward: 5,  ok: (s) => stallKinds(s) >= 1 },
    { id: 'rode',   icon: '🎥', text: 'עלו על מתקן',               reward: 5,  ok: (s) => s.rode >= 1 },
    { id: 'kinds3', icon: '🎡', text: 'שלושה סוגי מתקנים',          reward: 8,  ok: (s) => kinds(s) >= 3 },
    { id: 'lv',     icon: '⬆️', text: 'שדרגו מתקן',                reward: 8,  ok: (s) => Object.keys(s.lv).length >= 1 },
    { id: 'show',   icon: '🎆', text: 'ערכו מופע זיקוקים',          reward: 5,  ok: (s) => s.shows >= 1 },
    { id: 'fix',    icon: '🔧', text: 'תקנו מתקן מקולקל',           reward: 5,  ok: (s) => s.repairs >= 1 },
    { id: 'six',    icon: '🎢', text: 'שישה מתקנים בפארק',          reward: 10, ok: (s) => rideCount(s) >= 6 },
    { id: 'stars3', icon: '⭐', text: 'פארק של שלושה כוכבים',       reward: 10, ok: (s) => stars(s) >= 3 },
    { id: 'stars5', icon: '🌟', text: 'פארק של חמישה כוכבים',       reward: 25, ok: (s) => stars(s) >= 5 },
    { id: 'kinds9', icon: '🏆', text: 'כל 9 סוגי המתקנים',          reward: 40, ok: (s) => kinds(s) >= RIDES.length },
  ];
  const GOAL_BY_ID = Object.fromEntries(GOALS.map((g) => [g.id, g]));
  const goalState = (s, g) => (s.done.includes(g.id) ? 'done' : g.ok(s) ? 'ready' : 'open');
  const goalsReady = (s) => GOALS.filter((g) => goalState(s, g) === 'ready').length;
  function claimGoal(s, id) {
    const g = GOAL_BY_ID[id];
    if (!g || goalState(s, g) !== 'ready') return { ok: false, msg: 'המשימה עוד לא הושלמה' };
    s.done.push(id);
    return { ok: true, reward: g.reward };
  }

  const api = {
    RIDES, STALLS, ITEMS, ITEM_BY_ID, RIDE_BY_ID, GOALS, START_COLS, START_ROWS, MAX_ROWS, RATE_MAX, PRICES, MODES,
    SAFETY_FLOOR, AWAY_CAP_MS, MAX_LEVEL, BREAK_MS, SHOW_MS,
    newState, normalize, rideCount, itemCount, kinds, stallKinds, brokenCount, freeCells, expandCost, inspectCost, funPairs,
    interest, safetyFactor, ridesPerVisitor, capacityPerMin, wantedPerMin, queueRatio, servedPerMin, rateOf, rateMax,
    spendMult, stars, summaryOf, decay, canPlace, place, firstFree, remove, canExpand, expand, inspect, setPrice, setMode,
    cellKey, levelOf, isBroken, canUpgrade, upgrade, tickBreak, repairCost, repair, fixed, showWait, runShow,
    goalState, goalsReady, claimGoal,
  };
  root.AmusementLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
